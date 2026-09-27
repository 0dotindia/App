// Display a coin amount (addendum-wallet-only-payments.md §4.1: every price
// is a coin price). Whole amounts print bare, fractional ones to cents.
// Dependency-free so client and server components can both use it.
export function formatCoins(amount: number): string {
  const n = Number.isInteger(amount) ? amount.toLocaleString() : amount.toFixed(2);
  return `${n} coin${amount === 1 ? "" : "s"}`;
}
