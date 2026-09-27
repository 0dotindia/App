// Mirrors the web app's src/lib/coins.ts `formatCoins` exactly — every
// price on 0dot is a coin price (addendum-wallet-only-payments.md §4.1).
export function formatCoins(amount: number): string {
  const n = Number.isInteger(amount) ? amount.toLocaleString() : amount.toFixed(2);
  return `${n} coin${amount === 1 ? "" : "s"}`;
}
