"use client";

import { useActionState } from "react";
import { refundPaymentAction } from "@/app/actions/admin-wallet";
import { ConfirmButton } from "@/components/ConfirmButton";

export function RefundPaymentForm({ paymentTransactionId, amount }: { paymentTransactionId: string; amount: number }) {
  const [state, formAction, pending] = useActionState(refundPaymentAction, undefined);

  if (state?.success) return <p className="mutedText" style={{ fontSize: "0.85rem" }}>Refunded.</p>;

  return (
    <form action={formAction} style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="paymentTransactionId" value={paymentTransactionId} />
      <input name="reason" placeholder="Reason (required, audited)" className="textInput" required minLength={3} style={{ maxWidth: "26ch" }} />
      <ConfirmButton
        className="button buttonSecondary buttonSmall"
        title={`Refund ${amount} coin${amount === 1 ? "" : "s"}?`}
        description="The buyer gets the coins back from the platform's refund pool; the seller keeps their earnings. This can't be undone."
        confirmLabel="Refund"
        icon={null}
        disabled={pending}
      >
        {pending ? "Refunding…" : `Refund ${amount} coin${amount === 1 ? "" : "s"}`}
      </ConfirmButton>
      {state?.error && (
        <p className="errorText" role="alert" style={{ width: "100%", margin: 0 }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
