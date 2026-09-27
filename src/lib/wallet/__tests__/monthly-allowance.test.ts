import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createUser, createSessionForUser } from "@/test/factories";
import { runMonthlyAllowanceSweepOnce } from "@/lib/wallet/grants";
import { runPromoExpirySweepOnce } from "@/lib/wallet/expiry";
import { getWalletBalance } from "@/lib/wallet/ledger";
import { runWalletReconciliationOnce } from "@/lib/wallet/reconcile";
import { WALLET_LIMITS } from "@/lib/wallet/limits";

const DAY = 24 * 60 * 60 * 1000;
const ALLOWANCE = WALLET_LIMITS.MONTHLY_ALLOWANCE_COINS;

// An account old enough to qualify, optionally with a recent web session.
async function account({ ageDays = 10, webSession = true } = {}) {
  const user = await createUser();
  await db.user.update({ where: { id: user.id }, data: { createdAt: new Date(Date.now() - ageDays * DAY) } });
  if (webSession) await createSessionForUser(user.id);
  return user;
}

const restricted = async (userId: string) => (await getWalletBalance(userId)).restricted;

// addendum-wallet-only-payments.md §4
describe("monthly allowance", () => {
  it("gives an active account its allowance as restricted coins, once per month", async () => {
    const user = await account();

    await runMonthlyAllowanceSweepOnce();
    expect(await restricted(user.id)).toBe(ALLOWANCE);
    expect((await getWalletBalance(user.id)).spendable).toBe(0);

    await runMonthlyAllowanceSweepOnce();
    expect(await restricted(user.id)).toBe(ALLOWANCE);
    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("issues again in the next calendar month", async () => {
    const user = await account();
    const now = new Date();
    await runMonthlyAllowanceSweepOnce(now);
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 2));
    await runMonthlyAllowanceSweepOnce(nextMonth);
    expect(await restricted(user.id)).toBe(2 * ALLOWANCE);
  });

  it("skips accounts that are too new, inactive, or not in good standing", async () => {
    const fresh = await account({ ageDays: 2 });
    const idle = await account({ webSession: false });
    const stale = await account({ webSession: false });
    await createSessionForUser(stale.id);
    await db.session.updateMany({ where: { userId: stale.id }, data: { lastSeenAt: new Date(Date.now() - 40 * DAY) } });
    const suspended = await account();
    await db.user.update({ where: { id: suspended.id }, data: { status: "suspended" } });
    const leaving = await account();
    await db.user.update({ where: { id: leaving.id }, data: { deletionScheduledFor: new Date(Date.now() + 10 * DAY) } });

    await runMonthlyAllowanceSweepOnce();
    for (const u of [fresh, idle, stale, suspended, leaving]) expect(await restricted(u.id)).toBe(0);
  });

  it("counts recent mobile-app use (a fresh OAuth token) as active", async () => {
    const user = await account({ webSession: false });
    const app = await db.developerApp.create({
      data: {
        ownerType: "user",
        ownerUserId: user.id,
        name: "Mobile",
        description: "test",
        clientId: `client_${crypto.randomUUID()}`,
        clientSecretHash: "unused",
        redirectUrisJson: "[]",
      },
    });
    const authorization = await db.oAuthAuthorization.create({ data: { appId: app.id, userId: user.id, grantedScopesJson: "[]" } });
    await db.oAuthToken.create({
      data: { authorizationId: authorization.id, accessTokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + DAY) },
    });

    await runMonthlyAllowanceSweepOnce();
    expect(await restricted(user.id)).toBe(ALLOWANCE);
  });

  it("expires unspent allowance with the other grants", async () => {
    const user = await account({ ageDays: 200 });
    // Issued ~100 days ago, so its 90-day TTL has passed.
    await runMonthlyAllowanceSweepOnce(new Date(Date.now() - 100 * DAY));
    // The past-dated run judged activity against then; the session created
    // today still counts because lastSeenAt >= then − 30 days.
    expect(await restricted(user.id)).toBe(ALLOWANCE);

    await runPromoExpirySweepOnce();
    expect(await restricted(user.id)).toBe(0);
  });
});
