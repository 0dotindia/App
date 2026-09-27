"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth-guards";
import { saveUploadedImage } from "@/lib/uploads";
import { randomUUID } from "crypto";
import { chargeWallet } from "@/lib/wallet/charge";
import { COIN_FUNDED_MARKER, effectivelyActiveWhere } from "@/lib/subscription-access";
import { WalletError } from "@/lib/wallet/ledger";
import { coinIdempotencyKey } from "@/lib/wallet/limits";
import { notifyNewSubscriber } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/app/actions/auth";

const BILLING_INTERVAL_VALUES = new Set(["monthly", "yearly"]);
const STATUS_VALUES = new Set(["active", "archived"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Same convention tips.ts's checkTipRateLimit established for this exact
// class of action (repeated charge attempts against the payment
// processor) — subscribeToTier moves real money too and had no guard.
function checkSubscribeRateLimit(userId: string): boolean {
  return checkRateLimit(`membership-subscribe:${userId}`, { max: 10, windowMs: 15 * 60 * 1000 });
}

type TierFields = {
  name: string;
  level: number;
  price: number;
  currency: string;
  billingInterval: string;
  description: string;
  status: string;
};

function parseAndValidateTierFields(formData: FormData): { error: string } | TierFields {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 60) return { error: "Name must be 1-60 characters." };

  const level = Number(formData.get("level"));
  if (!Number.isInteger(level) || level < 1) return { error: "Level must be a positive whole number." };

  const price = Number(formData.get("price"));
  if (!Number.isFinite(price) || price <= 0) return { error: "Price must be a positive number." };

  const currency = String(formData.get("currency") ?? "usd").trim().toLowerCase() || "usd";

  const billingInterval = String(formData.get("billingInterval") ?? "");
  if (!BILLING_INTERVAL_VALUES.has(billingInterval)) return { error: "Choose a billing interval." };

  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 1000) return { error: "Description must be 1000 characters or fewer." };

  const statusRaw = String(formData.get("status") ?? "active");
  const status = STATUS_VALUES.has(statusRaw) ? statusRaw : "active";

  return { name, level, price, currency, billingInterval, description, status };
}

// spec §4: owner-only tier CRUD, same shape as offerings.ts — a creator
// manages their own MembershipTier rows directly (no separate capability
// helper needed the way Offering needs canManageCatalog, since a tier only
// ever has one owner, never a team).
export async function createTier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const fields = parseAndValidateTierFields(formData);
  if ("error" in fields) return fields;

  let coverImageUrl: string | undefined;
  const coverFile = formData.get("coverImage");
  if (coverFile instanceof File && coverFile.size > 0) {
    const result = await saveUploadedImage(coverFile, { maxBytes: MAX_IMAGE_BYTES, uploadedById: user.id });
    if ("error" in result) return { error: result.error };
    coverImageUrl = result.url;
  }

  await db.membershipTier.create({ data: { creatorId: user.id, ...fields, coverImageUrl } });

  if (user.username) revalidatePath(`/s/${user.username.handle}`);
  return undefined;
}

export async function updateTier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const tierId = String(formData.get("tierId") ?? "");

  const tier = await db.membershipTier.findUnique({ where: { id: tierId } });
  if (!tier) return { error: "Tier not found." };
  if (tier.creatorId !== user.id) return { error: "You don't have permission to manage this tier." };

  const fields = parseAndValidateTierFields(formData);
  if ("error" in fields) return fields;

  let coverImageUrl = tier.coverImageUrl;
  const coverFile = formData.get("coverImage");
  if (coverFile instanceof File && coverFile.size > 0) {
    const result = await saveUploadedImage(coverFile, { maxBytes: MAX_IMAGE_BYTES, uploadedById: user.id });
    if ("error" in result) return { error: result.error };
    coverImageUrl = result.url;
  }

  await db.membershipTier.update({ where: { id: tier.id }, data: { ...fields, coverImageUrl } });

  if (user.username) revalidatePath(`/s/${user.username.handle}`);
  return undefined;
}

