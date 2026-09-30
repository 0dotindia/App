import "server-only";
import { db } from "@/lib/db";
import { getActiveMaxTierLevelsByCreator } from "@/lib/tier-access";

// Bulk sibling of blocks.ts's isBlockedEitherWay — one query pair per feed
// render instead of one isBlockedEitherWay() call per candidate post.
export async function getBlockedEitherWayUserIds(viewerId: string): Promise<string[]> {
  const [blockedByViewer, blockedViewer] = await Promise.all([
    db.block.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
    db.block.findMany({ where: { blockedId: viewerId }, select: { blockerId: true } }),
  ]);
  const ids = new Set<string>();
  for (const row of blockedByViewer) ids.add(row.blockedId);
  for (const row of blockedViewer) ids.add(row.blockerId);
  return [...ids];
}

// phase-5 spec §4.2/§4.3: the one gating rule reused everywhere a post list
// is built — including the community feed (src/lib/community-feed.ts),
// which otherwise deliberately skips the rest of this file's conditions
// (community-privacy is already gated at that page's own level). Tier
// gating isn't community-scoped the way that privacy check is: a gated
// post can appear inside a community too (ComposeBox's communityId and
// requiredTierId props are independent), so it needs this same check
// wherever posts list, not just Home/Explore/profile. Ungated posts, a
// viewer's own posts (a creator always sees their own gated content), and
// posts gated to a tier the viewer currently holds an equal-or-higher-level
// active subscription to are visible; everything else gated is excluded
// entirely from the list — not a locked teaser, one consistent mechanism.
export async function getTierGatingCondition(viewerId: string | null) {
  const maxTierLevelsByCreator = viewerId ? await getActiveMaxTierLevelsByCreator(viewerId) : new Map<string, number>();
  return {
    OR: [
      { requiredTierId: null },
      ...(viewerId ? [{ authorId: viewerId }] : []),
      ...[...maxTierLevelsByCreator.entries()].map(([creatorId, maxLevel]) => ({
        AND: [{ authorId: creatorId }, { requiredTier: { is: { level: { lte: maxLevel } } } }],
      })),
    ],
  };
}

// Shared visibility gate for every surface that lists posts outside a
// single already-gated context (a community's own page already checks
// canViewContent itself): Home, Explore, Trending, and a public profile's
// post list. Returns independent where-fragments meant to be spread into an
// `AND` array — never merged into the same object as cursorWhere's own
// top-level `OR`, which would silently overwrite it.
export async function getPostVisibilityConditions(viewerId: string | null, precomputedBlockedIds?: string[]) {
  const blockedIds = precomputedBlockedIds ?? (viewerId ? await getBlockedEitherWayUserIds(viewerId) : []);
  const tierGating = await getTierGatingCondition(viewerId);

  const communityPrivacy = {
    OR: [
      { communityId: null },
      { community: { is: { visibility: { not: "private" } } } },
      ...(viewerId
        ? [{ community: { is: { members: { some: { userId: viewerId, status: { in: ["active", "muted"] } } } } } }]
        : []),
    ],
  };

  const blockExclusion = { authorId: { notIn: blockedIds } };

  // Security fix: a private account's posts must not appear in a
  // scope-crossing list (Home/Explore/Trending/a public profile's post
  // list) unless the viewer is the author or an *accepted* follower.
  // Follow.status distinguishes "pending" (a request against a private
  // account, not yet approved) from "accepted" specifically so approval
  // can gate this (see the Follow model's own comment in schema.prisma),
  // but nothing here actually enforced it — only the profile page's own
  // canViewFullProfile did, which this function's callers never go
  // through. That left Explore/Trending open to literally anyone and Home
  // open to any pending (unapproved) follower; see getFolloweeIds
  // (follow-graph.ts) for the matching fix on the Home-feed author list.
  const accountPrivacy = {
    OR: [
      { author: { is: { profile: { is: { isPrivate: false } } } } },
      ...(viewerId
        ? [
            { authorId: viewerId },
            { author: { is: { followedBy: { some: { followerId: viewerId, status: "accepted" } } } } },
          ]
        : []),
    ],
  };

  const pendingBusinessExclusion = {
    OR: [{ businessAuthorId: null }, { businessAuthor: { is: { status: { not: "pending" } } } }],
  };

  const repostVisibility = {
    OR: [
      { repostOfId: null },
      { repostOf: { is: { AND: [communityPrivacy, blockExclusion, pendingBusinessExclusion, tierGating, accountPrivacy] } } },
    ],
  };

  return [communityPrivacy, blockExclusion, pendingBusinessExclusion, tierGating, accountPrivacy, repostVisibility];
}
