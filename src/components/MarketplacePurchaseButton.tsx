"use client";

import { useActionState } from "react";
import { purchaseMarketplaceListing } from "@/app/actions/marketplace";

// spec §4.3/§5.1: nullable price means free — purchaseMarketplaceListing
// skips the payment backbone entirely for those, same nullable-price-means-
// free shape OfferingBuyButton already uses for Offering. The coin rail
// (addendum-wallet-only-payments.md §3.2) needs no seller payout account;
// `cardAvailable` toggles the card button.
export function MarketplacePurchaseButton({
  listingId,
  price,
  currency,
  cardAvailable,
  viewerCoins,
}: {
  listingId: string;
  price: number | null;
  currency: string | null;
  cardAvailable: boolean;
  viewerCoins: number;
}) {
  const [state, formAction, pending] = useActionState(purchaseMarketplaceListing, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />
      {state?.error && <p className="errorText" style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>{state.error}</p>}
      {state?.success && <p className="mutedText" style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>Purchased.</p>}
      {price === null ? (
        <button type="submit" className="button buttonSmall" disabled={pending}>
          {pending ? "Getting it…" : "Get it free"}
        </button>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {cardAvailable && (
              <button type="submit" name="payWith" value="card" className="button buttonSmall" disabled={pending}>
                {pending ? "Buying…" : `Buy — ${price.toFixed(2)} ${(currency ?? "usd").toUpperCase()}`}
              </button>
            )}
            <button
              type="submit"
              name="payWith"
              value="coins"
              className={cardAvailable ? "button buttonSmall buttonSecondary" : "button buttonSmall"}
              disabled={pending || viewerCoins < price}
            >
              {pending ? "Buying…" : `${price} coins`}
            </button>
          </div>
          {viewerCoins < price && (
            <p className="mutedText" style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>You have {viewerCoins} of {price} coins.</p>
          )}
        </>
      )}
    </form>
  );
}