export async function archiveTier(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const tierId = String(formData.get("tierId") ?? "");
  if (!tierId) return;

  const tier = await db.membershipTier.findUnique({ where: { id: tierId } });
  if (!tier || tier.creatorId !== user.id) return;

  // Archiving a tier deliberately doesn't touch existing subscriptions or
  // gated posts — an archived tier just stops being offered to new
  // subscribers (see the subscribeToTier status check below); current
  // subscribers keep the access their subscription already grants.
  await db.membershipTier.update({ where: { id: tier.id }, data: { status: "archived" } });

  if (user.username) revalidatePath(`/s/${user.username.handle}`);
}

// spec §4.1/§4.3: subscribes with coins — the first period is charged
// now (kind: membership_charge) and the platform-billing sweep renews it
// from the fan's wallet after that (addendum-wallet-only-payments.md
// §3.3).
export async function subscribeToTier(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const tierId = String(formData.get("tierId") ?? "");

  const tier = await db.membershipTier.findUnique({ where: { id: tierId } });
  if (!tier || tier.status !== "active") return { error: "This membership tier isn't available." };
  if (tier.creatorId === user.id) return { error: "You can't subscribe to your own tier." };

  const existing = await db.membershipSubscription.findFirst({
    where: { fanId: user.id, tierId: tier.id, ...effectivelyActiveWhere() },
  });
  if (existing) return { error: "You're already subscribed to this tier." };

  if (!checkSubscribeRateLimit(user.id)) {
    return { error: "You're subscribing too fast. Please slow down." };
  }

  // addendum-wallet-only-payments.md §3.3: coins pay the first period now
  // and the platform-billing sweep auto-renews from the fan's wallet each
  // period after (autoRenew), until the fan cancels or runs out of coins
  // past the grace period. No payout account required on the creator
  // (coin-wallet v2 §6.4).
  const currentPeriodEnd = new Date();
  if (tier.billingInterval === "yearly") currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
  else currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  let subscribed = false;
  try {
    subscribed = await db.$transaction(async (tx) => {
      const charge = await chargeWallet(tx, {
        payerId: user.id,
        payeeUserId: tier.creatorId,
        amountUsd: tier.price,
        currency: tier.currency,
        kind: "membership_charge",
        relatedObjectType: "membership_tier",
        relatedObjectId: tier.id,
        idempotencyKey: coinIdempotencyKey("membership:coin", user.id, tier.id),
      });
      if (charge.alreadySettled) return false; // double-click — first click already subscribed
      await tx.membershipSubscription.create({
        data: {
          tierId: tier.id,
          fanId: user.id,
          status: "active",
          currentPeriodEnd,
          processorSubscriptionId: `${COIN_FUNDED_MARKER}${randomUUID()}`,
          autoRenew: true,
        },
      });
      return true;
    });
  } catch (err) {
    if (err instanceof WalletError && err.code === "INSUFFICIENT_FUNDS") {
      return { error: "You don't have enough coins for this membership." };
    }
    throw err;
  }

  if (subscribed) {
    await notifyNewSubscriber({ recipientId: tier.creatorId, actorId: user.id });
    const creatorHandle = (await db.username.findUnique({ where: { userId: tier.creatorId }, select: { handle: true } }))?.handle;
    if (creatorHandle) revalidatePath(`/${creatorHandle}`);
  }
  return { success: true };
}

// spec §4.3's third literal criterion: cancelling retains access through
// current_period_end, not immediately — this only flips status, it never
// touches currentPeriodEnd, and hasTierAccess (src/lib/tier-access.ts)
// treats a cancelled-but-not-yet-expired row as still granting access.
// Cancelling stops the coin auto-renew (addendum-wallet-only-payments.md
// §3.3); a past_due row (renewal failed, in grace) can be cancelled too,
// which stops the sweep retrying it.
export async function cancelSubscription(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return;

  const subscription = await db.membershipSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.fanId !== user.id) return;
  if (subscription.status !== "active" && subscription.status !== "past_due") return;

  await db.membershipSubscription.update({ where: { id: subscription.id }, data: { status: "cancelled" } });

  if (user.username) revalidatePath(`/s/${user.username.handle}`);
}
