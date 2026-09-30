"use client";

import { useActionState } from "react";
import { verifyLoginTwoFactor } from "@/app/actions/two-factor";
import { ThemeToggleLogo } from "@/components/ThemeToggleLogo";

export function Login2faForm() {
  const [state, formAction, pending] = useActionState(verifyLoginTwoFactor, undefined);

  return (
    <form action={formAction} className="authCard">
      <div className="authHeader">
        <ThemeToggleLogo size={48} />
        <p>Two-factor authentication</p>
      </div>
      <h1>Enter your code</h1>
      <p className="mutedText">
        Enter the 6-digit code from your authenticator app, or one of your recovery codes.
      </p>

      <div className="field">
        <label htmlFor="code">Verification code</label>
        <input
          id="code"
          name="code"
          type="text"
          autoComplete="one-time-code"
          maxLength={20}
          autoFocus
          required
        />
      </div>

      {state?.error && (
        <p className="errorText" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="button" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}
