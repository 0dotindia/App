import "server-only";
import { db } from "@/lib/db";

// FIX_PLAN P1.4: the platform-wide counterpart to logOrgAudit
// (organizations.ts) — same shape, minus the org scope. Admin actions on
// /admin/** left scattered, non-uniform traces before this (a logger.warn
// here, an overwritten grantedBy column there) with no single queryable
// log.
export function logPlatformAudit(args: {
  actorId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<unknown> {
  return db.platformAuditLog.create({
    data: {
      actorId: args.actorId,
      action: args.action,
      targetType: args.targetType ?? null,
      targetId: args.targetId ?? null,
      metadataJson: args.metadata ? JSON.stringify(args.metadata) : null,
    },
  });
}
