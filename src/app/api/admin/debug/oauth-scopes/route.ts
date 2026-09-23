import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { hasPlatformRole } from "@/lib/auth-guards";
import { FIRST_PARTY_APPS } from "@/lib/first-party-apps";

// Ops diagnostic for the "This app isn't approved to request: ..." OAuth
// consent error — lets an admin confirm from a browser whether
// ensureFirstPartyApps() actually backfilled DeveloperAppScope approval for
// the first-party apps' catalog scopes, without needing raw DB credentials.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  // Shared rank-based check (auth-guards.ts) instead of a bespoke
  // `role !== "super_admin"` comparison — that check alone would miss the
  // fail-open guard on an unrecognized/corrupted role string that
  // hasPlatformRole's own PLATFORM_ROLE_RANK[...] ?? 0 comparison exists to
  // catch.
  if (!user || !(await hasPlatformRole(user.id, "super_admin"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const apps = await db.developerApp.findMany({
    where: { name: { in: FIRST_PARTY_APPS.map((spec) => spec.name) } },
    select: {
      id: true,
      name: true,
      clientId: true,
      isPublicClient: true,
      scopes: { select: { scopeKey: true, status: true, requestedAt: true, reviewedAt: true } },
    },
  });

  return NextResponse.json({ apps });
}
