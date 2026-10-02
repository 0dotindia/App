import "server-only";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { generateClientCredentials } from "@/lib/developer-apps";
import { OAUTH_SCOPES, seedOAuthScopes } from "@/lib/oauth";

// phase-15 spec §3.1: 0dot's own iOS/Android/desktop apps register as real
// DeveloperApp rows owned by a designated platform User, rather than
// widening DeveloperApp.owner_type with a "platform" case for something
// that happens a handful of times total, not per-customer.
export const PLATFORM_ACCOUNT_EMAIL = "platform-apps@0dot.internal";

// This account (and any future "@0dot.internal" system account) only ever
// exists to own DeveloperApp rows via ownerUserId — its password hash is an
// unrecoverable random value set at creation, but nothing previously stopped
// the normal password-reset flow from overwriting that hash and making it a
// real, loggable-into account. auth.ts checks this before login and before
// issuing a reset token.
export function isInternalSystemAccountEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@0dot.internal");
}

// Custom URL schemes for the native apps' redirect (native PKCE, §3.2) plus
// an https callback for the PWA/desktop surface — parseRedirectUris
// (developer-apps.ts) rejects non-https/non-localhost URIs since that
// validation exists for user-submitted third-party apps; these are
// server-seeded, so written directly.
//
// "zerodot-*", not "0dot-*": a URI scheme must start with a letter (RFC
// 3986 §3.1's `scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )`) —
// mobile/app.json's own scheme registration failed expo-doctor's schema
// validation against a leading digit, which is what surfaced this.
// Exported so anything needing "the current first-party app catalog" (e.g.
// the oauth-scopes debug route) derives it from this single source instead
// of re-typing the name list, which would silently desync from this if an
// app is renamed or a platform added here.
export const FIRST_PARTY_APPS = [
  { platform: "ios", name: "0dot iOS App", description: "0dot's first-party iOS app.", redirectUris: ["zerodot-ios://oauth/callback"] },
  { platform: "android", name: "0dot Android App", description: "0dot's first-party Android app.", redirectUris: ["zerodot-android://oauth/callback"] },
  { platform: "desktop", name: "0dot Desktop", description: "0dot's first-party desktop app (installable PWA).", redirectUris: ["https://0dot.in/desktop/oauth/callback"] },
] as const;

export type FirstPartyPlatform = (typeof FIRST_PARTY_APPS)[number]["platform"];

// Exposed so callers (oauth/authorize/page.tsx) can gate self-healing scope
// approval to apps 0dot itself owns both sides of — never for a third-party
// DeveloperApp, where an unapproved scope must keep failing closed (§3.3).
export async function isFirstPartyOwner(ownerUserId: string | null): Promise<boolean> {
  if (!ownerUserId) return false;
  const platformUser = await ensurePlatformAccount();
  return ownerUserId === platformUser.id;
}

async function ensurePlatformAccount(): Promise<{ id: string }> {
  const existing = await db.user.findUnique({ where: { email: PLATFORM_ACCOUNT_EMAIL }, select: { id: true } });
  if (existing) return existing;

  // Unusable password — this account is never meant to log in through the
  // normal /login flow, only to own DeveloperApp rows via ownerUserId.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  return db.user.create({
    data: { email: PLATFORM_ACCOUNT_EMAIL, passwordHash, emailVerifiedAt: new Date(), status: "active" },
    select: { id: true },
  });
}

