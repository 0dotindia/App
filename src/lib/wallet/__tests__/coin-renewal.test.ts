import { describe, it, expect, vi, afterEach } from "vitest";
import { db } from "@/lib/db";
import { createUser, createBusiness, addBusinessMember, createSessionForUser, fundWallet, fundBusinessWallet } from "@/test/factories";
import { setSessionCookie } from "@/test/next-test-state";
import {
  purchaseProfilePremiumWithCoins,
  purchaseBusinessPlanWithCoins,
  runPlatformBillingSweepOnce,
  isProfilePremium,
  isBusinessSubscribed,
  COIN_FUNDED_MARKER,
} from "@/lib/platform-billing";
import { subscribeToTier, cancelSubscription } from "@/app/actions/memberships";
import { hasTierAccess } from "@/lib/tier-access";
import { getWalletBalance, getBusinessWalletBalance } from "@/lib/wallet/ledger";
import { runWalletReconciliationOnce } from "@/lib/wallet/reconcile";
import { COIN_RENEWAL_GRACE_MS } from "@/lib/subscription-access";

async function loginAs(userId: string) {
  setSessionCookie(await createSessionForUser(userId));
}
function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
const DAY = 24 * 60 * 60 * 1000;

async function premiumUser(coins: number) {
  const user = await createUser();
  await fundWallet(user.id, coins, "spendable");
  const profile = await db.profile.findUniqueOrThrow({ where: { userId: user.id } });
  expect(await purchaseProfilePremiumWithCoins(user.id, profile.id, "monthly")).toEqual({});
  const sub = await db.platformSubscription.findFirstOrThrow({ where: { subscriberProfileId: profile.id } });
  return { user, profile, sub };
}

function lapse(model: "platform" | "membership", id: string, endedAgoMs = 1000) {
  const data = { currentPeriodEnd: new Date(Date.now() - endedAgoMs) };
  return model === "platform"
    ? db.platformSubscription.update({ where: { id }, data })
    : db.membershipSubscription.update({ where: { id }, data });
}

afterEach(() => {
  vi.useRealTimers();
});

