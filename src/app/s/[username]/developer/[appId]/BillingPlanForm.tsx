"use client";

import { useActionState } from "react";
import { updateBillingPlan } from "@/app/actions/developer-apps";

export function BillingPlanForm({
  appId,
  billingPlan,
  pricing,
}: {
  appId: string;
  billingPlan: string;
  pricing: { includedRequests: number; per1000Over: number; committed: number };
}) {
  const [state, formAction, pending] = useActionState(updateBillingPlan, undefined);
  const planLabel: Record<string, string> = {
    free: "Free — rate-limited, no charge",
    pay_as_you_go: `Pay as you go — no hard cap, ${pricing.includedRequests.toLocaleString()} requests/month included, then ${pricing.per1000Over} coins per 1,000`,
    committed: `Committed — ${pricing.committed} coins/month up front, no hard cap`,
  };

  return (
    <form action={formAction} className="settingsForm">
      <input type="hidden" name="appId" value={appId} />
      <select name="billingPlan" defaultValue={billingPlan} className="textInput" style={{ maxWidth: "28rem" }}>
        {Object.entries(planLabel).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button type="submit" className="button buttonSecondary buttonSmall" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save billing plan"}
      </button>
      {state?.error && (
        <p className="errorText" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && <p className="mutedText" style={{ fontSize: "0.85rem" }}>Billing plan saved.</p>}
    </form>
  );
}
