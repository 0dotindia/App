import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { DeveloperApp } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { recordPaymentTransaction } from "@/lib/payments";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { notifyApiPlanDowngraded } from "@/lib/notifications";
import { chargeWallet } from "@/lib/wallet/charge";
import { spendBusinessCoins, WalletError } from "@/lib/wallet/ledger";
import { SYSTEM_ACCOUNT_IDS } from "@/lib/wallet/accounts";
import { COIN_UNIT, coinIdempotencyKey } from "@/lib/wallet/limits";

// billing addendum §4.1: meters against Phase 10 §5.3's *existing*
// aggregated ApiUsageCounter rows — no parallel per-request billing log.
// Prices are finance-TBD placeholders, same posture as
// PLATFORM_FEE_PERCENT/PLAN_PRICES elsewhere in this billing layer.
//
// addendum-wallet-only-payments.md §3.4: plans are paid in coins from the
// app owner's wallet — a business-owned app's business wallet. An app with
// apiSubscriptionId set is a legacy Stripe subscription from before that,
// still billed by Stripe (meter events + invoice.paid, below) until it's
// drained (§6).
const INCLUDED_FREE_REQUESTS_PER_PERIOD = 10_000; // pay_as_you_go's first N requests/period are free, matching the free plan's own rough hourly cap scaled to a month
const PRICE_PER_1000_REQUESTS_OVER = 0.5; // coins
const COMMITTED_PLAN_FLAT_PRICE = 49; // coins/period — a prepaid commitment, charged regardless of usage
const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
// For the billing-plan UI.
export const API_PLAN_PRICING = {
  includedRequests: INCLUDED_FREE_REQUESTS_PER_PERIOD,
  per1000Over: PRICE_PER_1000_REQUESTS_OVER,
  committed: COMMITTED_PLAN_FLAT_PRICE,
};
const OVERAGE_BLOCK = 1000; // mid-period overage is charged in whole blocks; the remainder at period close
const METER_EVENT_NAME = "api_request_overage"; // legacy Stripe subscriptions only

export async function resolveAppPayerUserId(app: { ownerUserId: string | null; ownerBusinessId: string | null }): Promise<string | null> {
  if (app.ownerUserId) return app.ownerUserId;
  if (app.ownerBusinessId) {
    const owner = await db.businessMember.findFirst({ where: { businessId: app.ownerBusinessId, role: "owner" }, select: { userId: true } });
    return owner?.userId ?? null;
  }
  return null;
}

type ApiPlan = "free" | "pay_as_you_go" | "committed";

// Charges `units` for an app inside the caller's transaction, from its
// business wallet or its owner's wallet (recorded as an api_usage_charge
// PaymentTransaction, no payee — the whole amount is platform revenue).
// Returns false on an idempotency replay. Throws WalletError
// INSUFFICIENT_FUNDS when the wallet can't cover it.
async function chargeApp(tx: Prisma.TransactionClient, app: DeveloperApp, units: number, idempotencyKey: string, memo: string): Promise<boolean> {
  if (app.ownerBusinessId) {
    const spend = await spendBusinessCoins(tx, {
      businessId: app.ownerBusinessId,
      units,
      creditAccountId: SYSTEM_ACCOUNT_IDS.system_platform_revenue,
      kind: "purchase",
      idempotencyKey,
      relatedObjectType: "developer_app",
      relatedObjectId: app.id,
      memo,
    });
    return spend.created;
  }
  if (!app.ownerUserId) throw new WalletError("BAD_REQUEST", "This app has no owner to bill.");
  const charge = await chargeWallet(tx, {
    payerId: app.ownerUserId,
    amountUsd: units / COIN_UNIT,
    currency: "usd",
    kind: "api_usage_charge",
    relatedObjectType: "developer_app",
    relatedObjectId: app.id,
    idempotencyKey,
  });
  return !charge.alreadySettled;
}