// addendum-wallet-only-payments.md §3.3
describe("coin Premium auto-renew", () => {
  it("is switched on by a coin purchase", async () => {
    const { sub } = await premiumUser(6);
    expect(sub.autoRenew).toBe(true);
  });

  it("charges one period when due and advances from the old boundary", async () => {
    const { user, sub } = await premiumUser(12);
    const lapsed = await lapse("platform", sub.id);

    await runPlatformBillingSweepOnce();

    const renewed = await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(renewed.status).toBe("active");
    const expected = new Date(lapsed.currentPeriodEnd);
    expected.setMonth(expected.getMonth() + 1);
    expect(renewed.currentPeriodEnd.getTime()).toBe(expected.getTime());
    expect((await getWalletBalance(user.id)).spendable).toBe(0);
    expect(await db.paymentTransaction.count({ where: { payerId: user.id, kind: "platform_subscription_charge" } })).toBe(2);

    // Not due any more — a second tick charges nothing.
    await runPlatformBillingSweepOnce();
    expect(await db.paymentTransaction.count({ where: { payerId: user.id, kind: "platform_subscription_charge" } })).toBe(2);
    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("never charges the same period twice, even from a stale read", async () => {
    const { user, sub } = await premiumUser(18);
    const lapsed = await lapse("platform", sub.id);
    await runPlatformBillingSweepOnce();

    // Simulate an overlapping sweep that read the row before it advanced.
    await db.platformSubscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: lapsed.currentPeriodEnd } });
    await runPlatformBillingSweepOnce();

    expect((await getWalletBalance(user.id)).spendable).toBe(6);
    expect(await db.paymentTransaction.count({ where: { payerId: user.id, kind: "platform_subscription_charge" } })).toBe(2);
  });

  it("goes past_due with access and a notification, then cancels after grace", async () => {
    const { user, profile, sub } = await premiumUser(6);
    await lapse("platform", sub.id);

    await runPlatformBillingSweepOnce();
    let row = await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("past_due");
    expect(await isProfilePremium(profile.id)).toBe(true); // grace keeps access
    const notifs = await db.notification.findMany({ where: { recipientId: user.id, type: "subscription_renewal_failed" } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].subjectId).toBe("wallet");

    // Retrying inside grace neither re-notifies nor cancels.
    await runPlatformBillingSweepOnce();
    expect(await db.notification.count({ where: { recipientId: user.id, type: "subscription_renewal_failed" } })).toBe(1);

    await lapse("platform", sub.id, COIN_RENEWAL_GRACE_MS + 1000);
    await runPlatformBillingSweepOnce();
    row = await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("cancelled");
    expect(await isProfilePremium(profile.id)).toBe(false);
  });

  it("recovers from past_due once the wallet can cover the renewal", async () => {
    const { user, sub } = await premiumUser(6);
    await lapse("platform", sub.id);
    await runPlatformBillingSweepOnce();
    expect((await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("past_due");

    await fundWallet(user.id, 6, "spendable");
    await runPlatformBillingSweepOnce();
    const row = await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("active");
    expect(row.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
    expect((await getWalletBalance(user.id)).spendable).toBe(0);
  });

  it("doesn't renew a cancelled row", async () => {
    const { user, sub } = await premiumUser(12);
    await db.platformSubscription.update({ where: { id: sub.id }, data: { status: "cancelled" } });
    await lapse("platform", sub.id);

    await runPlatformBillingSweepOnce();
    expect((await getWalletBalance(user.id)).spendable).toBe(6);
    expect((await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("cancelled");
  });

  it("lets a pre-auto-renew coin row lapse without charging", async () => {
    const { user, profile, sub } = await premiumUser(12);
    await db.platformSubscription.update({ where: { id: sub.id }, data: { autoRenew: false } });
    await lapse("platform", sub.id);

    await runPlatformBillingSweepOnce();
    expect((await getWalletBalance(user.id)).spendable).toBe(6);
    expect((await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("cancelled");
    expect(await isProfilePremium(profile.id)).toBe(false);
  });

  it("stops renewing for a suspended account", async () => {
    const { user, sub } = await premiumUser(12);
    await db.user.update({ where: { id: user.id }, data: { status: "suspended" } });
    await lapse("platform", sub.id);

    await runPlatformBillingSweepOnce();
    expect((await getWalletBalance(user.id)).spendable).toBe(6);
    const row = await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.autoRenew).toBe(false);
    expect(row.status).toBe("cancelled");
  });
});

describe("coin business plan auto-renew", () => {
  it("renews from the business wallet and notifies owners when it can't", async () => {
    const owner = await createUser();
    const business = await createBusiness({ creatorId: owner.id, status: "active" });
    await addBusinessMember(business.id, owner.id, "owner");
    await fundBusinessWallet(business.id, 40, "spendable");
    expect(await purchaseBusinessPlanWithCoins(business.id, owner.id, "monthly")).toEqual({});
    const sub = await db.platformSubscription.findFirstOrThrow({ where: { subscriberBusinessId: business.id } });

    await lapse("platform", sub.id);
    await runPlatformBillingSweepOnce();
    expect((await getBusinessWalletBalance(business.id)).spendable).toBe(0);
    expect((await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("active");

    await lapse("platform", sub.id);
    await runPlatformBillingSweepOnce();
    expect((await db.platformSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("past_due");
    expect(await isBusinessSubscribed(business.id)).toBe(true);
    const notif = await db.notification.findFirstOrThrow({ where: { recipientId: owner.id, type: "subscription_renewal_failed" } });
    expect(notif.subjectId).toBe(`b/${business.slug}/manage/wallet`);
  });
});

describe("coin membership auto-renew", () => {
  async function subscribedFan(coins: number) {
    const fan = await createUser();
    const creator = await createUser();
    await fundWallet(fan.id, coins, "spendable");
    await loginAs(fan.id);
    const tier = await db.membershipTier.create({
      data: { creatorId: creator.id, name: "Supporter", level: 1, price: 6, currency: "usd", billingInterval: "monthly", status: "active" },
    });
    expect((await subscribeToTier(undefined, fd({ tierId: tier.id, payWith: "coins" })))?.success).toBe(true);
    const sub = await db.membershipSubscription.findFirstOrThrow({ where: { tierId: tier.id, fanId: fan.id } });
    return { fan, creator, tier, sub };
  }

  it("renews from the fan's wallet and pays the creator again", async () => {
    const { fan, creator, sub } = await subscribedFan(12);
    expect(sub.autoRenew).toBe(true);
    await lapse("membership", sub.id);

    await runPlatformBillingSweepOnce();
    const row = await db.membershipSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row.status).toBe("active");
    expect(row.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
    expect((await getWalletBalance(fan.id)).spendable).toBe(0);
    expect((await getWalletBalance(creator.id)).spendableUnits).toBe(1080); // 2 × (6 − 10%)
    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("keeps access through grace, then ends it", async () => {
    const { fan, creator, tier, sub } = await subscribedFan(6);
    await lapse("membership", sub.id);

    await runPlatformBillingSweepOnce();
    expect((await db.membershipSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("past_due");
    expect(await hasTierAccess(fan.id, creator.id, tier.id)).toBe(true);

    await lapse("membership", sub.id, COIN_RENEWAL_GRACE_MS + 1000);
    await runPlatformBillingSweepOnce();
    expect((await db.membershipSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("cancelled");
    expect(await hasTierAccess(fan.id, creator.id, tier.id)).toBe(false);
  });

  it("stops renewing once the tier is archived", async () => {
    const { fan, tier, sub } = await subscribedFan(12);
    await db.membershipTier.update({ where: { id: tier.id }, data: { status: "archived" } });
    await lapse("membership", sub.id);

    await runPlatformBillingSweepOnce();
    expect((await getWalletBalance(fan.id)).spendable).toBe(6);
    expect((await db.membershipSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("cancelled");
  });

  // Regression: cancelling a coin membership used to pass its "coin:…" id to
  // Stripe's subscriptions.update, which throws.
  it("cancels a coin membership without touching Stripe, keeping access to period end", async () => {
    const { fan, creator, tier, sub } = await subscribedFan(12);
    expect(sub.processorSubscriptionId.startsWith(COIN_FUNDED_MARKER)).toBe(true);

    await cancelSubscription(fd({ subscriptionId: sub.id }));
    expect((await db.membershipSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("cancelled");
    expect(await hasTierAccess(fan.id, creator.id, tier.id)).toBe(true);

    await lapse("membership", sub.id);
    await runPlatformBillingSweepOnce();
    expect((await getWalletBalance(fan.id)).spendable).toBe(6); // no renewal charge
  });
});

// Regression: the access clause used to be a module-level constant, so its
// "now" was frozen at import time and a cancelled subscription kept granting
// access after its period ended until the server restarted.
describe("effective access uses the current time", () => {
  it("drops a cancelled subscription once its period ends", async () => {
    const { profile, sub } = await premiumUser(6);
    await db.platformSubscription.update({
      where: { id: sub.id },
      data: { status: "cancelled", currentPeriodEnd: new Date(Date.now() + DAY) },
    });
    expect(await isProfilePremium(profile.id)).toBe(true);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * DAY);
    expect(await isProfilePremium(profile.id)).toBe(false);
  });
});
