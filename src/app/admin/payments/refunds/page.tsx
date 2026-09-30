import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/EmptyState";
import { RefundPaymentForm } from "./RefundPaymentForm";
import { formatCoins } from "@/lib/coins";
import { RelativeTime } from "@/components/RelativeTime";

// addendum-wallet-only-payments.md §3.6: refund a coin payment back to the
// payer's wallet. Lists recent coin payments, optionally narrowed to one
// payer by ?user=<handle>.
export default async function AdminRefundsPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  await requirePlatformRole("admin");
  const { user: handleParam } = await searchParams;
  const handle = handleParam?.trim().toLowerCase() || null;

  const payer = handle ? await db.username.findUnique({ where: { handle }, select: { userId: true } }) : null;
  const payments =
    handle && !payer
      ? []
      : await db.paymentTransaction.findMany({
          where: { processor: "wallet", ...(payer ? { payerId: payer.userId } : {}) },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            payer: { select: { username: { select: { handle: true } } } },
            payee: { select: { username: { select: { handle: true } } } },
            payeeBusiness: { select: { slug: true } },
          },
        });

  return (
    <div className="profileCard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Coin refunds</h1>
        <Link href="/admin/payments" className="mutedText" style={{ fontSize: "0.85rem" }}>
          ← Payments
        </Link>
      </div>
      <p className="mutedText" style={{ marginBottom: "1rem" }}>
        Refunds the full amount to the payer&apos;s spendable coins, funded by the platform. The seller keeps their
        earnings and the buyer keeps what they bought — revoke access separately if needed.
      </p>

      <form method="get" style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        <input name="user" defaultValue={handle ?? ""} placeholder="Payer username" className="textInput" style={{ maxWidth: "24ch" }} />
        <button type="submit" className="button buttonSmall">Filter</button>
      </form>

      {payments.length === 0 && <EmptyState title={handle && !payer ? "No user with that username." : "No coin payments yet."} />}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {payments.map((pt) => {
          const payee = pt.payee?.username ? `@${pt.payee.username.handle}` : pt.payeeBusiness ? `/b/${pt.payeeBusiness.slug}` : "0dot";
          return (
            <div key={pt.id} className="profileLinkItem" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}>
              <span>
                <strong>{formatCoins(pt.amount)}</strong> · {pt.kind} · {pt.payer?.username ? `@${pt.payer.username.handle}` : "deleted user"} → {payee}
              </span>
              <span className="mutedText" style={{ fontSize: "0.8rem" }}>
                <RelativeTime date={pt.createdAt} withTime /> · {pt.status}
              </span>
              {pt.status === "succeeded" && pt.payerId && <RefundPaymentForm paymentTransactionId={pt.id} amount={pt.amount} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