const isInsufficient = (err: unknown) => err instanceof WalletError && err.code === "INSUFFICIENT_FUNDS";

// An unpaid charge drops the app back to free (rate-limited again) and
// tells the owner. What went unpaid is logged, not carried as a debt.
async function downgradeUnpaid(app: DeveloperApp, unpaidUnits: number, reason: string): Promise<void> {
  await db.developerApp.update({
    where: { id: app.id },
    data: { billingPlan: "free", lastBilledAt: new Date(), billedOverageRequests: 0 },
  });
  logger.warn("api-usage-billing: charge unpaid — app moved to free", undefined, { appId: app.id, reason, unpaidCoins: unpaidUnits / COIN_UNIT });
  const recipientId = await resolveAppPayerUserId(app);
  if (recipientId) await notifyApiPlanDowngraded({ recipientId, appId: app.id });
}

// pay_as_you_go: charges overage (requests beyond
// INCLUDED_FREE_REQUESTS_PER_PERIOD this period) not yet charged. Mid-period
// only whole OVERAGE_BLOCKs are charged, so a small app isn't billed every
// sweep; at period close (or `closeNow`, when leaving the plan) the rest is
// charged too and a new period starts. Charging as usage accrues, not once
// at period end, is what stops an app with no coins running uncapped for a
// whole period. The idempotency key is the cumulative billed level, so a
// replayed or overlapping sweep can't charge the same requests twice.
// Returns false if it couldn't be paid (the app is then on free).
async function settleCoinOverage(app: DeveloperApp, now: Date, closeNow: boolean): Promise<boolean> {
  const periodStart = app.lastBilledAt ?? app.createdAt;
  const periodEnd = new Date(periodStart.getTime() + BILLING_PERIOD_MS);
  const windowEnd = now < periodEnd ? now : periodEnd;
  const closing = closeNow || now >= periodEnd;

  const usage = await db.apiUsageCounter.aggregate({
    where: { appId: app.id, windowStart: { gte: periodStart, lt: windowEnd } },
    _sum: { requestCount: true },
  });
  const overage = Math.max(0, (usage._sum.requestCount ?? 0) - INCLUDED_FREE_REQUESTS_PER_PERIOD);
  const billable = Math.max(app.billedOverageRequests, closing ? overage : Math.floor(overage / OVERAGE_BLOCK) * OVERAGE_BLOCK);
  const toBill = billable - app.billedOverageRequests;
  const units = Math.ceil((toBill * PRICE_PER_1000_REQUESTS_OVER * COIN_UNIT) / 1000);

  if (units === 0 && !closing) return true;
  try {
    await db.$transaction(async (tx) => {
      if (units > 0) {
        await chargeApp(tx, app, units, `api-usage:${app.id}:${periodStart.toISOString()}:${billable}`, `API usage — ${toBill} requests over the included amount`);
      }
      await tx.developerApp.update({
        where: { id: app.id },
        data: closing ? { lastBilledAt: windowEnd, billedOverageRequests: 0 } : { billedOverageRequests: billable },
      });
    });
    return true;
  } catch (err) {
    if (!isInsufficient(err)) throw err;
    await downgradeUnpaid(app, units, "pay_as_you_go overage");
    return false;
  }
}

// committed: the flat price is charged up front for each period (the
// first one by switchApiPlan). Keyed by the period it pays for.
async function renewCoinCommittedPlan(app: DeveloperApp, now: Date): Promise<void> {
  const periodEnd = new Date((app.lastBilledAt ?? app.createdAt).getTime() + BILLING_PERIOD_MS);
  if (now < periodEnd) return;
  const units = Math.round(COMMITTED_PLAN_FLAT_PRICE * COIN_UNIT);
  try {
    await db.$transaction(async (tx) => {
      await chargeApp(tx, app, units, `api-committed:${app.id}:${periodEnd.toISOString()}`, "API committed plan");
      await tx.developerApp.update({ where: { id: app.id }, data: { lastBilledAt: periodEnd } });
    });
  } catch (err) {
    if (!isInsufficient(err)) throw err;
    await downgradeUnpaid(app, units, "committed plan renewal");
  }
}

