import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureTrendingScoresFresh, getTrendingPosts, parseTrendingCursor } from "@/lib/trending";
import { getVotedPollOptionIds, getRepostedPostIds } from "@/lib/feed-query";
import { FeedList } from "@/app/feed/FeedList";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Trending" };

// Trending: velocity-ranked third feed, distinct from both Home (/feed,
// follow-filtered) and Explore (/explore, global chronological) — phase-2
// spec §6.2. Same FeedList/PostCard rendering as those two; only the
// backing query differs (see src/lib/trending.ts).
export default async function TrendingPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await ensureTrendingScoresFresh();

  const currentUser = await getCurrentUser();
  const { cursor: rawCursor } = await searchParams;
  const cursor = parseTrendingCursor(rawCursor);

  const { items: posts, nextCursor } = await getTrendingPosts({ cursor, viewerId: currentUser?.id ?? null });

  const postIds = posts.map((p) => p.id);
  const [likedPostIds, bookmarkedPostIds, repostedPostIds, votedOptionIds] = await Promise.all([
    currentUser
      ? db.postLike
          .findMany({ where: { userId: currentUser.id, postId: { in: postIds } }, select: { postId: true } })
          .then((rows) => new Set(rows.map((r) => r.postId)))
      : Promise.resolve(new Set<string>()),
    currentUser
      ? db.bookmark
          .findMany({ where: { userId: currentUser.id, postId: { in: postIds } }, select: { postId: true } })
          .then((rows) => new Set(rows.map((r) => r.postId)))
      : Promise.resolve(new Set<string>()),
    getRepostedPostIds(currentUser?.id, postIds),
    getVotedPollOptionIds(currentUser?.id, posts),
  ]);

  return (
    <FeedList
      posts={posts}
      currentUser={currentUser}
      likedPostIds={likedPostIds}
      bookmarkedPostIds={bookmarkedPostIds}
      repostedPostIds={repostedPostIds}
      votedOptionIds={votedOptionIds}
      nextCursor={nextCursor}
      basePath="/trending"
      showComposer={false}
      header={
        <PageHeader
          eyebrow="Trending"
          title="What's picking up right now"
          description="Velocity-ranked, not just popular — posts gaining traction fast, whether or not you follow the author."
        />
      }
    />
  );
}
