"use client";

import { useActionState, useRef } from "react";
import { createCalendarEntry } from "@/app/actions/calendar";
import { useResetOnSuccess } from "@/hooks/useResetOnSuccess";

export function CalendarEntryForm() {
  const [state, formAction, pending] = useActionState(createCalendarEntry, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetOnSuccess(formRef, pending, state);

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
    >
      <input
        name="title"
        placeholder="Title"
        aria-label="Title"
        required
        maxLength={120}
        className="textInput"
        style={{ flex: "2 1 160px" }}
      />
      <input name="startsAt" type="datetime-local" required className="textInput" style={{ flex: "1 1 160px" }} />
      <input name="endsAt" type="datetime-local" className="textInput" style={{ flex: "1 1 160px" }} />
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error && (
        <p className="errorText" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