// The one way an app changes plan (the billing-plan action). A legacy
// Stripe subscription is cancelled first — Stripe first, local row second,
// so a failed Stripe call can't leave the app marked unsubscribed while
// Stripe keeps billing it. Leaving pay_as_you_go settles the overage used
// so far. committed charges its first period now and is refused (plan
// unchanged) if the wallet can't cover it; pay_as_you_go charges nothing
// up front.
export async function switchApiPlan(appId: string, plan: ApiPlan): Promise<{ error?: string }> {
  let app = await db.developerApp.findUniqueOrThrow({ where: { id: appId } });
  if (app.billingPlan === plan && !app.apiSubscriptionId) return {};

  if (app.apiSubscriptionId) {
    await stripe.subscriptions.cancel(app.apiSubscriptionId);
    app = await db.developerApp.update({ where: { id: app.id }, data: { billingPlan: "free", apiSubscriptionId: null, billedOverageRequests: 0 } });
  } else if (app.billingPlan === "pay_as_you_go") {
    if (!(await settleCoinOverage(app, new Date(), true))) {
      return { error: "Not enough coins to pay for this app's usage so far — it has been moved to the free plan." };
    }
    app = await db.developerApp.findUniqueOrThrow({ where: { id: appId } });
  }

  const now = new Date();
  if (plan !== "committed") {
    await db.developerApp.update({ where: { id: app.id }, data: { billingPlan: plan, lastBilledAt: now, billedOverageRequests: 0 } });
    return {};
  }

  const units = Math.round(COMMITTED_PLAN_FLAT_PRICE * COIN_UNIT);
  try {
    await db.$transaction(async (tx) => {
      await chargeApp(tx, app, units, coinIdempotencyKey("api-committed-start", app.id), "API committed plan");
      await tx.developerApp.update({ where: { id: app.id }, data: { billingPlan: "committed", lastBilledAt: now, billedOverageRequests: 0 } });
    });
  } catch (err) {
    if (!isInsufficient(err)) throw err;
    return { error: `The committed plan needs ${COMMITTED_PLAN_FLAT_PRICE} coins${app.ownerBusinessId ? " in the business wallet" : ""}.` };
  }
  return {};
}

// Called from the Stripe webhook on checkout.session.completed once a
// pay_as_you_go/committed subscription is confirmed.
export async function activateApiPlanSubscription(metadata: Record<string, string>, processorSubscriptionId: string): Promise<void> {
  const { appId, plan } = metadata;
  const app = await db.developerApp.findUnique({ where: { id: appId } });
  if (!app || app.apiSubscriptionId === processorSubscriptionId) return; // already activated (Stripe redelivery) or app no longer exists

  await db.developerApp.update({
    where: { id: appId },
    data: { billingPlan: plan, apiSubscriptionId: processorSubscriptionId, lastBilledAt: new Date() },
  });
}

