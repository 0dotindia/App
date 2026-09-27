"use client";

import { useActionState } from "react";
import { subscribeToTier } from "@/app/actions/memberships";
import { formatCoins } from "@/lib/coins";

// spec §4: subscribe-to-a-tier form. Coins pay the first period and then
// auto-renew from the wallet (addendum-wallet-only-payments.md §3.3); they
// need no creator payout account, so this renders for any signed-in viewer.
export function SubscribeForm({
  tier,
  viewerCoins,
}: {
  tier: { id: string; name: string; price: number; currency: string; billingInterval: string };
  viewerCoins: number;
}) {
  const [state, formAction, pending] = useActionState(subscribeToTier, undefined);
  const per = tier.billingInterval === "yearly" ? "yr" : "mo";
  const canAffordCoins = viewerCoins >= tier.price;

  return (
    <form action={formAction} style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
      <input type="hidden" name="tierId" value={tier.id} />
      {state?.error && <p className="errorText" style={{ margin: "0.2rem 0", width: "100%" }}>{state.error}</p>}
      {state?.success && <p className="mutedText" style={{ margin: "0.2rem 0", width: "100%", fontSize: "0.85rem" }}>Subscribed.</p>}
      <button
        type="submit"
        className="button buttonSmall"
        disabled={pending || !canAffordCoins}
      >
        {pending ? "Subscribing…" : `${formatCoins(tier.price)}/${per} — renews from your wallet`}
      </button>
      {!canAffordCoins && (
        <p className="mutedText" style={{ margin: "0.2rem 0", width: "100%", fontSize: "0.8rem" }}>
          You have {formatCoins(viewerCoins)} of {formatCoins(tier.price)}.
        </p>
      )}
    </form>
  );
}
