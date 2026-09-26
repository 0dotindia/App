"use server";

import { requirePlatformRole } from "@/lib/auth-guards";
import { findUserForAdmin } from "@/lib/admin-user-lookup";
import { issuePasswordRecoveryCodes } from "@/lib/password-recovery";
import { isInternalSystemAccountEmail } from "@/lib/first-party-apps";
import { logger } from "@/lib/logger";

export type AdminRecoveryState = { error?: string; handle?: string; codes?: string[] } | undefined;

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

  const target = await findUserForAdmin(String(formData.get("identifier") ?? ""));
  if (!target || (target.email && isInternalSystemAccountEmail(target.email))) {
    return { error: "No 0dot account exists with that username or email." };
  }
  if (target.status !== "active" && target.status !== "deactivated") {
    return { error: `That account is ${target.status}; recovery codes can't be issued for it.` };
  }

  const codes = await issuePasswordRecoveryCodes(target.id);
  logger.warn("admin issued password recovery codes", undefined, { adminUserId: admin.id, targetUserId: target.id });
  return { handle: target.username?.handle ?? target.id, codes };
}
