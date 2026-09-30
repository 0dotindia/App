"use client";

import { useActionState } from "react";
import { issueRecoveryCodesForUser } from "@/app/actions/admin-account-recovery";
import { RecoveryCodeList } from "@/components/RecoveryCodeList";

export function AccountRecoveryForm() {
  const [state, formAction, pending] = useActionState(issueRecoveryCodesForUser, undefined);

  return (
    <div className="stack-lg">
      <form action={formAction} className="authCard" style={{ maxWidth: "none" }}>
        <div className="field">
          <label htmlFor="identifier">Username or email</label>
          <input id="identifier" name="identifier" type="text" autoCapitalize="none" spellCheck={false} placeholder="@username" required />
        </div>
        {state?.error && (
        <p className="errorText" role="alert">
          {state.error}
        </p>
      )}
        <button type="submit" className="button buttonSecondary" disabled={pending}>
          {pending ? "Issuing…" : "Issue new recovery codes"}
        </button>
      </form>

      {state?.codes && (
        <div className="authCard" style={{ maxWidth: "none" }}>
          <p className="mutedText">
            New recovery codes for @{state.handle}. Share them only with the verified account
            owner — they won&apos;t be shown again.
          </p>
          <RecoveryCodeList codes={state.codes} />
        </div>
      )}
    </div>
  );
}
