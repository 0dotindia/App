import "server-only";
import { db } from "@/lib/db";
import { cached } from "@/lib/cache/redis-cache";
import { getPostVisibilityConditions } from "@/lib/post-visibility";
import { cursorWhere, encodeCursor, parseCursor } from "@/lib/pagination";
import { FRONT_PAGE, toHeadline } from "@/lib/landing-content";

export type Dispatch = {
  id: string;
  body: string;
  createdAt: Date;
  imageUrl: string | null;
  likeCount: number;
  replyCount: number;
};

export type OfficialDesk = {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  dispatches: Dispatch[];
};

export const DISPATCH_COUNT = 6;

// The landing page's "Latest dispatches" column + ticker: the official
// account's own top-level posts, read with the same anonymous-viewer
// visibility rules /explore uses (getPostVisibilityConditions(null)), so a
// private account, a suspended author, or a subscribers-only post can never
// leak onto the public front page. Plain standalone posts only — no
// replies, reposts, community or business posts — since each renders as a
// headline without the context those would need.
//
// Cached briefly: "/" is the highest-traffic anonymous page, and a new
// dispatch showing up a minute late is fine.
export async function getOfficialDesk(handle: string = FRONT_PAGE.officialHandle): Promise<OfficialDesk | null> {
  return cached(`front-page:desk:${handle}`, 60, async () => {
    const username = await db.username.findUnique({
      where: { handle },
      select: { userId: true, user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } } },
    });
    if (!username) return null;

    const visibilityConditions = await getPostVisibilityConditions(null, []);
    const posts = await db.post.findMany({
      where: {
        authorId: username.userId,
        deletedAt: null,
        replyToId: null,
        repostOfId: null,
        communityId: null,
        businessAuthorId: null,
        requiredTierId: null,
        AND: visibilityConditions,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: DISPATCH_COUNT,
      select: {
        id: true,
        body: true,
        createdAt: true,
        likeCount: true,
        replyCount: true,
        media: { where: { type: "image" }, orderBy: { position: "asc" }, take: 1, select: { url: true } },
      },
    });

    return {
      handle,
      displayName: username.user.profile?.displayName ?? handle,
      avatarUrl: username.user.profile?.avatarUrl ?? null,
      dispatches: posts.map(({ media, ...p }) => ({ ...p, imageUrl: media[0]?.url ?? null })),
    };
  });
}

export type PlatformStats = { totalUsers: number; postsToday: number; liveCommunities: number };

