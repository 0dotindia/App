import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

// "IDs of every account this user follows" — the follow-graph lookup that
// /feed's page, the ContextualRail (layout chrome), and getSuggestedUsers
// (also in the rail) each ran independently, firing the identical query
// three times per /feed render, every one a round trip to the libsql
// backend. cache() collapses them into one call per request, same posture
// as getCurrentUser in session.ts.
//
// status: "accepted" only — a security fix, not a style choice. /feed's
// page builds its home-feed author allow-list straight from this list with
// no other gate in between (getPostVisibilityConditions, post-visibility.ts,
// has no private-account check of its own), so a "pending" row (a follow
// request against a private account still awaiting approval — see
// followUser, actions/follow.ts) used to leak that account's posts into the
// requester's home feed before they were ever approved.
export const getFolloweeIds = cache(async (userId: string): Promise<string[]> => {
  const rows = await db.follow.findMany({
    where: { followerId: userId, status: "accepted" },
    select: { followeeId: true },
  });
  return rows.map((r) => r.followeeId);
});
