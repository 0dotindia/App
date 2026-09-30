"use client";

import { useActionState, useRef } from "react";
import { createShortLink } from "@/app/actions/short-links";
import { useResetOnSuccess } from "@/hooks/useResetOnSuccess";

export function ShortLinkForm() {
  const [state, formAction, pending] = useActionState(createShortLink, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetOnSuccess(formRef, pending, state);

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
    >
      <input
        name="destinationUrl"
        type="url"
        placeholder="https://…"
        aria-label="Destination URL"
        required
        className="textInput"
        style={{ flex: "1 1 240px" }}
      />
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Shortening…" : "Shorten"}
      </button>
      {state?.error && (
        <p className="errorText" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
