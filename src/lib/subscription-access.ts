// The one "does this subscription currently grant access" where-clause,
// shared by PlatformSubscription (platform-billing.ts, custom-domains.ts)
// and MembershipSubscription (tier-access.ts) — both models carry the same
// status / currentPeriodEnd / processorSubscriptionId trio. Kept free of
// imports so any of those modules can use it without a dependency cycle.

// A coin-funded row is marked by this processorSubscriptionId prefix rather
// than a column (addendum-coin-wallet-v2.md §14).
export const COIN_FUNDED_MARKER = "coin:";

// addendum-wallet-only-payments.md §3.3: how long a coin subscription whose
// renewal charge failed keeps access (as past_due) while the sweep retries.
// Placeholder pending product sign-off (§8 #5).
export const COIN_RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

// Effective access is computed live from status + currentPeriodEnd (phase-5
// §4.3 / premium-profiles §4.2: cancelling keeps access through the period
// end). A function, not a constant: the cut-off must be "now" at query
// time — a module-level `new Date()` froze it at server start, so a
// cancelled subscription kept granting access until the next restart.
// The past_due grace clause is coin-only: a Stripe past_due row loses
// access immediately, exactly as before.
export function effectivelyActiveWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: "active" },
      { status: "cancelled", currentPeriodEnd: { gt: now } },
      {
        status: "past_due",
        processorSubscriptionId: { startsWith: COIN_FUNDED_MARKER },
        currentPeriodEnd: { gt: new Date(now.getTime() - COIN_RENEWAL_GRACE_MS) },
      },
    ],
  };
}

// What a billing screen should say about a subscription's next boundary.
// Coin rows only "renew" when autoRenew is set; rows bought before
// auto-renew existed simply end, and a past_due coin row ends when its
// grace period runs out unless the renewal charge succeeds first.
export function describeRenewal(sub: {
  status: string;
  autoRenew: boolean;
  processorSubscriptionId: string;
  currentPeriodEnd: Date;
}): { kind: "renews" | "ends" | "grace"; date: Date } {
  const coinFunded = sub.processorSubscriptionId.startsWith(COIN_FUNDED_MARKER);
  if (sub.status === "past_due" && coinFunded) {
    return { kind: "grace", date: new Date(sub.currentPeriodEnd.getTime() + COIN_RENEWAL_GRACE_MS) };
  }
  if (sub.status === "cancelled" || (coinFunded && !sub.autoRenew)) {
    return { kind: "ends", date: sub.currentPeriodEnd };
  }
  return { kind: "renews", date: sub.currentPeriodEnd };
}

export const RENEWAL_PREFIX: Record<ReturnType<typeof describeRenewal>["kind"], string> = {
  renews: "Renews ",
  ends: "Access continues until ",
  grace: "Not enough coins to renew — access ends ",
};
