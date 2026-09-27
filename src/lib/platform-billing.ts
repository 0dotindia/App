import "server-only";
import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { spendBusinessCoins, WalletError } from "@/lib/wallet/ledger";
import { chargeWallet } from "@/lib/wallet/charge";
import { SYSTEM_ACCOUNT_IDS } from "@/lib/wallet/accounts";
import { coinsToUnits, coinActionKey } from "@/lib/wallet/limits";
import { logger } from "@/lib/logger";
import { notifySubscriptionRenewalFailed } from "@/lib/notifications";
import { COIN_FUNDED_MARKER, COIN_RENEWAL_GRACE_MS, effectivelyActiveWhere } from "@/lib/subscription-access";

// premium-profiles addendum §7 / platform-billing addendum §6: no finance
// decision on price points exists yet — same "single flat placeholder,
// captured per-row at charge time" posture as payments.ts's
// PLATFORM_FEE_PERCENT, not a guess dressed up as a real price.
export const PLAN_PRICES: Record<string, { monthly: number; yearly: number; currency: string }> = {
  profile_premium: { monthly: 6, yearly: 60, currency: "usd" },
  business_subscription: { monthly: 20, yearly: 200, currency: "usd" },
};

export function priceFor(plan: string, billingInterval: string): { amount: number; currency: string } {
  const price = PLAN_PRICES[plan];
  if (!price) throw new Error(`No price configured for plan "${plan}"`);
  return { amount: billingInterval === "yearly" ? price.yearly : price.monthly, currency: price.currency };
}

// Effective access (subscription-access.ts): a cancelled but not-yet-expired
// subscription still counts (premium-profiles addendum §4.2 / phase-5
// §4.3's cancel-through-period-end rule), as does a coin row in its
// renewal grace period.

export function getActiveProfileSubscription(profileId: string, plan = "profile_premium") {
  return db.platformSubscription.findFirst({
    where: { subscriberProfileId: profileId, plan, ...effectivelyActiveWhere() },
    orderBy: { createdAt: "desc" },
  });
}

export async function isProfilePremium(profileId: string): Promise<boolean> {
  return (await getActiveProfileSubscription(profileId)) !== null;
}

// Reduced creator platform-fee discount (premium-profiles addendum §3.6)
// keys off the creator's own userId, since PaymentTransaction.payeeId is a
// User id, not a Profile id — payments.ts's recordPaymentTransaction calls
// this by userId, not profileId.
export async function isProfilePremiumByUserId(userId: string): Promise<boolean> {
  const subscription = await db.platformSubscription.findFirst({
    where: { plan: "profile_premium", subscriberProfile: { userId }, ...effectivelyActiveWhere() },
    select: { id: true },
  });
  return subscription !== null;
}

export function getActiveBusinessSubscription(businessId: string) {
  return db.platformSubscription.findFirst({
    where: { subscriberBusinessId: businessId, plan: "business_subscription", ...effectivelyActiveWhere() },
    orderBy: { createdAt: "desc" },
  });
}

export async function isBusinessSubscribed(businessId: string): Promise<boolean> {
  return (await getActiveBusinessSubscription(businessId)) !== null;
}

// premium-profiles addendum §3.4 / §5.1: link cap gating and its
// non-destructive downgrade counterpart. Free stays at Phase 1's existing
// 100-link soft cap (profile.ts/business-links.ts); premium raises it
// rather than removing it outright, matching the spec's "raise or remove"
// framing with a generous but still-bounded number.
export const FREE_LINK_CAP = 100;
export const PREMIUM_LINK_CAP = 1000;

export async function linkCapFor(profileId: string): Promise<number> {
  return (await isProfilePremium(profileId)) ? PREMIUM_LINK_CAP : FREE_LINK_CAP;
}

// premium-profiles addendum §3.3: the free tier's analytics query window —
// storage-layer retention is unaffected (link-stats.ts still logs/keeps
// every LinkClick regardless of tier), only how far back the dashboard
// query reaches.
export const FREE_ANALYTICS_WINDOW_DAYS = 30;

// premium-profiles addendum §4.2: only flips status, never touches
// currentPeriodEnd — same shape as memberships.ts's cancelSubscription, so
// the effectively-active check above keeps granting access through the
// current period, and stops the coin auto-renew. A past_due row (renewal
// failed, in grace) can be cancelled too — that stops the sweep retrying.
export async function cancelPlatformSubscription(subscriptionId: string): Promise<void> {
  const subscription = await db.platformSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || (subscription.status !== "active" && subscription.status !== "past_due")) return;
  await db.platformSubscription.update({ where: { id: subscription.id }, data: { status: "cancelled" } });
  if (subscription.subscriberProfileId) await reconcileLinkActivationForProfile(subscription.subscriberProfileId);
}