// Called from the Stripe webhook on invoice.paid — the real "charge
// succeeded" signal for a subscription's committed flat fee or a period's
// metered overage, replacing what used to be settleAppUsage's own direct
// stub charge. Idempotent on processorReference (the invoice id).
export async function recordApiUsageInvoicePaid(params: {
  processorSubscriptionId: string;
  amount: number;
  currency: string;
  processorReference: string;
}): Promise<void> {
  const already = await db.paymentTransaction.findFirst({ where: { processorReference: params.processorReference, kind: "api_usage_charge" } });
  if (already) return;
  if (params.amount <= 0) return; // a $0 metered invoice (no overage this period) still fires invoice.paid — nothing to record

  const app = await db.developerApp.findFirst({ where: { apiSubscriptionId: params.processorSubscriptionId } });
  if (!app) return; // not one of ours (or a plan/platform subscription's own invoice, handled elsewhere)

  const payerId = await resolveAppPayerUserId(app);
  if (!payerId) return;

  try {
    await db.$transaction(async (tx) => {
      await recordPaymentTransaction(tx, {
        kind: "api_usage_charge",
        payerId,
        payeeId: null,
        amount: params.amount,
        currency: params.currency,
        processorReference: params.processorReference,
        status: "succeeded",
        relatedObjectType: "developer_app",
        relatedObjectId: app.id,
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      logger.error("recordApiUsageInvoicePaid: duplicate webhook delivery — already recorded, no-op", undefined, { processorReference: params.processorReference });
      return;
    }
    throw err;
  }
}

// Legacy Stripe pay_as_you_go: reports the period's overage as one Meter
// Event — Stripe bills it at the subscription's own cycle (invoice.paid,
// above, records the ledger). Coin apps: pay_as_you_go overage is charged
// as it accrues, committed renews each period (both above).
export async function settleAppUsage(appId: string): Promise<void> {
  const app = await db.developerApp.findUniqueOrThrow({ where: { id: appId } });
  const now = new Date();

  if (!app.apiSubscriptionId) {
    if (app.billingPlan === "pay_as_you_go") await settleCoinOverage(app, now, false);
    else if (app.billingPlan === "committed") await renewCoinCommittedPlan(app, now);
    return;
  }

  if (app.billingPlan !== "pay_as_you_go") return;
  const periodStart = app.lastBilledAt ?? app.createdAt;
  const usage = await db.apiUsageCounter.aggregate({
    where: { appId: app.id, windowStart: { gte: periodStart, lt: now } },
    _sum: { requestCount: true },
  });
  const overage = Math.max(0, (usage._sum.requestCount ?? 0) - INCLUDED_FREE_REQUESTS_PER_PERIOD);

  if (overage > 0) {
    const customer = await stripe.subscriptions.retrieve(app.apiSubscriptionId, { expand: ["customer"] });
    const customerId = typeof customer.customer === "string" ? customer.customer : customer.customer.id;
    await stripe.billing.meterEvents.create({
      event_name: METER_EVENT_NAME,
      payload: { stripe_customer_id: customerId, value: String(overage) },
    });
  }

  await db.developerApp.update({ where: { id: app.id }, data: { lastBilledAt: now } });
}

async function sweepDueSettlements(): Promise<void> {
  const due = await db.developerApp.findMany({
    where: {
      OR: [
        // Coin plans: checked every sweep (overage accrues continuously).
        { apiSubscriptionId: null, billingPlan: { in: ["pay_as_you_go", "committed"] } },
        // Legacy Stripe pay_as_you_go: once per period.
        {
          billingPlan: "pay_as_you_go",
          apiSubscriptionId: { not: null },
          OR: [{ lastBilledAt: null }, { lastBilledAt: { lt: new Date(Date.now() - BILLING_PERIOD_MS) } }],
        },
      ],
    },
    select: { id: true },
  });
  for (const { id } of due) {
    try {
      await settleAppUsage(id);
    } catch (err) {
      logger.error("api-usage-billing: settlement failed", err, { appId: id });
    }
  }
}

const SETTLEMENT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // periods are month-long — checking a few times a day is plenty

const globalForApiUsageBilling = globalThis as unknown as { apiUsageBillingSchedulerStarted?: boolean };

export function startApiUsageBillingScheduler(): void {
  if (globalForApiUsageBilling.apiUsageBillingSchedulerStarted) return;
  globalForApiUsageBilling.apiUsageBillingSchedulerStarted = true;

  const tick = () => void sweepDueSettlements();
  tick();
  setInterval(tick, SETTLEMENT_CHECK_INTERVAL_MS);
}

// Cron entry point (web-pro-upgrade addendum M1) — see runTrendingRecomputeOnce.
export async function runApiUsageBillingSweepOnce(): Promise<void> {
  await sweepDueSettlements();
}
