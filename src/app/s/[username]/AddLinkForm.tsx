"use client";

import { useActionState, useRef } from "react";
import { createLink } from "@/app/actions/profile";
import { useResetOnSuccess } from "@/hooks/useResetOnSuccess";

export function AddLinkForm() {
  const [state, formAction, pending] = useActionState(createLink, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetOnSuccess(formRef, pending, state);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="settingsForm"
    >
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Add a link</h2>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          name="label"
          type="text"
          placeholder="Label"
          maxLength={80}
          required
          className="textInput"
          style={{ flex: "1 1 100px" }}
        />
        <input
          name="url"
          type="url"
          placeholder="https://…"
          required
          className="textInput"
          style={{ flex: "2 1 160px" }}
        />
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state?.error && (
        <p className="errorText" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
