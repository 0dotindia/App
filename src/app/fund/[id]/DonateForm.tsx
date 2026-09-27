"use client";

import { useActionState } from "react";
import { donate } from "@/app/actions/donations";
import { IdempotencyField } from "@/components/IdempotencyField";

// Paid in coins (addendum-wallet-only-payments.md §3.1): settles immediately
// and needs no organizer payout account.
export function DonateForm({
  campaignId,
  viewerCoins,
}: {
  campaignId: string;
  viewerCoins: number;
}) {
  const [state, formAction, pending] = useActionState(donate, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxWidth: "320px" }}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <IdempotencyField />
      <input name="amount" type="number" min="1" step="0.01" placeholder="Amount (coins)" required className="textInput" />
      <input name="message" placeholder="Message (optional)" maxLength={280} className="textInput" />
      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <input type="checkbox" name="isAnonymous" value="true" />
        Donate anonymously (hides your name from public view)
      </label>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          className="button"
          disabled={pending || viewerCoins <= 0}
        >
          {pending ? "Donating…" : `Donate coins${viewerCoins > 0 ? ` · ${viewerCoins} available` : ""}`}
        </button>
      </div>
      {state?.error && <p className="errorText">{state.error}</p>}
      {state?.success && <p className="mutedText" style={{ fontSize: "0.85rem" }}>Thank you for your donation.</p>}
      {viewerCoins <= 0 && <p className="mutedText" style={{ fontSize: "0.8rem" }}>You have no coins yet.</p>}
    </form>
  );
}
