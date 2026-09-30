"use server";

import { requirePlatformRole } from "@/lib/auth-guards";
import { findUserForAdmin } from "@/lib/admin-user-lookup";
import { issuePasswordRecoveryCodes } from "@/lib/password-recovery";
import { isInternalSystemAccountEmail } from "@/lib/first-party-apps";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logPlatformAudit } from "@/lib/platform-audit";
import { logger } from "@/lib/logger";

export type AdminRecoveryState = { error?: string; handle?: string; codes?: string[] } | undefined;

// Conservative cap — every other sensitive admin action is rate-limited and
// this one wasn't; a compromised admin session could otherwise mass-issue
// account-takeover codes with nothing to slow it down. 10/hour is well
// above any legitimate single-admin support workload; revisit with whoever
// owns this if that turns out to be too tight in practice.
function checkRecoveryIssuanceRateLimit(adminId: string): Promise<boolean> {
  return enforceRateLimit(`admin-recovery-codes:${adminId}`, { max: 10, windowMs: 60 * 60 * 1000 });
}

// The support fallback for someone who forgot their password *and* lost
// their recovery codes — with no email or OTP on accounts there's no
// automated path left. An admin, after confirming the person's identity
// out-of-band, issues a fresh set of recovery codes (invalidating the old
// ones) and hands them over; the user then resets their own password on
// /forgot-password, which also signs out every existing session. The admin
// never sees or sets the password itself. Logged with actor + target so
// every issuance is attributable.
export async function issueRecoveryCodesForUser(
  _prevState: AdminRecoveryState,
  formData: FormData,
): Promise<AdminRecoveryState> {
  const { user: admin } = await requirePlatformRole("admin");

  if (!(await checkRecoveryIssuanceRateLimit(admin.id))) {
    return { error: "Too many recovery-code issuances. Please slow down." };
  }

  const target = await findUserForAdmin(String(formData.get("identifier") ?? ""));
  if (!target || (target.email && isInternalSystemAccountEmail(target.email))) {
    return { error: "No 0dot account exists with that username or email." };
  }
  if (target.status !== "active" && target.status !== "deactivated") {
    return { error: `That account is ${target.status}; recovery codes can't be issued for it.` };
  }

  const codes = await issuePasswordRecoveryCodes(target.id);
  logger.warn("admin issued password recovery codes", undefined, { adminUserId: admin.id, targetUserId: target.id });
  await logPlatformAudit({ actorId: admin.id, action: "account_recovery_codes_issued", targetType: "user", targetId: target.id });
  return { handle: target.username?.handle ?? target.id, codes };
}