// Idempotent — safe to call on every server start (instrumentation.ts),
// same "ensure the fixed catalog exists" idiom as seedOAuthScopes rather
// than a one-off migration seed step this codebase doesn't have.
export async function ensureFirstPartyApps(): Promise<void> {
  await seedOAuthScopes();
  const platformUser = await ensurePlatformAccount();

  const appIds: string[] = [];
  for (const spec of FIRST_PARTY_APPS) {
    // findMany, not findFirst: DeveloperApp has no unique constraint on
    // (ownerUserId, name) (clientId is the only @unique column), so two
    // instances racing this find-then-create on a cold Vercel scale-from-zero
    // can each see no row and each `create()` their own — a second,
    // orphaned "0dot Android App" row with its own clientId and zero
    // DeveloperAppScope rows. getFirstPartyClientIds' name->clientId Map is
    // then one bad write away from handing that empty-scopes orphan's
    // clientId to the mobile app instead of the one this function actually
    // backfilled scopes for, which is what "This app isn't approved to
    // request: <every scope>" actually was — not a stale scope catalog.
    const matches = await db.developerApp.findMany({
      where: { ownerUserId: platformUser.id, name: spec.name },
      orderBy: { createdAt: "asc" },
    });

    let primary = matches[0];
    if (matches.length > 1) {
      // Prefer whichever duplicate already has approved scopes — that's the
      // one any already-issued client_id response may have pointed at —
      // falling back to the oldest row if none do yet.
      const approvedCounts = await db.developerAppScope.groupBy({
        by: ["appId"],
        where: { appId: { in: matches.map((m) => m.id) }, status: "approved" },
        _count: { appId: true },
      });
      const approvedCountByAppId = new Map(approvedCounts.map((c) => [c.appId, c._count.appId]));
      primary = [...matches].sort((a, b) => {
        const byApprovedScopes = (approvedCountByAppId.get(b.id) ?? 0) - (approvedCountByAppId.get(a.id) ?? 0);
        return byApprovedScopes !== 0 ? byApprovedScopes : a.createdAt.getTime() - b.createdAt.getTime();
      })[0];
      for (const dup of matches) {
        if (dup.id !== primary.id) await mergeDuplicateFirstPartyApp(primary.id, dup.id);
      }
    }

    let appId: string;
    if (primary) {
      // Self-healing for rows created before isPublicClient existed, or with
      // the invalid "0dot-*" scheme (see FIRST_PARTY_APPS' comment above) —
      // same "runs on every server start, patches forward" idiom the rest of
      // this function already relies on, rather than a one-off migration
      // backfill.
      const wantRedirectUris = JSON.stringify(spec.redirectUris);
      const patch: { isPublicClient?: true; redirectUrisJson?: string } = {};
      if (!primary.isPublicClient) patch.isPublicClient = true;
      if (primary.redirectUrisJson !== wantRedirectUris) patch.redirectUrisJson = wantRedirectUris;
      if (Object.keys(patch).length > 0) {
        await db.developerApp.update({ where: { id: primary.id }, data: patch });
      }
      appId = primary.id;
    } else {
      const { clientId, clientSecretHash } = await generateClientCredentials();
      const app = await db.developerApp.create({
        data: {
          ownerType: "user",
          ownerUserId: platformUser.id,
          name: spec.name,
          description: spec.description,
          clientId,
          clientSecretHash,
          isPublicClient: true,
          redirectUrisJson: JSON.stringify(spec.redirectUris),
        },
      });
      appId = app.id;
    }
    appIds.push(appId);
  }

  // spec §3.3: the security model doesn't relax for first-party apps —
  // every scope goes through the same DeveloperAppScope row a third-party
  // app would have, just pre-approved outright (0dot owns both sides of
  // this grant) rather than sitting `pending` for high-sensitivity scopes
  // the way an external app's request would.
  //
  // Covers existing apps too, not just newly-created ones — otherwise a
  // scope added to OAUTH_SCOPES after an app's first boot would never get
  // backfilled, and the first-party app's own OAuth flow would start
  // failing resolveApprovableScopes ("This app isn't approved to request:
  // ...") the moment it asked for the new scope.
  //
  // One read of what's already there + one bulk insert of the diff — NOT a
  // per-(app, scope) upsert. That was ~80 sequential libSQL round trips,
  // each its own interactive transaction, running fire-and-forget from
  // instrumentation.ts's register(). On a cold Vercel boot the event loop
  // is busy rendering the first request, so a transaction opened here could
  // sit open long enough for Turso to expire its stream server-side and
  // fail every remaining statement with "SERVER_ERROR: HTTP status 404"
  // (harmless — fire-and-forget, and the rows already exist — but it filled
  // the error logs on every scale-from-zero after the aws-ap-south-1 move).
  const wantPairs = appIds.flatMap((appId) =>
    OAUTH_SCOPES.map((scope) => ({ appId, scopeKey: scope.key })),
  );
  const existingScopeRows = await db.developerAppScope.findMany({
    where: { appId: { in: appIds } },
    select: { appId: true, scopeKey: true },
  });
  const pairKey = (appId: string, scopeKey: string) => JSON.stringify([appId, scopeKey]);
  const have = new Set(existingScopeRows.map((r) => pairKey(r.appId, r.scopeKey)));
  const toCreate = wantPairs
    .filter((p) => !have.has(pairKey(p.appId, p.scopeKey)))
    .map((p) => ({ appId: p.appId, scopeKey: p.scopeKey, status: "approved", reviewedAt: new Date() }));
  if (toCreate.length > 0) {
    try {
      await db.developerAppScope.createMany({ data: toCreate });
    } catch (err) {
      // A second instance booting concurrently can race us to the same
      // inserts; its rows landing first is a success, not a failure. Any
      // other error propagates to runStartupTask's logger.
      if (!isUniqueConstraintError(err)) throw err;
    }
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "P2002";
}

// Folds a race-created duplicate DeveloperApp row into the primary one and
// removes it. In practice a duplicate first-party row is a pure orphan —
// resolveApprovableScopes fails every authorize request closed before a
// user could ever grant it access, since it has zero DeveloperAppScope rows
// — but this merges rather than assumes that, in case some other process
// (a webhook registration, a usage counter tick) attached to it in the
// window before this ran.
async function mergeDuplicateFirstPartyApp(primaryId: string, duplicateId: string): Promise<void> {
  await db.oAuthAuthorizationCode.updateMany({ where: { appId: duplicateId }, data: { appId: primaryId } });
  await db.webhookSubscription.updateMany({ where: { appId: duplicateId }, data: { appId: primaryId } });
  await db.marketplaceListing.updateMany({ where: { developerAppId: duplicateId }, data: { developerAppId: primaryId } });

  // appId+userId is @@unique on OAuthAuthorization — move what doesn't
  // collide; where the primary already has a grant for that user, keep
  // "active" over "revoked" rather than leave the duplicate's row to be
  // silently cascade-deleted below.
  const duplicateAuthorizations = await db.oAuthAuthorization.findMany({ where: { appId: duplicateId } });
  for (const authorization of duplicateAuthorizations) {
    try {
      await db.oAuthAuthorization.update({ where: { id: authorization.id }, data: { appId: primaryId } });
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      if (authorization.status === "active") {
        await db.oAuthAuthorization.updateMany({
          where: { appId: primaryId, userId: authorization.userId },
          data: { status: "active", grantedScopesJson: authorization.grantedScopesJson, revokedAt: null },
        });
      }
    }
  }

  // appId+windowStart is @@unique on ApiUsageCounter — sum request counts
  // into the primary's window rather than lose them.
  const duplicateCounters = await db.apiUsageCounter.findMany({ where: { appId: duplicateId } });
  for (const counter of duplicateCounters) {
    const existing = await db.apiUsageCounter.findUnique({
      where: { appId_windowStart: { appId: primaryId, windowStart: counter.windowStart } },
    });
    if (existing) {
      await db.apiUsageCounter.update({ where: { id: existing.id }, data: { requestCount: existing.requestCount + counter.requestCount } });
    } else {
      await db.apiUsageCounter.update({ where: { id: counter.id }, data: { appId: primaryId } });
    }
  }

  // DeveloperAppScope cascade-deletes with the row below — nothing to carry
  // forward, since a duplicate only ever ends up with approved scopes if
  // it was the one ensureFirstPartyApps' caller resolved as primary, which
  // by construction is never the id passed in here as duplicateId.
  await db.developerApp.delete({ where: { id: duplicateId } });
}

// phase-15 build plan step 3: client_id is generated randomly per
// environment (generateClientCredentials, developer-apps.ts) rather than a
// fixed constant a compiled app could hardcode — a mobile build needs a way
// to discover its own client_id at runtime. client_id is not sensitive (the
// OAuth authorization redirect already puts it in a browser-visible URL),
// so this is safe to expose without auth; see the GET route at
// /api/oauth/first-party-clients.
export async function getFirstPartyClientIds(): Promise<Record<FirstPartyPlatform, string | null>> {
  const platformUser = await ensurePlatformAccount();
  let apps = await db.developerApp.findMany({ where: { ownerUserId: platformUser.id }, select: { name: true, clientId: true } });

  // instrumentation.ts's register() is supposed to have already run
  // ensureFirstPartyApps() once at boot, before this instance ever serves a
  // request — but a production check after first deploying this route
  // showed it returning null client_ids consistently across a warm,
  // already-serving instance, an outcome that shouldn't be reachable if
  // register() genuinely ran and awaited successfully first. Rather than
  // leave every first-party client permanently unable to even start
  // sign-in on an unclear boot-time race, this read path is self-healing
  // too — ensureFirstPartyApps is the same idempotent call register()
  // already makes, just invoked lazily here as a fallback instead of only
  // trusted to have already succeeded.
  // Also re-runs when a name appears more than once, not only when one is
  // missing — a race-created duplicate (see ensureFirstPartyApps) means the
  // name IS present, just twice, and the Map below would otherwise pick
  // whichever row happens to sort last with no guarantee it's the one that
  // actually has approved scopes.
  const names = apps.map((a) => a.name);
  const hasMissingApp = FIRST_PARTY_APPS.some((spec) => !names.includes(spec.name));
  const hasDuplicateApp = new Set(names).size !== names.length;
  if (hasMissingApp || hasDuplicateApp) {
    await ensureFirstPartyApps();
    apps = await db.developerApp.findMany({ where: { ownerUserId: platformUser.id }, select: { name: true, clientId: true } });
  }

  const clientIdByName = new Map(apps.map((a) => [a.name, a.clientId]));
  return Object.fromEntries(
    FIRST_PARTY_APPS.map((spec) => [spec.platform, clientIdByName.get(spec.name) ?? null])
  ) as Record<FirstPartyPlatform, string | null>;
}
