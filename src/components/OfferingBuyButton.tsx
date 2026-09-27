"use client";

import { useActionState } from "react";
import { purchaseOffering } from "@/app/actions/offerings";
import { IdempotencyField } from "@/components/IdempotencyField";

// phase-9 spec §3.1: native in-app checkout for a priced Offering. The coin
// rail (addendum-coin-wallet-v2.md §6.4) needs no seller payout account, so
// this renders whenever a signed-in viewer can see the offering.
export function OfferingBuyButton({
  offeringId,
  price,
  viewerCoins,
}: {
  offeringId: string;
  price: number;
  viewerCoins: number;
}) {
  const [state, formAction, pending] = useActionState(purchaseOffering, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="quantity" value="1" />
      <IdempotencyField />
      {state?.error && <p className="errorText" style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>{state.error}</p>}
      {state?.success && <p className="mutedText" style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>Purchased.</p>}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          className="button buttonSmall"
          disabled={pending || viewerCoins < price}
        >
          {pending ? "Buying…" : `${price} coins`}
        </button>
      </div>
      {viewerCoins < price && (
        <p className="mutedText" style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>You have {viewerCoins} of {price} coins.</p>
      )}
    </form>
  );
}
