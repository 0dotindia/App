import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { acknowledgeRecoveryCodes } from "@/app/actions/auth";
import { RECOVERY_CODES_COOKIE, unsealRecoveryCodes } from "@/lib/password-recovery";
import { RecoveryCodeList } from "@/components/RecoveryCodeList";

export const metadata: Metadata = { title: "Save your recovery codes" };

// Shown once, straight after signup (auth.ts signup() sets the sealed cookie
// this reads). With no email on the account, these codes are the only
// self-service way back in after a forgotten password, so the user has to
// confirm they've saved them before continuing.
export default async function SignupRecoveryCodesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sealed = (await cookies()).get(RECOVERY_CODES_COOKIE)?.value;
  const codes = sealed ? unsealRecoveryCodes(sealed, user.id) : null;
  const settingsHref = user.username ? `/s/${user.username.handle}/security` : null;

  return (
    <div className="authWrap">
      <div className="authCard">
        <h1>Save your recovery codes</h1>
        {codes && codes.length > 0 ? (
          <>
            <p className="mutedText">
              If you ever forget your password, you can reset it with your username and one of
              these codes. Each code works once. Write them down or store them in a password
              manager — they won&apos;t be shown again.
            </p>
            <RecoveryCodeList codes={codes} />
            <form action={acknowledgeRecoveryCodes} className="stack">
              <label className="row">
                <input type="checkbox" name="saved" required />
                <span>I&apos;ve saved my recovery codes</span>
              </label>
              <button type="submit" className="button">
                Continue to my profile
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mutedText">
              Your recovery codes have already been shown.
              {settingsHref && (
                <>
                  {" "}
                  If you didn&apos;t save them, you can generate a new set in{" "}
                  <Link href={settingsHref}>Security settings</Link>.
                </>
              )}
            </p>
            <form action={acknowledgeRecoveryCodes}>
              <button type="submit" className="button">
                Continue
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
