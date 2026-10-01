import "server-only";

export const POST_PAGE_SIZE = 20;

export type PostCursor = { createdAt: Date; id: string };

// Cursor is a single opaque "<iso>~<id>" query param. Composite
// (createdAt, id) rather than offset — per phase-1 spec §5.4, this avoids
// posts being skipped or duplicated when new posts arrive between page
// loads, which a numeric OFFSET can't guarantee.
export function parseCursor(raw: string | undefined): PostCursor | null {
  if (!raw) return null;
  const sepIndex = raw.lastIndexOf("~");
  if (sepIndex === -1) return null;
  const iso = raw.slice(0, sepIndex);
  const id = raw.slice(sepIndex + 1);
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

export function encodeCursor(post: { createdAt: Date; id: string }): string {
  return `${post.createdAt.toISOString()}~${post.id}`;
}

// Where-clause fragment for "strictly before this cursor" — spread into a
// Prisma `where` alongside other filters. Empty object when there's no
// cursor (first page).
export function cursorWhere(cursor: PostCursor | null) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

// Trims a take:(PAGE_SIZE+1) result down to PAGE_SIZE and reports whether
// there's a next page — the standard "fetch one extra" pagination check.
export function paginate<T extends { createdAt: Date; id: string }>(
  rows: T[]
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > POST_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, POST_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
}

// Search's other result tabs (communities, businesses, projects, events,
// knowledge, marketplace, users) each have their own post-fetch rank()
// tie-break — unlike posts' pure chronological order above, there's no
// single DB sort key that captures it exactly, since rank() buckets by
// match tier (exact match, then prefix/fuzzy match) before falling back to
// a tie-break field. A growing-window re-fetch-and-reslice approach was
// tried and rejected here: for a short query like a single letter, the
// "prefix match" bucket isn't the rare handful rank()'s own comments assume
// elsewhere — it can be a large fraction of all matching rows, so growing
// the fetch window changes which big *set* of rows bucket to the front,
// reshuffling items that were already shown on an earlier page.
//
// Instead: plain skip/take offset pagination, with the DB `orderBy` set to
// each function's own tie-break field (with a unique trailing field, e.g.
// `id`, so there's a fully deterministic order) — NOT the match-tier
// bucketing itself. Each page's own fetched batch is then independently
// re-ranked by the same rank() function, same as the original, unpaginated
// code already did for its one and only page. Because every page's
// underlying batch is a disjoint skip/take slice, there's no way for the
// same row to surface on two different pages — rank() only ever reorders
// *within* a batch, never pulls a row in from outside it. The trade-off,
// already true of the original single-page code and not a regression this
// introduces: an exact/prefix match only gets pinned to the front of
// whichever page its own batch happens to land on, not globally across
// every page — there's no cross-page ranking without a real FTS engine,
// consistent with this file's "reality wins over spec" posture throughout.
export const SEARCH_PAGE_SIZE = 20;
export const SEARCH_MAX_PAGE = 50;

export function searchSkip(page: number): number {
  return (Math.min(Math.max(page, 1), SEARCH_MAX_PAGE) - 1) * SEARCH_PAGE_SIZE;
}

export const SEARCH_FETCH_SIZE = SEARCH_PAGE_SIZE + 1;

// Trims a take:(SEARCH_FETCH_SIZE) batch down to SEARCH_PAGE_SIZE, reports
// whether there's a next page, and hands the trimmed batch to this tab's
// own rank() for its within-page reorder.
export function paginateSearchBatch<T>(rows: T[], rank: (rows: T[]) => T[]): { items: T[]; hasMore: boolean } {
  const hasMore = rows.length > SEARCH_PAGE_SIZE;
  const batch = hasMore ? rows.slice(0, SEARCH_PAGE_SIZE) : rows;
  return { items: rank(batch), hasMore };
}

// The knowledge and marketplace tabs each merge several independent
// sources (Article/Book/WikiPage/PublishedFile; Course/DigitalProduct/
// Offering/MarketplaceListing) into one ranked list, capped at
// SEARCH_PAGE_SIZE for display — a single shared `page` number doesn't
// work here: splitting one page's worth of skip/take evenly across every
// source either strands results a source had but didn't get to show (if
// its skip advances by a full page while only a few of its rows actually
// made this page's display cut) or re-shows ones that did. Instead, the
// cursor tracks *how many rows of each source have actually been
// displayed so far* — advanced only by however many of that source made
// the cut this page, so an unshown-but-fetched remainder is simply
// re-fetched (not skipped past) next time. A short key per source keeps
// the opaque string small.
export function encodeOffsetCursor(offsets: Record<string, number>): string {
  return Object.entries(offsets)
    .map(([key, value]) => `${key}:${value}`)
    .join(",");
}

export function parseOffsetCursor(raw: string | null | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  if (!raw) return result;
  for (const part of raw.split(",")) {
    const [key, value] = part.split(":");
    if (key) result[key] = Number(value) || 0;
  }
  return result;
}
