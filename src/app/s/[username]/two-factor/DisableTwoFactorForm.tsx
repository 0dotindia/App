"use client";

import { useActionState, useEffect, useRef } from "react";
import { disableTwoFactor } from "@/app/actions/two-factor";
import { PasswordField } from "@/components/PasswordField";
import { useToast } from "@/components/Toast";

// FIX_PLAN P2: disableTwoFactor's revalidatePath("/s", "layout") re-renders
// the parent Server Component (page.tsx branches on twoFactorEnabledAt) as
// soon as the action resolves, swapping this form out for
// TwoFactorSetupForm before the inline `state?.success` message below it
// could ever actually render. A toast survives the unmount.
export function DisableTwoFactorForm() {
  const [state, formAction, pending] = useActionState(disableTwoFactor, undefined);
  const showToast = useToast();
  const announced = useRef(false);

  useEffect(() => {
    if (state?.success && !announced.current) {
      announced.current = true;
      showToast("Two-factor authentication has been disabled.");
    }
  }, [state, showToast]);

  return (
    <form action={formAction} className="authCard" style={{ maxWidth: "none" }}>
      <PasswordField id="currentPassword" name="currentPassword" label="Current password" autoComplete="current-password" required />
      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button buttonDanger" disabled={pending}>
        {pending ? "Disabling…" : "Disable two-factor authentication"}
      </button>
    </form>
  );
}