// Coins are the only way to pay for a PlatformSubscription
// (addendum-wallet-only-payments.md) — every perk (linkCapFor/
// isProfilePremium/analytics window/etc.) reads the same rows. The coin
// cost is the PLAN_PRICES value (addendum-coin-wallet-v2.md §14).
// Marked via a processorSubscriptionId prefix rather than a new column,
// same "string discriminator" shape this schema already uses for
// subscriberType/plan/status (COIN_FUNDED_MARKER, subscription-access.ts).
export { COIN_FUNDED_MARKER };

function addBillingInterval(date: Date, billingInterval: string): Date {
  const next = new Date(date);
  if (billingInterval === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

// Renews by extending the existing row (early renewal just pushes
// currentPeriodEnd out further) rather than stacking a new row per
// purchase.
// Sentinel thrown inside the transaction below to short-circuit on
// insufficient balance without committing the partial debit — caught right
// outside and turned back into the ActionState-shaped error the callers
// expect.
class InsufficientCoinsError extends Error {}

export async function purchaseProfilePremiumWithCoins(userId: string, profileId: string, billingInterval: string, idempotencyToken?: unknown): Promise<{ error?: string }> {
  const { amount: coinCost } = priceFor("profile_premium", billingInterval);
  const existing = await getActiveProfileSubscription(profileId);

  try {
    // Debit and subscription row must land together — a crash between the
    // two (e.g. process restart) must never leave a user's coins spent with
    // no subscription to show for it, same posture as
    await db.$transaction(async (tx) => {
      // §14: routed through chargeWallet with no external payee, so 0dot is
      // the payee and the whole amount is platform revenue — and the coin
      // spend gets a PaymentTransaction (processor "wallet") like any sale.
      let charge;
      try {
        charge = await chargeWallet(tx, {
          payerId: userId,
          amountUsd: coinCost,
          currency: "usd",
          kind: "platform_subscription_charge",
          relatedObjectType: "platform_subscription",
          idempotencyKey: coinActionKey("premium_purchase", idempotencyToken, userId, billingInterval),
        });
      } catch (err) {
        if (err instanceof WalletError && err.code === "INSUFFICIENT_FUNDS") {
          throw new InsufficientCoinsError();
        }
        throw err;
      }
      if (charge.alreadySettled) return; // double-click — the first click already applied the period

      if (existing) {
        await tx.platformSubscription.update({
          where: { id: existing.id },
          // Buying again re-opts into auto-renew, including on a row the
          // payer had cancelled or that is past_due in its grace period.
          data: { currentPeriodEnd: addBillingInterval(existing.currentPeriodEnd, billingInterval), billingInterval, status: "active", autoRenew: true },
        });
      } else {
        await tx.platformSubscription.create({
          data: {
            subscriberType: "profile",
            subscriberProfileId: profileId,
            plan: "profile_premium",
            status: "active",
            billingInterval,
            processorSubscriptionId: `${COIN_FUNDED_MARKER}${randomUUID()}`,
            currentPeriodEnd: addBillingInterval(new Date(), billingInterval),
            autoRenew: true,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) return { error: `You need ${coinCost} coins for this plan.` };
    throw err;
  }

  await reconcileLinkActivationForProfile(profileId);
  return {};
}

// Kept for the wallet UI's disabled-state hint until PurchaseVipForm is
// updated to take the real per-interval price directly.
export function premiumCoinPrice(billingInterval = "monthly"): number {
  return priceFor("profile_premium", billingInterval).amount;
}

// addendum-coin-wallet-v2.md §6.5 — the business-wallet counterpart of
// purchaseProfilePremiumWithCoins: a business buys its own 0dot business
// subscription with coins from its business_wallet. Owner/admin-gated by
// the caller (subscribeBusinessWithCoinsAction). Renewal is a fresh coin
// charge; the coin-subscription lapse sweep ends it if the period elapses.
export async function purchaseBusinessPlanWithCoins(
  businessId: string,
  actorUserId: string,
  billingInterval: string,
  idempotencyToken?: unknown,
): Promise<{ error?: string }> {
  const { amount: coinCost } = priceFor("business_subscription", billingInterval);
  const existing = await getActiveBusinessSubscription(businessId);

  try {
    await db.$transaction(async (tx) => {
      let spend;
      try {
        spend = await spendBusinessCoins(tx, {
          businessId,
          units: coinsToUnits(coinCost),
          creditAccountId: SYSTEM_ACCOUNT_IDS.system_platform_revenue,
          kind: "purchase",
          idempotencyKey: coinActionKey("business_plan:coin", idempotencyToken, businessId, billingInterval),
          actorUserId,
          relatedObjectType: "platform_subscription",
          memo: "Business subscription (coins)",
        });
      } catch (err) {
        if (err instanceof WalletError && err.code === "INSUFFICIENT_FUNDS") throw new InsufficientCoinsError();
        throw err;
      }
      if (!spend.created) return; // double-click — first click already applied the period

      if (existing) {
        await tx.platformSubscription.update({
          where: { id: existing.id },
          // Buying again re-opts into auto-renew, including on a row the
          // payer had cancelled or that is past_due in its grace period.
          data: { currentPeriodEnd: addBillingInterval(existing.currentPeriodEnd, billingInterval), billingInterval, status: "active", autoRenew: true },
        });
      } else {
        await tx.platformSubscription.create({
          data: {
            subscriberType: "business",
            subscriberBusinessId: businessId,
            plan: "business_subscription",
            status: "active",
            billingInterval,
            processorSubscriptionId: `${COIN_FUNDED_MARKER}${randomUUID()}`,
            currentPeriodEnd: addBillingInterval(new Date(), billingInterval),
            autoRenew: true,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof InsufficientCoinsError) {
      return { error: `This business's wallet needs ${coinCost} coins for this plan.` };
    }
    throw err;
  }

  return {};
}

// premium-profiles addendum §5: excess links are marked inactive (never
// deleted) when a profile drops out of premium, and reactivated instantly
// on resubscription — called both right after subscribe() above and from
// the scheduler sweep below for lapses that happen passively (period end
// elapsing with no explicit cancel-then-resubscribe action).
export async function reconcileLinkActivationForProfile(profileId: string): Promise<void> {
  const cap = await linkCapFor(profileId);
  const links = await db.link.findMany({ where: { profileId }, orderBy: { position: "asc" }, select: { id: true, isActive: true } });

  const toActivate = links.slice(0, cap).filter((l) => !l.isActive).map((l) => l.id);
  const toDeactivate = links.slice(cap).filter((l) => l.isActive).map((l) => l.id);

  if (toActivate.length) await db.link.updateMany({ where: { id: { in: toActivate } }, data: { isActive: true } });
  if (toDeactivate.length) await db.link.updateMany({ where: { id: { in: toDeactivate } }, data: { isActive: false } });
}

// Sweeps every profile whose link count exceeds the free cap and who isn't
// currently premium (catches passive lapses — a subscription reaching
// currentPeriodEnd with no explicit cancel/resubscribe action in between,
// which nothing else would otherwise notice) and every currently-premium
// profile with links still marked inactive from a past downgrade (catches
// resubscription after a lapse that the subscribe() call above didn't
// itself trigger, e.g. the processor reactivating a past_due subscription).
async function sweepLinkActivation(): Promise<void> {
  const candidateProfileIds = await db.profile.findMany({
    where: {
      OR: [
        { links: { some: { position: { gte: FREE_LINK_CAP }, isActive: true } } },
        { links: { some: { isActive: false } } },
      ],
    },
    select: { id: true },
  });
  for (const { id } of candidateProfileIds) await reconcileLinkActivationForProfile(id);
}

// effectivelyActiveWhere trusts a bare "active" status without re-checking
// currentPeriodEnd, so without this sweep a non-renewing coin row would
// grant Premium forever: status
// stays "active" past currentPeriodEnd and effectivelyActive keeps counting
// it. This is the coin-rail's only "period ended" signal, so it must run
// before sweepLinkActivation each tick (which relies on status already
// reflecting the lapse to know which profiles need their links deactivated).
// Auto-renewing rows are left to renewCoinPlatformSubscriptions, which
// ends them itself once a failed renewal's grace period runs out.
async function expireLapsedCoinSubscriptions(): Promise<void> {
  const lapsed = await db.platformSubscription.findMany({
    where: { status: "active", autoRenew: false, processorSubscriptionId: { startsWith: COIN_FUNDED_MARKER }, currentPeriodEnd: { lt: new Date() } },
    select: { id: true, subscriberProfileId: true },
  });
  if (!lapsed.length) return;

  await db.platformSubscription.updateMany({
    where: { id: { in: lapsed.map((s) => s.id) } },
    data: { status: "cancelled" },
  });
  for (const { subscriberProfileId } of lapsed) {
    if (subscriberProfileId) await reconcileLinkActivationForProfile(subscriberProfileId);
  }
}

// addendum-coin-wallet-v2.md §6.3 — the coin-membership equivalent of
// expireLapsedCoinSubscriptions. A non-renewing coin-funded
// MembershipSubscription (processorSubscriptionId "coin:…") has nothing
// else to advance it, so this is its sole "period ended" signal: flip it
// to "cancelled" once currentPeriodEnd passes, ending gated access.
async function expireLapsedCoinMemberships(): Promise<void> {
  await db.membershipSubscription.updateMany({
    where: {
      status: "active",
      autoRenew: false,
      processorSubscriptionId: { startsWith: COIN_FUNDED_MARKER },
      currentPeriodEnd: { lt: new Date() },
    },
    data: { status: "cancelled" },
  });
}

// addendum-wallet-only-payments.md §3.3 — coin auto-renew. A due row
// (autoRenew, active or past_due, currentPeriodEnd reached) is charged one
// period from its payer's wallet and advanced in the same transaction. The
// idempotency key is pinned to the period being paid for, so overlapping
// sweeps can never charge one period twice. A failed charge moves an active
// row to past_due (access kept for COIN_RENEWAL_GRACE_MS, payer notified
// once); a past_due row is retried each tick and cancelled when grace ends.
// currentPeriodEnd is not moved while past_due, so a late success still
// pays from the original boundary.
type RenewalCharge = (tx: Prisma.TransactionClient, idempotencyKey: string) => Promise<boolean>; // true = charged now, false = idempotency hit

async function renewOrLapse(params: {
  row: { id: string; status: string; currentPeriodEnd: Date };
  model: "platform" | "membership";
  now: Date;
  charge: RenewalCharge;
  advance: (tx: Prisma.TransactionClient) => Promise<void>;
  markStatus: (status: "past_due" | "cancelled") => Promise<void>;
  notify: () => Promise<void>;
}): Promise<"renewed" | "past_due" | "lapsed" | "unchanged"> {
  const { row } = params;
  const idempotencyKey = `renew:${params.model}:${row.id}:${row.currentPeriodEnd.toISOString()}`;
  try {
    const charged = await db.$transaction(async (tx) => {
      const created = await params.charge(tx, idempotencyKey);
      if (created) await params.advance(tx);
      return created;
    });
    return charged ? "renewed" : "unchanged";
  } catch (err) {
    if (!(err instanceof WalletError && err.code === "INSUFFICIENT_FUNDS")) throw err;
  }

  if (row.status === "active") {
    await params.markStatus("past_due");
    await params.notify();
    return "past_due";
  }
  if (row.currentPeriodEnd.getTime() + COIN_RENEWAL_GRACE_MS <= params.now.getTime()) {
    await params.markStatus("cancelled");
    return "lapsed";
  }
  return "unchanged";
}

const dueForCoinRenewal = (now: Date) => ({
  autoRenew: true,
  status: { in: ["active", "past_due"] },
  processorSubscriptionId: { startsWith: COIN_FUNDED_MARKER },
  currentPeriodEnd: { lte: now },
});

async function renewCoinPlatformSubscriptions(now: Date): Promise<void> {
  const due = await db.platformSubscription.findMany({
    where: dueForCoinRenewal(now),
    include: {
      subscriberProfile: { select: { userId: true, user: { select: { status: true } } } },
      subscriberBusiness: { select: { slug: true, members: { where: { role: "owner" }, select: { userId: true } } } },
    },
  });

  for (const sub of due) {
    try {
      const { amount } = priceFor(sub.plan, sub.billingInterval);
      const profile = sub.subscriberProfile;
      const business = sub.subscriberBusiness;
      // Never charge a suspended/deactivated account — stop renewing and let
      // expireLapsedCoinSubscriptions end the row like a one-off purchase.
      if ((!profile && !business) || (profile && profile.user.status !== "active")) {
        await db.platformSubscription.update({ where: { id: sub.id }, data: { autoRenew: false, status: "active" } });
        continue;
      }

      const outcome = await renewOrLapse({
        row: sub,
        model: "platform",
        now,
        charge: async (tx, idempotencyKey) => {
          if (business) {
            const spend = await spendBusinessCoins(tx, {
              businessId: sub.subscriberBusinessId!,
              units: coinsToUnits(amount),
              creditAccountId: SYSTEM_ACCOUNT_IDS.system_platform_revenue,
              kind: "purchase",
              idempotencyKey,
              relatedObjectType: "platform_subscription",
              relatedObjectId: sub.id,
              memo: "Business subscription renewal (coins)",
            });
            return spend.created;
          }
          const charge = await chargeWallet(tx, {
            payerId: profile!.userId,
            amountUsd: amount,
            currency: "usd",
            kind: "platform_subscription_charge",
            relatedObjectType: "platform_subscription",
            relatedObjectId: sub.id,
            idempotencyKey,
          });
          return !charge.alreadySettled;
        },
        advance: async (tx) => {
          await tx.platformSubscription.update({
            where: { id: sub.id },
            data: { status: "active", currentPeriodEnd: addBillingInterval(sub.currentPeriodEnd, sub.billingInterval) },
          });
        },
        markStatus: async (status) => {
          await db.platformSubscription.update({ where: { id: sub.id }, data: { status } });
        },
        notify: async () => {
          if (business) {
            for (const { userId } of business.members) {
              await notifySubscriptionRenewalFailed({ recipientId: userId, path: `b/${business.slug}/manage/wallet` });
            }
          } else {
            await notifySubscriptionRenewalFailed({ recipientId: profile!.userId, path: "wallet" });
          }
        },
      });
      if (outcome !== "unchanged" && sub.subscriberProfileId) await reconcileLinkActivationForProfile(sub.subscriberProfileId);
    } catch (err) {
      logger.error("coin renewal: platform subscription failed", err, { subscriptionId: sub.id });
    }
  }
}

async function renewCoinMemberships(now: Date): Promise<void> {
  const due = await db.membershipSubscription.findMany({
    where: dueForCoinRenewal(now),
    include: {
      tier: { select: { id: true, creatorId: true, price: true, currency: true, billingInterval: true, status: true } },
      fan: { select: { status: true } },
    },
  });

  for (const sub of due) {
    try {
      // A retired tier or an inactive fan account stops renewing; the row
      // then ends at period end via expireLapsedCoinMemberships.
      if (sub.tier.status !== "active" || sub.fan.status !== "active") {
        await db.membershipSubscription.update({ where: { id: sub.id }, data: { autoRenew: false, status: "active" } });
        continue;
      }

      await renewOrLapse({
        row: sub,
        model: "membership",
        now,
        charge: async (tx, idempotencyKey) => {
          const charge = await chargeWallet(tx, {
            payerId: sub.fanId,
            payeeUserId: sub.tier.creatorId,
            amountUsd: sub.tier.price,
            currency: sub.tier.currency,
            kind: "membership_charge",
            relatedObjectType: "membership_tier",
            relatedObjectId: sub.tier.id,
            idempotencyKey,
          });
          return !charge.alreadySettled;
        },
        advance: async (tx) => {
          await tx.membershipSubscription.update({
            where: { id: sub.id },
            data: { status: "active", currentPeriodEnd: addBillingInterval(sub.currentPeriodEnd, sub.tier.billingInterval) },
          });
        },
        markStatus: async (status) => {
          await db.membershipSubscription.update({ where: { id: sub.id }, data: { status } });
        },
        notify: () => notifySubscriptionRenewalFailed({ recipientId: sub.fanId, path: "wallet" }),
      });
    } catch (err) {
      logger.error("coin renewal: membership failed", err, { subscriptionId: sub.id });
    }
  }
}

const LAPSE_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // frequent enough that a lapsed link cap doesn't stay visible for long, cheap enough given the narrow candidate query above

const globalForPlatformBilling = globalThis as unknown as { platformBillingSchedulerStarted?: boolean };

export function startPlatformBillingScheduler(): void {
  if (globalForPlatformBilling.platformBillingSchedulerStarted) return;
  globalForPlatformBilling.platformBillingSchedulerStarted = true;

  const tick = () => void runPlatformBillingSweepOnce();
  tick();
  setInterval(tick, LAPSE_SWEEP_INTERVAL_MS);
}

// Cron entry point (web-pro-upgrade addendum M1) — see runTrendingRecomputeOnce.
export async function runPlatformBillingSweepOnce(): Promise<void> {
  // Renew first: a row that renews here must not be expired below.
  const now = new Date();
  await renewCoinPlatformSubscriptions(now);
  await renewCoinMemberships(now);
  await expireLapsedCoinSubscriptions();
  await expireLapsedCoinMemberships();
  await sweepLinkActivation();
}
