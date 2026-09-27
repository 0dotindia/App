import { assertCronAuthorized, runCronBucket } from "@/lib/cron";
import { runDmcaRestorationOnce } from "@/lib/dmca";
import { runAccountDeletionSweepOnce } from "@/lib/account-deletion";
import { runPlatformBillingSweepOnce } from "@/lib/platform-billing";
import { runCustomDomainSweepOnce } from "@/lib/custom-domains";
import { runWalletReconciliationOnce } from "@/lib/wallet/reconcile";
import { runPromoExpirySweepOnce } from "@/lib/wallet/expiry";
import { runHoldExpirySweepOnce } from "@/lib/wallet/holds";
import { runMonthlyAllowanceSweepOnce } from "@/lib/wallet/grants";

// Hourly-ish maintenance sweeps. Triggered at :17 past the hour by
// .github/workflows/cron.yml (Hobby plan can't do sub-daily Vercel crons —
// web-pro-upgrade addendum M1). Formerly setInterval loops of
// 15–60 min in instrumentation.ts. Note platform-billing's original loop
// was 15 min — folded to hourly here; a lapsed link cap staying visible for
// up to an hour is an acceptable tradeoff for not running a fourth cron.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request): Promise<Response> {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;
  // Leave headroom under maxDuration for the jobs' own bookkeeping.
  const deadline = Date.now() + (maxDuration - 15) * 1000;

  return runCronBucket("hourly", {
    "dmca-restoration": runDmcaRestorationOnce,
    "account-deletion": runAccountDeletionSweepOnce,
    "platform-billing": runPlatformBillingSweepOnce,
    "custom-domains": runCustomDomainSweepOnce,
    "wallet-reconcile": runWalletReconciliationOnce,
    "promo-expiry": runPromoExpirySweepOnce,
    "hold-expiry": runHoldExpirySweepOnce,
    // Also in the daily bucket; running hourly finishes a sweep that hit
    // its time budget on the 1st within hours instead of days. A no-op
    // once everyone eligible has this month's allowance.
    "monthly-allowance": () => runMonthlyAllowanceSweepOnce(new Date(), { deadline }),
  });
}