// The masthead's "proof of scale" strip (FrontPage.tsx only renders it once
// totalUsers crosses FRONT_PAGE.statsMinUsers — see that constant's comment).
// Cached like the rest of this file's queries: a minute-old count is fine
// for a number that only needs to look roughly right, not exact.
export async function getPlatformStats(): Promise<PlatformStats> {
  return cached("front-page:stats", 60, async () => {
    const todayIST = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T00:00:00+05:30`);
    const [totalUsers, postsToday, liveRooms] = await Promise.all([
      db.user.count({ where: { status: "active" } }),
      db.post.count({ where: { deletedAt: null, createdAt: { gte: todayIST } } }),
      // Rooms, not communities — distinct so a community running 2+ live
      // rooms at once doesn't get counted twice.
      db.voiceRoom.findMany({ where: { status: "live" }, select: { communityId: true }, distinct: ["communityId"] }),
    ]);
    return { totalUsers, postsToday, liveCommunities: liveRooms.length };
  });
}

// ── The Wire ─────────────────────────────────────────────────────────
// The landing page's endless stream below the fixed sections. It runs in
// two phases behind one opaque cursor: the official account's older posts
// (the ones past the dispatches column), then public posts from across
// 0dot, newest first. A cursor is "<phase>_<iso>~<id>" ("o" or "p"), or
// "p_" alone to start the public phase from the top.

export type WireItem = {
  id: string;
  headline: string;
  rest: string;
  createdAt: Date;
  imageUrl: string | null;
  likeCount: number;
  replyCount: number;
  official: boolean;
  author: { handle: string; displayName: string; avatarUrl: string | null };
};

export type WirePage = { items: WireItem[]; next: string | null };

export const WIRE_PAGE_SIZE = 12;

// Where the Wire starts, given what the dispatches column already showed:
// continue the official account past its last dispatch if the column was
// full (there may be more), else go straight to public posts.
export function initialWireCursor(desk: OfficialDesk | null): string {
  const last = desk?.dispatches.at(-1);
  return desk && last && desk.dispatches.length >= DISPATCH_COUNT ? `o_${encodeCursor(last)}` : "p_";
}

export function parseWireCursor(raw: string | null | undefined): { phase: "o" | "p"; after: ReturnType<typeof parseCursor> } | null {
  if (!raw || raw[1] !== "_" || (raw[0] !== "o" && raw[0] !== "p")) return null;
  const rest = raw.slice(2);
  const after = rest ? parseCursor(rest) : null;
  if (rest && !after) return null;
  return { phase: raw[0], after };
}

// Stricter than /explore on purpose: this is a marketing surface that puts
// strangers' posts in front of every visitor, so it only takes posts from
// active accounts that opted into discovery and aren't private — the same
// author bar sitemap.ts uses for what it advertises to search engines.
const promotableAuthor = {
  author: { is: { status: "active", profile: { is: { isPrivate: false, discoverableInSearch: true } } } },
};

async function fetchWirePosts(phase: "o" | "p", after: ReturnType<typeof parseCursor>, officialUserId: string | null) {
  const visibilityConditions = await getPostVisibilityConditions(null, []);
  const authorScope =
    phase === "o"
      ? { authorId: officialUserId ?? "" }
      : { ...(officialUserId ? { authorId: { not: officialUserId } } : {}), ...promotableAuthor };
  return db.post.findMany({
    where: {
      deletedAt: null,
      replyToId: null,
      repostOfId: null,
      businessAuthorId: null,
      requiredTierId: null,
      ...authorScope,
      AND: [...visibilityConditions, cursorWhere(after)],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: WIRE_PAGE_SIZE + 1,
    select: {
      id: true,
      body: true,
      createdAt: true,
      likeCount: true,
      replyCount: true,
      authorId: true,
      author: {
        select: {
          username: { select: { handle: true } },
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
      media: { where: { type: "image" }, orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
  });
}

export async function getWirePage(rawCursor: string): Promise<WirePage> {
  const cursor = parseWireCursor(rawCursor);
  if (!cursor) return { items: [], next: null };

  return cached(`front-page:wire:${rawCursor}`, 60, async () => {
    const official = await db.username.findUnique({ where: { handle: FRONT_PAGE.officialHandle }, select: { userId: true } });
    const officialUserId = official?.userId ?? null;

    let phase = cursor.phase;
    let after = cursor.after;
    if (phase === "o" && !officialUserId) {
      phase = "p";
      after = null;
    }

    const rows = await fetchWirePosts(phase, after, officialUserId);
    const hasMore = rows.length > WIRE_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, WIRE_PAGE_SIZE) : rows;

    const items: WireItem[] = page
      .filter((r) => r.author.username)
      .map((r) => {
        const { headline, rest } = toHeadline(r.body);
        return {
          id: r.id,
          headline,
          rest: rest.slice(0, 280),
          createdAt: r.createdAt,
          imageUrl: r.media[0]?.url ?? null,
          likeCount: r.likeCount,
          replyCount: r.replyCount,
          official: r.authorId === officialUserId,
          author: {
            handle: r.author.username!.handle,
            displayName: r.author.profile?.displayName ?? r.author.username!.handle,
            avatarUrl: r.author.profile?.avatarUrl ?? null,
          },
        };
      });

    // Official phase ran dry: hand over to the public phase from the top.
    let next: string | null;
    if (hasMore) next = `${phase}_${encodeCursor(page[page.length - 1])}`;
    else next = phase === "o" ? "p_" : null;

    return { items, next };
  });
}
