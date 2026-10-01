import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { searchUsers, searchPosts } from "@/lib/search";

const SUGGESTION_LIMIT = 4;
const SNIPPET_LENGTH = 80;

// Backs the header SearchForm's live-suggest dropdown (world-class-pro-level
// review, 2026-10-01: the header search required pressing Enter before
// showing anything, unlike /search's own SearchBox which already live-
// updates as you type — see that component's comment). Reuses the exact
// same lib/search.ts functions /search itself calls, just trimmed to a
// handful of results and reshaped into the small, render-ready fields the
// dropdown needs, same posture as the public /api/v1/search route (trimmed
// to that API's own response fields) but same-origin/session-based instead
// of OAuth-scoped — no rate limiting beyond the client's own debounce,
// matching /search's existing SearchBox, which has none either.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length === 0) return NextResponse.json({ users: [], posts: [] });

  const viewerId = (await getCurrentUser())?.id ?? null;
  const [userResults, postResults] = await Promise.all([searchUsers(q), searchPosts(q, viewerId, null)]);

  return NextResponse.json({
    users: userResults.items.slice(0, SUGGESTION_LIMIT).map((row) => ({
      handle: row.handle,
      displayName: row.user.profile?.displayName ?? row.handle,
      isVerified: row.user.profile?.isVerified ?? false,
    })),
    posts: postResults.items.slice(0, SUGGESTION_LIMIT).map((post) => ({
      id: post.id,
      handle: post.author.username?.handle ?? null,
      displayName: post.author.profile?.displayName ?? "Unknown",
      isVerified: post.author.profile?.isVerified ?? false,
      snippet: post.body.length > SNIPPET_LENGTH ? `${post.body.slice(0, SNIPPET_LENGTH).trimEnd()}…` : post.body,
    })),
  });
}
