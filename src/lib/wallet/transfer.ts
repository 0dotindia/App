import "server-only";
import { db } from "@/lib/db";
import { postTransaction, getWalletBalance, WalletError } from "@/lib/wallet/ledger";
import { ensureUserAccounts } from "@/lib/wallet/accounts";
import { coinsToUnits } from "@/lib/wallet/limits";
import { notifyCoinsReceived } from "@/lib/notifications";
import { checkTransferEligibility, checkTransferVelocity } from "@/lib/wallet/eligibility";

// addendum-coin-wallet-v2.md §5.2 — the shared core behind both
// actions/wallet.ts and /api/v1/wallet/transfer (fixes the auth-shape
// inconsistency, #9). Recipient resolution and rate limiting stay in the
// callers; this owns the money movement.
//
// The transfer debits the SPENDABLE (user_wallet) bucket only — user_promo
// is never a transfer source (§8, fixes #16).
export async function transferCoinsCore(params: {
  fromUserId: string;
  toUserId: string;
  coins: number;
  idempotencyKey: string;
}): Promise<{ ok: true } | { error: string }> {
  const units = coinsToUnits(params.coins);

  const eligibilityError = await checkTransferEligibility(params.fromUserId, params.toUserId);
  if (eligibilityError) return { error: eligibilityError };

  let outcome: "created" | "replayed" | { error: string };
  try {
    outcome = await db.$transaction(async (tx) => {
      // ensureUserAccounts runs BEFORE the velocity check, not after —
      // its upsert() is a real write statement, so it's what actually
      // acquires SQLite/libSQL's single-writer lock for this transaction.
      // A concurrent transfer's own ensureUserAccounts call blocks on that
      // same lock until this transaction commits, so by the time it
      // resumes and runs ITS velocity check, it sees this transfer's
      // just-committed CoinTransfer row. Checking velocity first (the
      // previous order) ran that SELECT before any lock was held, so two
      // concurrent transfers could both read "under the cap" and both
      // commit, jointly exceeding it — reordering closes that race without
      // needing a schema change or explicit row locking.
      const from = await ensureUserAccounts(tx, params.fromUserId);
      const to = await ensureUserAccounts(tx, params.toUserId);

      const velocityError = await checkTransferVelocity(tx, params.fromUserId, params.toUserId, params.coins);
      if (velocityError) return { error: velocityError };

      const result = await postTransaction(tx, {
        kind: "transfer",
        idempotencyKey: params.idempotencyKey,
        actorUserId: params.fromUserId,
        relatedObjectType: "user",
        relatedObjectId: params.toUserId,
        postings: [
          { accountId: from.walletId, amount: -units },
          { accountId: to.walletId, amount: units },
        ],
      });

      // Replay of the same idempotencyKey — the coins already moved on the
      // first call. Don't write a second CoinTransfer row (it would show
      // twice in history and double-count toward the velocity limit) or
      // re-notify. But first confirm it's actually a replay of THIS
      // request (same recipient and amount) rather than a different
      // transfer that happens to reuse the key (a buggy client resending
      // a mutated payload with an old key, or a colliding key across two
      // different requests) — postTransaction's dedupe only matches on the
      // key string, so without this check that case would silently report
      // success while moving zero coins to the recipient actually named in
      // this call.
      if (!result.created) {
        const toPosting = await tx.ledgerPosting.findFirst({
          where: { transactionId: result.transaction.id, accountId: to.walletId },
        });
        if (result.transaction.relatedObjectId !== params.toUserId || toPosting?.amount !== units) {
          return { error: "This idempotency key was already used for a different transfer." };
        }
        return "replayed";
      }

      await tx.coinTransfer.create({
        data: { fromUserId: params.fromUserId, toUserId: params.toUserId, amount: params.coins },
      });
      return "created";
    });
  } catch (err) {
    if (err instanceof WalletError && err.code === "INSUFFICIENT_FUNDS") {
      const { spendable } = await getWalletBalance(params.fromUserId);
      return {
        error:
          spendable > 0
            ? `You can only send ${spendable} spendable coin${spendable === 1 ? "" : "s"}.`
            : "You have no spendable coins. Coins from the signup bonus and other grants can't be transferred.",
      };
    }
    throw err;
  }

  if (typeof outcome === "object") return outcome; // velocity error
  if (outcome === "created") {
    await notifyCoinsReceived({ recipientId: params.toUserId, actorId: params.fromUserId });
  }
  return { ok: true };
}
