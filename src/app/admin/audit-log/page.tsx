import type { Metadata } from "next";
import { requirePlatformRole } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/EmptyState";
import { RelativeTime } from "@/components/RelativeTime";

export const metadata: Metadata = { title: "Audit log" };

const ACTION_LABEL: Record<string, string> = {
  platform_role_granted: "Platform role granted",
  platform_role_updated: "Platform role changed",
  platform_role_revoked: "Platform role revoked",
  admin_coin_promo_grant: "Coins issued (promo grant)",
  admin_coin_adjustment: "Coins adjusted (goodwill/correction)",
  payment_refunded: "Payment refunded",
  account_recovery_codes_issued: "Account recovery codes issued",
};

// admin+-tier: a single queryable log for every /admin/** write action that
// calls logPlatformAudit (FIX_PLAN P1.4) — before this, admin actions left
// scattered, non-uniform traces (a logger.warn here, an overwritten
// grantedBy column there) with no single place to review them. Mirrors
// org/[orgId]/audit-log/page.tsx's layout almost exactly.
export default async function PlatformAuditLogPage() {
  await requirePlatformRole("admin");

  const entries = await db.platformAuditLog.findMany({
    include: { actor: { include: { username: true, profile: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  function actorName(e: (typeof entries)[number]) {
    if (!e.actor) return "System";
    return e.actor.profile?.displayName ?? e.actor.username?.handle ?? "Unknown";
  }

  return (
    <div className="profileCard">
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem" }}>Audit log</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {entries.length === 0 && <EmptyState title="No admin activity recorded yet." />}
        {entries.map((e) => (
          <div key={e.id} className="profileLinkItem" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.15rem" }}>
            <span>{ACTION_LABEL[e.action] ?? e.action}</span>
            <span className="mutedText" style={{ fontSize: "0.8rem" }}>
              {actorName(e)} · <RelativeTime date={e.createdAt} withTime />
              {e.targetType && e.targetId && ` · ${e.targetType}:${e.targetId}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
