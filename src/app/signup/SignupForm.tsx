"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { AuthTopBar } from "@/components/AuthTopBar";
import { AuthTrust } from "@/components/AuthTrust";
import { DigitalHomeVisual } from "@/components/DigitalHomeVisual";
import { ExploreLiveLink } from "@/components/ExploreLiveLink";
import { PasswordField } from "@/components/PasswordField";
import { ThemeToggleLogo } from "@/components/ThemeToggleLogo";
import { UsernameField } from "@/components/UsernameField";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  // The "Profile" node has nothing to navigate to on a logged-out visitor
  // (spec §16 step-1 "identity node appears") — here on the actual signup
  // page, activating it jumps straight to the form's first field instead.
  function focusFirstField() {
    document.getElementById("displayName")?.focus();
  }

  return (
    <div className="landingWrap">
      <AuthTopBar />

      <section className="landingHero">
        <h1>Claim your permanent link.</h1>
        <p>
          <span className="brandUrl">0dot.in</span>/yourname — one identity for everything you make.
        </p>
        <ExploreLiveLink />

        <DigitalHomeVisual variant="calm" onProfileActivate={focusFirstField} />
      </section>

      <form action={formAction} className="authCard">
        <div className="authHeader">
          <ThemeToggleLogo size={48} />
          <p>Welcome</p>
        </div>
        <h1>Create your account</h1>

        <input
          type="text"
          name="hp_extra_field"
          className="honeypotField"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div className="field">
          <label htmlFor="displayName">Full name</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            maxLength={50}
            required
          />
        </div>

        <UsernameField id="username" />

        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="new-password"
          minLength={8}
          required
          showStrength
        />

        {state?.error && (
          <p className="errorText" role="alert">
            {state.error}
          </p>
        )}

        <p className="mutedText" style={{ fontSize: "var(--text-xs)" }}>
          By signing up you agree to the <Link href="/terms" prefetch={false}>Terms</Link> and{" "}
          <Link href="/privacy" prefetch={false}>Privacy Policy</Link>.
        </p>

        <button type="submit" className="button" disabled={pending}>
          {pending ? "Creating account…" : "Sign up"}
        </button>

        {/* prefetch={false}: same DB-connection-burst-503 fix as
            DigitalHomeVisual/ExploreLiveLink, which mount alongside this
            form on the same page. */}
        <p className="authFooter">
          Already have an account? <Link href="/login" prefetch={false}>Log in</Link>
        </p>
        <AuthTrust />
      </form>
    </div>
  );
}
