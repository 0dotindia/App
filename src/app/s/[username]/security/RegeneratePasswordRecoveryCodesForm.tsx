"use client";

import { useActionState } from "react";
import { regeneratePasswordRecoveryCodes } from "@/app/actions/auth";
import { PasswordField } from "@/components/PasswordField";
import { RecoveryCodeList } from "@/components/RecoveryCodeList";

export function RegeneratePasswordRecoveryCodesForm() {
  const [state, formAction, pending] = useActionState(regeneratePasswordRecoveryCodes, undefined);

  if (state?.codes) {
    return (
      <div className="authCard" style={{ maxWidth: "none" }}>
        <p className="mutedText">
          Your old recovery codes no longer work. Save these new ones somewhere safe — they
          won&apos;t be shown again.
        </p>
        <RecoveryCodeList codes={state.codes} />
      </div>
    );
  }

  return (
    <form action={formAction} className="authCard" style={{ maxWidth: "none" }}>
      <PasswordField
        id="recovery-regen-password"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        required
      />
      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button buttonSecondary" disabled={pending}>
        {pending ? "Generating…" : "Generate new recovery codes"}
      </button>
    </form>
  );
}
