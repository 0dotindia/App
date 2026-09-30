"use client";

import { useActionState } from "react";
import Link from "next/link";
import { recoverPassword } from "@/app/actions/auth";
import { ThemeToggleLogo } from "@/components/ThemeToggleLogo";
import { PasswordField } from "@/components/PasswordField";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(recoverPassword, undefined);

  return (
    <div className="authWrap">
      <form action={formAction} className="authCard">
        <div className="authHeader">
          <ThemeToggleLogo size={48} />
          <p>Account recovery</p>
        </div>
        <h1>Forgot password</h1>
        <p className="mutedText">
          Enter your username and one of the recovery codes you saved when you signed up, then
          choose a new password.
        </p>

        <div className="field">
          <label htmlFor="identifier">Username</label>
          <input id="identifier" name="identifier" type="text" autoComplete="username" required />
        </div>

        <div className="field">
          <label htmlFor="recoveryCode">Recovery code</label>
          <input
            id="recoveryCode"
            name="recoveryCode"
            type="text"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="xxxx-xxxx-xxxx"
            required
          />
        </div>

        <PasswordField
          id="password"
          name="password"
          label="New password"
          autoComplete="new-password"
          minLength={8}
          required
          showStrength
        />

        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          minLength={8}
          required
        />

        {state?.error && (
          <p className="errorText" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button" disabled={pending}>
          {pending ? "Resetting…" : "Reset password"}
        </button>

        <p className="mutedText" style={{ fontSize: "var(--text-xs)" }}>
          Lost your recovery codes too? Contact 0dot support — after confirming it&apos;s your
          account, they can issue you a new set.
        </p>

        <p className="authFooter">
          <Link href="/login">Back to log in</Link>
        </p>
      </form>
    </div>
  );
}
