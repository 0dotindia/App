"use client";

import { useActionState } from "react";
import { refundPaymentAction } from "@/app/actions/admin-wallet";

export function RefundPaymentForm({ paymentTransactionId, amount }: { paymentTransactionId: string; amount: number }) {
  const [state, formAction, pending] = useActionState(refundPaymentAction, undefined);

  if (state?.success) return <p className="mutedText" style={{ fontSize: "0.85rem" }}>Refunded.</p>;

  return (
    <form action={formAction} style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="paymentTransactionId" value={paymentTransactionId} />
      <input name="reason" placeholder="Reason (required, audited)" className="textInput" required minLength={3} style={{ maxWidth: "26ch" }} />
      <button type="submit" className="button buttonSecondary buttonSmall" disabled={pending}>
        {pending ? "Refunding…" : `Refund ${amount} coin${amount === 1 ? "" : "s"}`}
      </button>
      {state?.error && <p className="errorText" style={{ width: "100%", margin: 0 }}>{state.error}</p>}
    </form>
  );
}
