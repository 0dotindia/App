"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/app/actions/auth";

export function RequestSlotButton({
  offeringId,
  startsAt,
  formAction,
}: {
  offeringId: string;
  startsAt: string;
  formAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, action, pending] = useActionState(formAction, undefined);
  // Formatted client-side, not passed down as a server-computed prop — the
  // page.tsx caller (a Server Component) used to format this label with an
  // `undefined` locale, which resolves to the *server's* ICU locale during
  // SSR and can mismatch the viewer's own on hydration (same class of bug
  // RelativeTime.tsx exists to avoid). Empty until mount, same tradeoff.
  const [label, setLabel] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: defers the locale-dependent value until after mount.
    setLabel(
      new Date(startsAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  }, [startsAt]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <button type="submit" className="button buttonSecondary buttonSmall" disabled={pending} suppressHydrationWarning>
        {pending ? "Requesting…" : label}
      </button>
      {state?.error && <p className="errorText" style={{ fontSize: "0.75rem", margin: 0 }}>{state.error}</p>}
    </form>
  );
}
