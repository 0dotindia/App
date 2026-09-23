import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { PLATFORM_ROLE_RANK } from "@/lib/platform-roles";

// Shared by every "use server" action file that needs an authenticated,
// verified user (posts, follow, block, notifications) — extracted once
// enough call sites needed the identical check that copy-pasting it a
// third/fourth time would drift.
export async function requireVerifiedUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.emailVerifiedAt) redirect("/verify/sent");
  return user;
}

export async function requireOwnProfile() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/claim-username");
  return user;
}

// Unified platform-wide role — replaces the old isPlatformAdmin boolean and
// the old TrustSafetyStaffRole table (see PlatformRole in schema.prisma).
// Manually granted via /admin/platform-roles (super_admin only) or direct
// DB access for the very first super_admin, same "no self-serve flow"
// posture as Profile.isVerified.
type PlatformRoleName = "support" | "admin" | "super_admin";

// Pure rank check, no DB call and no redirect — shared by requirePlatformRole
// and hasPlatformRole below so a route re-implementing its own
// `role !== "super_admin"` check can't accidentally miss the fail-open guard
// here (an unrecognized role string would otherwise make
// PLATFORM_ROLE_RANK[...] undefined, and `undefined < N` is always false in
// JS — through instead of rejected).
function rankAtLeast(platformRole: { role: string } | null, minRole: PlatformRoleName): boolean {
  return !!platformRole && (PLATFORM_ROLE_RANK[platformRole.role] ?? 0) >= PLATFORM_ROLE_RANK[minRole];
}

// For a JSON-returning API route that needs the same rank check as
// requirePlatformRole without a redirect() (which would send an
// unauthorized caller to "/" instead of a clean 403 response).
export async function hasPlatformRole(userId: string, minRole: PlatformRoleName): Promise<boolean> {
  const platformRole = await db.platformRole.findUnique({ where: { userId } });
  return rankAtLeast(platformRole, minRole);
}

export async function requirePlatformRole(minRole: PlatformRoleName = "support") {
  const user = await requireVerifiedUser();
  const platformRole = await db.platformRole.findUnique({ where: { userId: user.id } });
  if (!rankAtLeast(platformRole, minRole)) redirect("/");
  return { user, platformRole: platformRole! };
}
