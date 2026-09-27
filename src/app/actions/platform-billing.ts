"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwnProfile, requireVerifiedUser } from "@/lib/auth-guards";
import { isBusinessStaff } from "@/lib/businesses";
import { checkRateLimit } from "@/lib/rate-limit";
import { purchaseBusinessPlanWithCoins, cancelPlatformSubscription } from "@/lib/platform-billing";
import type { ActionState } from "@/app/actions/auth";

const BILLING_INTERVAL_VALUES = new Set(["monthly", "yearly"]);

// Same reasoning memberships.ts's checkSubscribeRateLimit gives for its own
// money-moving action: a repeated-attempt guard, not a product limit.
function checkSubscribeRateLimit(userId: string): boolean {
  return checkRateLimit(`platform-subscribe:${userId}`, { max: 10, windowMs: 15 * 60 * 1000 });
}

export async function cancelPremiumAction(formData: FormData): Promise<void> {
  const user = await requireOwnProfile();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return;

  const subscription = await db.platformSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.subscriberProfileId !== user.profile!.id) return;

  await cancelPlatformSubscription(subscriptionId);

  if (user.username) {
    revalidatePath(`/${user.username.handle}`);
    revalidatePath(`/s/${user.username.handle}`);
  }
}

// addendum-coin-wallet-v2.md §6.5 — pay the business subscription from the
// business wallet. owner/admin only (isBusinessStaff, matching
// WALLET_LIMITS.BUSINESS_SPEND_ROLES).
export async function subscribeBusinessWithCoinsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const businessId = String(formData.get("businessId") ?? "");
  const billingInterval = String(formData.get("billingInterval") ?? "monthly");
  if (!BILLING_INTERVAL_VALUES.has(billingInterval)) return { error: "Choose a billing interval." };

  if (!(await isBusinessStaff(businessId, user.id))) {
    return { error: "Only an owner or admin can spend the business wallet." };
  }
  if (!checkSubscribeRateLimit(user.id)) return { error: "You're subscribing too fast. Please slow down." };

  const existing = await db.platformSubscription.findFirst({
    where: {
      subscriberBusinessId: businessId,
      plan: "business_subscription",
      OR: [{ status: "active" }, { status: "cancelled", currentPeriodEnd: { gt: new Date() } }],
    },
  });
  if (existing && !existing.processorSubscriptionId.startsWith("coin:")) {
    return { error: "This business already has an active subscription." };
  }

  const result = await purchaseBusinessPlanWithCoins(businessId, user.id, billingInterval, formData.get("idempotencyKey"));
  if (result.error) return { error: result.error };

  const business = await db.business.findUnique({ where: { id: businessId }, select: { slug: true } });
  if (business) {
    revalidatePath(`/b/${business.slug}/manage/billing`);
    revalidatePath(`/b/${business.slug}/manage/wallet`);
  }
  return { success: true };
}

export async function cancelBusinessSubscriptionAction(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return;

  const subscription = await db.platformSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription?.subscriberBusinessId) return;
  if (!(await isBusinessStaff(subscription.subscriberBusinessId, user.id))) return;

  await cancelPlatformSubscription(subscriptionId);

  const business = await db.business.findUnique({ where: { id: subscription.subscriberBusinessId }, select: { slug: true } });
  if (business) revalidatePath(`/b/${business.slug}/manage`);
}
