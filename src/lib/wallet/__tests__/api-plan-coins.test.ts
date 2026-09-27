import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createUser, createBusiness, addBusinessMember, createSessionForUser, fundWallet, fundBusinessWallet } from "@/test/factories";
import { setSessionCookie } from "@/test/next-test-state";
import { updateBillingPlan } from "@/app/actions/developer-apps";
import { runApiUsageBillingSweepOnce } from "@/lib/api-usage-billing";
import { getWalletBalance, getBusinessWalletBalance } from "@/lib/wallet/ledger";
import { runWalletReconciliationOnce } from "@/lib/wallet/reconcile";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function loginAs(userId: string) {
  setSessionCookie(await createSessionForUser(userId));
}
function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function createApp(owner: { ownerUserId?: string; ownerBusinessId?: string }) {
  return db.developerApp.create({
    data: {
      ownerType: owner.ownerBusinessId ? "business" : "user",
      ...owner,
      name: "Billing Test App",
      description: "test",
      clientId: `client_${crypto.randomUUID()}`,
      clientSecretHash: "unused",
      redirectUrisJson: "[]",
    },
  });
}

function recordUsage(appId: string, windowStart: Date, requestCount: number) {
  return db.apiUsageCounter.create({ data: { appId, windowStart, requestCount } });
}

const app = (id: string) => db.developerApp.findUniqueOrThrow({ where: { id } });

