"use client";

import { useEffect, useRef, type RefObject } from "react";

// Shared reset-on-success behavior for a `useActionState` form: resets the
// form (and any extra local state via `onReset`) only on the falling edge
// of `pending` with no `state.error` present — i.e. once the action has
// genuinely finished without an error, not on every dispatch. The
// `await formAction(formData); formRef.current?.reset()` pattern used
// elsewhere in this codebase resets even when the action returned a
// validation error, since useActionState's dispatch return isn't tied to
// completion — this fixes that. Extracted from EpisodeForm.tsx, the
// original hand-written version of this hook.
export function useResetOnSuccess(
  formRef: RefObject<HTMLFormElement | null>,
  pending: boolean,
  state: { error?: string } | null | undefined,
  onReset?: () => void
): void {
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      onReset?.();
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formRef is a ref (stable by contract) and onReset is typically a fresh closure each render; including it would re-run this effect every render for no behavioral difference, since the reset is already gated on the pending falling-edge.
  }, [pending, state]);
}
