"use client";

import { useActionState } from "react";
import { transferCoinsAction } from "@/app/actions/wallet";
import { IdempotencyField } from "@/components/IdempotencyField";

// min/max passed from the server (wallet/page.tsx reads WALLET_LIMITS) rather
// than imported here directly — that module is `import "server-only"`, and
// this is a Client Component.
export function TransferCoinsForm({ minCoins, maxCoins }: { minCoins: number; maxCoins: number }) {
  const [state, formAction, pending] = useActionState(transferCoinsAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <IdempotencyField />
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        Username
        <input type="text" name="handle" placeholder="e.g. jane" required autoComplete="off" />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        Coins
        <input type="number" name="coinAmount" min={minCoins} max={maxCoins} step={1} placeholder="1" required />
      </label>
      <button type="submit" className="button buttonSecondary buttonSmall" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Sending…" : "Send coins"}
      </button>
      {state?.error && (
        <p className="errorText" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && <p className="mutedText">Sent!</p>}
    </form>
  );
}
