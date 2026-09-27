import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { effectivelyActiveWhere } from "@/lib/subscription-access";

// phase-5 build plan §0 / spec §3.2: no finance decision on fee rates
// exists yet, so this is a single flat placeholder applied to every
// PaymentTransaction kind rather than per-kind rates (spec §14 flags rates
// could differ by feature — deferred until finance actually decides).
// Captured per-row at transaction time (recordPaymentTransaction below), so
// changing this constant later never rewrites the story of a past
// transaction.
export const PLATFORM_FEE_PERCENT = 0.1;

// premium-profiles addendum §3.6/§7: a reduced fee for creators who are
// themselves an active profile_premium subscriber — exact rate is a
// finance decision the addendum flags as unconfirmed, so this is a
// placeholder in the same spirit as PLATFORM_FEE_PERCENT above, not a real
// number to build pricing commitments on.
export const PREMIUM_CREATOR_PLATFORM_FEE_PERCENT = 0.07;

// Shared by recordPaymentTransaction below and chargeWallet
// (src/lib/wallet/charge.ts), which needs the fee *before* posting the
// ledger split — factored out so both can never compute a different rate
// for the same payee. Takes a client (plain `db`, or a `tx` from an in-flight
// transaction) rather than importing one, so recordPaymentTransaction can
// keep its existing atomicity — the discount check and the ledger write
// stay against the same transaction client.
export async function resolveFeeRate(
  client: Pick<Prisma.TransactionClient, "platformSubscription">,
  payeeId: string | null | undefined
): Promise<number> {
  if (!payeeId) return PLATFORM_FEE_PERCENT;
  const premiumPayee = await client.platformSubscription.findFirst({
    where: {
      plan: "profile_premium",
      subscriberProfile: { userId: payeeId },
      ...effectivelyActiveWhere(),
    },
    select: { id: true },
  });
  return premiumPayee ? PREMIUM_CREATOR_PLATFORM_FEE_PERCENT : PLATFORM_FEE_PERCENT;
}

// spec §3.5's "every kind produces exactly one PaymentTransaction row with
// a non-null platform_fee and processor_reference" criterion is enforced by
// funneling every money-moving feature through this one function, not by
// convention. Runs inside the caller's transaction so the ledger write and
// the feature's own row (Tip, later MembershipSubscription, etc.) can never
// drift apart.
// phase-8 build plan §5: payeeId/payeeBusinessId — exactly one set, mutual
// exclusivity enforced by the caller (purchaseTicket, events.ts), not here.
// Every pre-phase-8 caller (tip/digital/course/affiliate) keeps passing
// payeeId only, unaffected.
// processor is required: "wallet" for every coin charge
// (addendum-wallet-only-payments.md), or apple_iap/google_play_billing plus
// a storeFee for a native in-app purchase (phase-15 spec §6.1–§6.2).
export async function recordPaymentTransaction(
  tx: Prisma.TransactionClient,
  params: {
    kind: string;
    payerId: string | null;
    payeeId?: string | null;
    payeeBusinessId?: string | null;
    amount: number;
    currency: string;
    processorReference: string;
    status: "pending" | "succeeded" | "failed" | "refunded";
    relatedObjectType?: string;
    relatedObjectId?: string;
    processor: "apple_iap" | "google_play_billing" | "wallet";
    storeFee?: number;
  }
) {
  // premium-profiles addendum §3.6: resolveFeeRate runs against `tx`, the
  // same transaction client the ledger write below uses, so the discount
  // check and the write stay atomic with each other.
  const feeRate = await resolveFeeRate(tx, params.payeeId);
  // billing addendum §2.1: the one case in this ledger with genuinely no
  // payee — platform_subscription_charge/api_usage_charge rows (payeeId
  // and payeeBusinessId both null) — money flows straight to 0dot, so
  // platform_fee is the *full* charged amount, not the facilitator-model
  // rate above. An honest semantic mismatch the addendum names explicitly
  // rather than something to paper over.
  const platformFee = !params.payeeId && !params.payeeBusinessId ? params.amount : Math.round(params.amount * feeRate * 100) / 100;
  return tx.paymentTransaction.create({
    data: {
      kind: params.kind,
      payerId: params.payerId,
      payeeId: params.payeeId ?? null,
      payeeBusinessId: params.payeeBusinessId ?? null,
      amount: params.amount,
      currency: params.currency,
      platformFee,
      processor: params.processor,
      storeFee: params.storeFee ?? null,
      processorReference: params.processorReference,
      status: params.status,
      relatedObjectType: params.relatedObjectType,
      relatedObjectId: params.relatedObjectId,
    },
  });
}

// phase-15 spec §6.3: records the aggregated lump-sum store payout, then
// attributes it against the per-creator PaymentTransaction rows it covers
// — the reconciliation step Apple/Google's payout topology requires. Flagged in the
// spec as needing dedicated finance/ops work; this is the schema-level
// mechanism that work would build on, not a complete reconciliation engine.
export async function recordIapPayoutBatch(params: {
  processor: "apple_iap" | "google_play_billing";
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return db.iapPayoutBatch.create({
    data: {
      processor: params.processor,
      amount: params.amount,
      currency: params.currency,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    },
  });
}

// Attributes every succeeded, not-yet-reconciled PaymentTransaction for a
// processor within the batch's period to that batch, then marks it
// reconciled — the "before disbursement" step spec §6.4's acceptance
// criterion requires happen prior to paying creators out.
export async function reconcileIapPayoutBatch(batchId: string): Promise<number> {
  const batch = await db.iapPayoutBatch.findUniqueOrThrow({ where: { id: batchId } });
  const { count } = await db.paymentTransaction.updateMany({
    where: {
      processor: batch.processor,
      status: "succeeded",
      iapPayoutBatchId: null,
      createdAt: { gte: batch.periodStart, lte: batch.periodEnd },
    },
    data: { iapPayoutBatchId: batchId },
  });
  await db.iapPayoutBatch.update({ where: { id: batchId }, data: { status: "reconciled" } });
  return count;
}
