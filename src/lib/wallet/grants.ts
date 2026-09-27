import "server-only";
import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { postTransaction, WalletError } from "@/lib/wallet/ledger";
import { ensureUserAccounts, ensureBusinessAccounts, SYSTEM_ACCOUNT_IDS } from "@/lib/wallet/accounts";
import { WALLET_LIMITS, coinsToUnits, launchPromoEndsAt } from "@/lib/wallet/limits";
import { notifyCoinsReceived } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { PLATFORM_ACCOUNT_EMAIL } from "@/lib/first-party-apps";

// addendum-coin-wallet-v2.md §7.1 — the audited signup grant. Called from
// auth.ts signup inside the user-creation transaction; the idempotencyKey
// makes it exactly-once for the lifetime of the account. Lands in the
// restricted (promo) bucket with a TTL so a throwaway account can't farm
// transferable coins (§8, fixes #16).
export async function issueSignupGrant(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const { promoId } = await ensureUserAccounts(tx, userId);
  const units = coinsToUnits(WALLET_LIMITS.SIGNUP_GRANT_COINS);
  const expiresAt = new Date(
    Date.now() + WALLET_LIMITS.SIGNUP_GRANT_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await postTransaction(tx, {
    kind: "signup_grant",
    idempotencyKey: `signup_grant:${userId}`,
    memo: "Signup bonus",
    expiresAt,
    postings: [
      { accountId: SYSTEM_ACCOUNT_IDS.system_promo_issuance, amount: -units },
      { accountId: promoId, amount: units },
    ],
  });
}

// addendum-coin-wallet-v2.md §8.1 — the launch promo. Called from auth.ts
// signup in the same transaction as issueSignupGrant, for accounts created
// before the (env-overridable) window closes. One extra restricted,
// expiring promo_grant of LAUNCH_PROMO_COINS (= one month of Premium), so
// early adopters can reach Premium before the earning paths ramp up.
export async function issueLaunchPromoIfEligible(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  if (Date.now() >= launchPromoEndsAt().getTime()) return;

  const { promoId } = await ensureUserAccounts(tx, userId);
  const units = coinsToUnits(WALLET_LIMITS.LAUNCH_PROMO_COINS);
  const expiresAt = new Date(Date.now() + WALLET_LIMITS.LAUNCH_PROMO_TTL_DAYS * 24 * 60 * 60 * 1000);

  await postTransaction(tx, {
    kind: "promo_grant",
    idempotencyKey: `launch_promo:${userId}`,
    memo: "launch",
    expiresAt,
    postings: [
      { accountId: SYSTEM_ACCOUNT_IDS.system_promo_issuance, amount: -units },
      { accountId: promoId, amount: units },
    ],
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWANCE_PAGE_SIZE = 500;

// addendum-wallet-only-payments.md §4 — the monthly allowance, from the
// daily cron. Every eligible account without this month's allowance gets
// it, so one that becomes active mid-month is picked up the next day. The
// idempotency key allows one per account per calendar month (UTC), so a
// rerun or an overlapping cron is a no-op. Eligible = active status, no
// pending deletion, old enough, and a web session seen or a first-party
// app token issued (tokens refresh while the mobile app is in use)
// recently. Third-party apps don't count: their servers can refresh a
// token with the user never opening 0dot.
//
// `deadline` (epoch ms) stops the sweep cleanly before the calling cron
// function's time limit; it logs as incomplete and the next run (hourly
// and daily cron both call this) picks up the rest, since issuing is
// idempotent. Without it the platform could kill the run mid-page with
// nothing logged.
export async function runMonthlyAllowanceSweepOnce(now: Date = new Date(), { deadline }: { deadline?: number } = {}) {
  const month = now.toISOString().slice(0, 7); // yyyy-mm
  const activeSince = new Date(now.getTime() - WALLET_LIMITS.MONTHLY_ALLOWANCE_ACTIVE_WITHIN_DAYS * DAY_MS);
  const createdBefore = new Date(now.getTime() - WALLET_LIMITS.MONTHLY_ALLOWANCE_MIN_ACCOUNT_AGE_DAYS * DAY_MS);
  const expiresAt = new Date(now.getTime() + WALLET_LIMITS.MONTHLY_ALLOWANCE_TTL_DAYS * DAY_MS);
  const units = coinsToUnits(WALLET_LIMITS.MONTHLY_ALLOWANCE_COINS);
  const keyFor = (userId: string) => `monthly_allowance:${userId}:${month}`;

  const outOfTime = () => deadline !== undefined && Date.now() >= deadline;
  let issued = 0;
  let complete = true;
  let cursor: string | undefined;
  sweep: for (;;) {
    if (outOfTime()) {
      complete = false;
      break;
    }
    const users = await db.user.findMany({
      where: {
        status: "active",
        deletionScheduledFor: null,
        createdAt: { lte: createdBefore },
        // Keyset paging, not a Prisma cursor: a cursor row deleted between
        // pages makes the next page come back empty and ends the sweep.
        ...(cursor ? { id: { gt: cursor } } : {}),
        OR: [
          { sessions: { some: { lastSeenAt: { gte: activeSince } } } },
          {
            oauthAuthorizations: {
              some: {
                status: "active",
                app: { ownerUser: { email: PLATFORM_ACCOUNT_EMAIL } },
                tokens: { some: { createdAt: { gte: activeSince } } },
              },
            },
          },
        ],
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: ALLOWANCE_PAGE_SIZE,
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1].id;

    const alreadyIssued = new Set(
      (
        await db.ledgerTransaction.findMany({
          where: { idempotencyKey: { in: users.map((u) => keyFor(u.id)) } },
          select: { idempotencyKey: true },
        })
      ).map((t) => t.idempotencyKey),
    );

    for (const { id } of users) {
      if (alreadyIssued.has(keyFor(id))) continue;
      if (outOfTime()) {
        complete = false;
        break sweep;
      }
      try {
        const { created } = await db.$transaction(async (tx) => {
          const { promoId } = await ensureUserAccounts(tx, id);
          return postTransaction(tx, {
            kind: "monthly_allowance",
            idempotencyKey: keyFor(id),
            memo: `Monthly allowance ${month}`,
            expiresAt,
            postings: [
              { accountId: SYSTEM_ACCOUNT_IDS.system_promo_issuance, amount: -units },
              { accountId: promoId, amount: units },
            ],
          });
        });
        if (created) issued += 1;
      } catch (err) {
        logger.error("monthly-allowance: failed to issue", err, { userId: id, month });
      }
    }
    if (users.length < ALLOWANCE_PAGE_SIZE) break;
  }

  const result = { month, issued, complete };
  if (complete) logger.info("monthly-allowance: swept", undefined, result);
  else logger.warn("monthly-allowance: stopped at the time budget; the next run continues", undefined, result);
  return result;
}

export type GrantResult = { ok: true } | { error: string };

// addendum-coin-wallet-v2.md §7.4 — a promo/campaign grant into a user's or
// a business's RESTRICTED bucket, drawn from system_promo_issuance, with an
// optional TTL. Audited (kind promo_grant, actorUserId + memo required).
export async function issuePromoGrant(params: {
  actorAdminId: string;
  targetUserId?: string;
  targetBusinessId?: string;
  coins: number;
  reason: string;
  expiresInDays?: number | null;
}): Promise<GrantResult> {
  const guard = await guardIssuance(params.actorAdminId, params.coins, params.reason);
  if (guard) return { error: guard };
  const units = coinsToUnits(params.coins);
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  await db.$transaction(async (tx) => {
    const promoId = params.targetBusinessId
      ? (await ensureBusinessAccounts(tx, params.targetBusinessId)).promoId
      : (await ensureUserAccounts(tx, params.targetUserId!)).promoId;
    await postTransaction(tx, {
      kind: "promo_grant",
      idempotencyKey: `promo_grant:${randomUUID()}`,
      actorUserId: params.actorAdminId,
      memo: params.reason,
      expiresAt,
      postings: [
        { accountId: SYSTEM_ACCOUNT_IDS.system_promo_issuance, amount: -units },
        { accountId: promoId, amount: units },
      ],
    });
  });

  if (params.targetUserId) {
    await notifyCoinsReceived({ recipientId: params.targetUserId, actorId: params.actorAdminId });
  }
  return { ok: true };
}

// §7.4 — support goodwill / corrections. Credits the SPENDABLE bucket
// (unlike a promo grant) so it behaves like earned coins; negative `coins`
// is a correction that debits it (guarded non-negative by postTransaction).
export async function adminAdjust(params: {
  actorAdminId: string;
  targetUserId?: string;
  targetBusinessId?: string;
  coins: number;
  reason: string;
}): Promise<GrantResult> {
  const guard = await guardIssuance(params.actorAdminId, Math.abs(params.coins), params.reason);
  if (guard) return { error: guard };
  if (params.coins === 0) return { error: "Amount can't be zero." };
  const units = coinsToUnits(Math.abs(params.coins));
  const sign = params.coins > 0 ? 1 : -1;

  try {
    await db.$transaction(async (tx) => {
      const walletId = params.targetBusinessId
        ? (await ensureBusinessAccounts(tx, params.targetBusinessId)).walletId
        : (await ensureUserAccounts(tx, params.targetUserId!)).walletId;
      await postTransaction(tx, {
        kind: "admin_adjustment",
        idempotencyKey: `admin_adjustment:${randomUUID()}`,
        actorUserId: params.actorAdminId,
        memo: params.reason,
        postings: [
          { accountId: walletId, amount: sign * units },
          { accountId: SYSTEM_ACCOUNT_IDS.system_promo_issuance, amount: -sign * units },
        ],
      });
    });
  } catch (err) {
    if (err instanceof WalletError && err.code === "INSUFFICIENT_FUNDS") {
      return { error: "That correction would overdraw the account." };
    }
    throw err;
  }

  if (sign > 0 && params.targetUserId) {
    await notifyCoinsReceived({ recipientId: params.targetUserId, actorId: params.actorAdminId });
  }
  return { ok: true };
}

// §11.3 — a per-admin daily coin cap, a required reason, and a hard ceiling
// (the dual-control threshold) above which the self-serve tool refuses.
async function guardIssuance(adminId: string, coins: number, reason: string): Promise<string | null> {
  if (!Number.isFinite(coins) || coins <= 0) return "Enter a positive coin amount.";
  if (!reason || reason.trim().length < 3) return "A reason is required.";
  if (coins > WALLET_LIMITS.ADMIN_ADJUST_DUAL_CONTROL_THRESHOLD_COINS) {
    return `Amounts over ${WALLET_LIMITS.ADMIN_ADJUST_DUAL_CONTROL_THRESHOLD_COINS} coins need finance sign-off — they can't be issued from this tool.`;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todays = await db.ledgerTransaction.findMany({
    where: {
      actorUserId: adminId,
      kind: { in: ["promo_grant", "admin_adjustment"] },
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  // GROSS coin movement, both directions: `SUM(ABS(amount))`, not the net.
  // A downward correction must NOT refund cap headroom (that would let an
  // admin churn issue→correct→issue past the cap), and it's also worth
  // bounding how much a single admin can claw back per day.
  const issuancePostings = await db.ledgerPosting.findMany({
    where: {
      transactionId: { in: todays.map((t) => t.id) },
      accountId: SYSTEM_ACCOUNT_IDS.system_promo_issuance,
    },
    select: { amount: true },
  });
  const movedTodayCoins =
    issuancePostings.reduce((s, p) => s + Math.abs(p.amount), 0) / WALLET_LIMITS.COIN_UNIT;
  if (movedTodayCoins + coins > WALLET_LIMITS.ADMIN_ADJUST_MAX_COINS_PER_ADMIN_PER_DAY) {
    return `That would pass your ${WALLET_LIMITS.ADMIN_ADJUST_MAX_COINS_PER_ADMIN_PER_DAY}-coin daily issuance cap.`;
  }
  return null;
}