// addendum-wallet-only-payments.md §3.4
describe("committed API plan in coins", () => {
  it("charges the first period up front when chosen", async () => {
    const owner = await createUser();
    await fundWallet(owner.id, 60, "spendable");
    await loginAs(owner.id);
    const a = await createApp({ ownerUserId: owner.id });

    const result = await updateBillingPlan(undefined, fd({ appId: a.id, billingPlan: "committed" }));
    expect(result).toEqual({ success: true });
    expect((await app(a.id)).billingPlan).toBe("committed");
    expect((await getWalletBalance(owner.id)).spendable).toBe(11);
    const pt = await db.paymentTransaction.findFirstOrThrow({ where: { payerId: owner.id, kind: "api_usage_charge" } });
    expect(pt.processor).toBe("wallet");
    expect(pt.amount).toBe(49);
  });

  it("refuses the switch when the wallet is short, leaving the plan alone", async () => {
    const owner = await createUser();
    await fundWallet(owner.id, 10, "spendable");
    await loginAs(owner.id);
    const a = await createApp({ ownerUserId: owner.id });

    const result = await updateBillingPlan(undefined, fd({ appId: a.id, billingPlan: "committed" }));
    expect(result?.error).toMatch(/49 coins/);
    expect((await app(a.id)).billingPlan).toBe("free");
    expect((await getWalletBalance(owner.id)).spendable).toBe(10);
  });

  it("renews each period, and drops to free with a notification when it can't", async () => {
    const owner = await createUser();
    await fundWallet(owner.id, 98, "spendable");
    await loginAs(owner.id);
    const a = await createApp({ ownerUserId: owner.id });
    await updateBillingPlan(undefined, fd({ appId: a.id, billingPlan: "committed" }));

    const periodStart = new Date(Date.now() - 31 * DAY);
    await db.developerApp.update({ where: { id: a.id }, data: { lastBilledAt: periodStart } });
    await runApiUsageBillingSweepOnce();
    expect((await getWalletBalance(owner.id)).spendable).toBe(0);
    expect((await app(a.id)).lastBilledAt!.getTime()).toBe(periodStart.getTime() + 30 * DAY);

    // Re-running within the new period charges nothing.
    await runApiUsageBillingSweepOnce();
    expect(await db.paymentTransaction.count({ where: { payerId: owner.id, kind: "api_usage_charge" } })).toBe(2);

    // Rewinding to the *same* period is an idempotency replay (never charged
    // twice), so move to a different overdue period, which the empty wallet
    // can't cover.
    await db.developerApp.update({ where: { id: a.id }, data: { lastBilledAt: new Date(Date.now() - 40 * DAY) } });
    await runApiUsageBillingSweepOnce();
    expect((await app(a.id)).billingPlan).toBe("free");
    const notif = await db.notification.findFirstOrThrow({ where: { recipientId: owner.id, type: "api_plan_downgraded" } });
    expect(notif.subjectId).toBe(a.id);
    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("bills a business-owned app from the business wallet", async () => {
    const owner = await createUser();
    const business = await createBusiness({ creatorId: owner.id, status: "active" });
    await addBusinessMember(business.id, owner.id, "owner");
    await fundBusinessWallet(business.id, 50, "spendable");
    await loginAs(owner.id);
    const a = await createApp({ ownerBusinessId: business.id });

    expect(await updateBillingPlan(undefined, fd({ appId: a.id, billingPlan: "committed" }))).toEqual({ success: true });
    expect((await getBusinessWalletBalance(business.id)).spendable).toBe(1);
    expect((await getWalletBalance(owner.id)).spendable).toBe(0);
  });
});

describe("pay-as-you-go API plan in coins", () => {
  async function paygApp(coins: number) {
    const owner = await createUser();
    if (coins > 0) await fundWallet(owner.id, coins, "spendable");
    await loginAs(owner.id);
    const a = await createApp({ ownerUserId: owner.id });
    expect(await updateBillingPlan(undefined, fd({ appId: a.id, billingPlan: "pay_as_you_go" }))).toEqual({ success: true });
    // Start the period a little in the past so usage can be recorded inside it.
    const periodStart = new Date(Date.now() - 2 * DAY);
    await db.developerApp.update({ where: { id: a.id }, data: { lastBilledAt: periodStart } });
    return { owner, a, periodStart };
  }

  it("charges nothing up front", async () => {
    const { owner } = await paygApp(5);
    expect((await getWalletBalance(owner.id)).spendable).toBe(5);
  });

  it("charges overage in whole blocks as it accrues, never twice", async () => {
    const { owner, a, periodStart } = await paygApp(5);
    await recordUsage(a.id, new Date(periodStart.getTime() + HOUR), 12_500); // 2,500 over the included 10,000

    await runApiUsageBillingSweepOnce();
    expect((await app(a.id)).billedOverageRequests).toBe(2000);
    expect((await getWalletBalance(owner.id)).spendable).toBe(4); // 2 blocks × 0.5 coins

    await runApiUsageBillingSweepOnce();
    expect((await getWalletBalance(owner.id)).spendable).toBe(4);

    await recordUsage(a.id, new Date(periodStart.getTime() + 2 * HOUR), 600); // 3,100 over
    await runApiUsageBillingSweepOnce();
    expect((await app(a.id)).billedOverageRequests).toBe(3000);
    expect((await getWalletBalance(owner.id)).spendable).toBe(3.5);
    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("charges the partial remainder when the period closes and starts a new one", async () => {
    const owner = await createUser();
    await fundWallet(owner.id, 5, "spendable");
    await loginAs(owner.id);
    const a = await createApp({ ownerUserId: owner.id });
    await updateBillingPlan(undefined, fd({ appId: a.id, billingPlan: "pay_as_you_go" }));
    const periodStart = new Date(Date.now() - 31 * DAY);
    await db.developerApp.update({ where: { id: a.id }, data: { lastBilledAt: periodStart } });
    await recordUsage(a.id, new Date(periodStart.getTime() + HOUR), 12_345); // 2,345 over

    await runApiUsageBillingSweepOnce();
    const row = await app(a.id);
    expect(row.lastBilledAt!.getTime()).toBe(periodStart.getTime() + 30 * DAY);
    expect(row.billedOverageRequests).toBe(0);
    expect((await getWalletBalance(owner.id)).spendableUnits).toBe(500 - 118); // ceil(2345 × 0.05 units)
  });

  it("settles usage so far when leaving the plan", async () => {
    const { owner, a, periodStart } = await paygApp(5);
    await recordUsage(a.id, new Date(periodStart.getTime() + HOUR), 10_400); // 400 over, below one block

    expect(await updateBillingPlan(undefined, fd({ appId: a.id, billingPlan: "free" }))).toEqual({ success: true });
    expect((await app(a.id)).billingPlan).toBe("free");
    expect((await getWalletBalance(owner.id)).spendableUnits).toBe(480); // 400 × 0.05 units
  });

  it("drops to free with a notification when overage can't be paid", async () => {
    const { owner, a, periodStart } = await paygApp(0);
    await recordUsage(a.id, new Date(periodStart.getTime() + HOUR), 14_000);

    await runApiUsageBillingSweepOnce();
    expect((await app(a.id)).billingPlan).toBe("free");
    expect(await db.notification.count({ where: { recipientId: owner.id, type: "api_plan_downgraded" } })).toBe(1);
  });
});
