import "server-only";
import { db } from "@/lib/db";
import { getPostVisibilityConditions } from "@/lib/post-visibility";
import { semanticRerank } from "@/lib/ai-search";
import {
  fetchCourses,
  fetchDigitalProducts,
  fetchFreelanceServices,
  fetchListings,
  type MarketplaceBrowseItem,
} from "@/lib/marketplace-browse";
import {
  cursorWhere,
  paginate,
  paginateSearchBatch,
  searchSkip,
  SEARCH_FETCH_SIZE,
  SEARCH_PAGE_SIZE,
  encodeOffsetCursor,
  parseOffsetCursor,
  type PostCursor,
} from "@/lib/pagination";

// Extracted from src/app/search/page.tsx (mobile pro-upgrade addendum,
// sub-phase M13) so GET /api/v1/search can call the exact same query/rank
// logic the web search page uses, rather than a second copy that could
// drift — same "shared infra, built once" posture M3's recordMessageAndNotify
// extraction and M12's blockUserById/unblockUserById extraction already
// established for other cross-surface reuse. Comments on each function's
// ranking rationale are preserved from the original.
//
// FIX_PLAN P3 #5: single-source tabs (communities, businesses, events,
// users, projects) paginate by page number via plain skip/take, with each
// DB query's orderBy matching that tab's own rank() tie-break field (see
// pagination.ts's paginateSearchBatch comment for why). searchPosts is
// pure chronological order with no re-rank step, so it gets a real keyset
// cursor instead, same shape as feed-query.ts's own pagination. The
// merged-source tabs (knowledge, marketplace) get a different cursor
// still — see searchKnowledge's comment.

function rankCommunities<T extends { slug: string; memberCount: number }>(rows: T[], query: string): T[] {
  const lowerQ = query.toLowerCase();
  return rows.slice().sort((a, b) => {
    const rank = (row: T) => (row.slug === lowerQ ? 0 : 1);
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return b.memberCount - a.memberCount;
  });
}

// phase-3 spec §16: resolves Phase 1's empty "communities" search tab.
// Only ever selects Community's own columns (name/slug/memberCount) — never
// joins into posts/wiki/chat — so a private community's *content* can't
// leak through this query even accidentally; its existence being
// searchable at all is per §3.1 ("still discoverable by name/slug").
export async function searchCommunities(q: string, page = 1) {
  const rows = await db.community.findMany({
    where: {
      OR: [{ slug: { contains: q.toLowerCase() } }, { name: { contains: q } }],
    },
    // Matches rankCommunities' own tie-break, with a unique trailing field
    // — see paginateSearchBatch's comment for why that's what makes
    // skip/take safe here.
    orderBy: [{ memberCount: "desc" }, { id: "asc" }],
    skip: searchSkip(page),
    take: SEARCH_FETCH_SIZE,
  });
  return paginateSearchBatch(rows, (batch) => rankCommunities(batch, q));
}

function rankBusinesses<
  T extends { slug: string; name: string; category: string; isVerified: boolean; averageRating: number }
>(rows: T[], query: string): T[] {
  const lowerQ = query.toLowerCase();
  return rows.slice().sort((a, b) => {
    const rank = (row: T) => {
      if (row.slug === lowerQ || row.name.toLowerCase() === lowerQ) return 0;
      if (row.category.toLowerCase() === lowerQ) return 1;
      return 2;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    const verifiedDiff = Number(!a.isVerified) - Number(!b.isVerified);
    if (verifiedDiff !== 0) return verifiedDiff;
    return b.averageRating - a.averageRating;
  });
}

// build plan step 10 / spec §14: resolves Phase 1's other stubbed search
// tab (§6.1 of that spec — "communities" and "businesses" both
// present-but-empty; Phase 3 filled communities, this closes the pair).
// status != "active" is excluded from the WHERE clause itself, not just
// ranked lower — a pending/unclaimed business (§3.3) can't appear in
// search at all, by construction rather than tie-break order.
export async function searchBusinesses(q: string, page = 1) {
  const rows = await db.business.findMany({
    where: {
      status: "active",
      OR: [
        { slug: { contains: q.toLowerCase() } },
        { name: { contains: q } },
        { category: { contains: q.toLowerCase() } },
      ],
    },
    // Matches rankBusinesses' own tie-break — see searchCommunities above.
    orderBy: [{ isVerified: "desc" }, { averageRating: "desc" }, { id: "asc" }],
    skip: searchSkip(page),
    take: SEARCH_FETCH_SIZE,
  });
  return paginateSearchBatch(rows, (batch) => rankBusinesses(batch, q));
}

function rankEvents<T extends { title: string; startsAt: Date }>(rows: T[], query: string): T[] {
  const lowerQ = query.toLowerCase();
  return rows.slice().sort((a, b) => {
    const rank = (row: T) => (row.title.toLowerCase() === lowerQ ? 0 : 1);
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.startsAt.getTime() - b.startsAt.getTime();
  });
}

// spec §9: only `published` events, split by an explicit Upcoming/Past
// filter rather than blended into one chronologically-confusing list
// (§9.1). §9.2's attendee-privacy acceptance criterion is met by
// construction here — this query never selects EventRSVP/Ticket rows at
// all, so a host_only attendee list has nothing to leak through a search
// result regardless of ranking.
export async function searchEvents(q: string, when: "upcoming" | "past", page = 1) {
  const now = new Date();
  const timeFilter =
    when === "upcoming"
      ? { OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] }
      : { OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }] };

  const rows = await db.event.findMany({
    where: {
      status: "published",
      AND: [{ OR: [{ title: { contains: q } }, { description: { contains: q } }] }, timeFilter],
    },
    select: { id: true, slug: true, title: true, startsAt: true },
    // Matches rankEvents' own tie-break — see searchCommunities above.
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    skip: searchSkip(page),
    take: SEARCH_FETCH_SIZE,
  });
  return paginateSearchBatch(rows, (batch) => rankEvents(batch, q));
}

function rankUsers<
  T extends { handle: string; claimedAt: Date; user: { profile: { isVerified: boolean } | null } }
>(rows: T[], query: string): T[] {
  const lowerQ = query.toLowerCase();
  return rows.slice().sort((a, b) => {
    const rank = (row: T) => {
      if (row.handle === lowerQ) return 0;
      if (row.handle.startsWith(lowerQ)) return 1;
      return 2;
    };
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    const verifiedDiff = Number(!a.user.profile?.isVerified) - Number(!b.user.profile?.isVerified);
    if (verifiedDiff !== 0) return verifiedDiff;
    return a.claimedAt.getTime() - b.claimedAt.getTime();
  });
}

export async function searchUsers(q: string, page = 1) {
  const rows = await db.username.findMany({
    where: {
      AND: [
        {
          OR: [
            { handle: { contains: q.toLowerCase() } },
            { user: { profile: { displayName: { contains: q } } } },
          ],
        },
        // addendum-account-settings-hardening.md §9: excluded by
        // construction, same "gated rows never reach the WHERE" posture as
        // searchBusinesses/searchProjects/searchKnowledge below.
        { user: { profile: { discoverableInSearch: true } } },
      ],
    },
    include: { user: { include: { profile: true } } },
    // Matches rankUsers' own tie-break — see searchCommunities above.
    orderBy: [{ user: { profile: { isVerified: "desc" } } }, { claimedAt: "asc" }, { id: "asc" }],
    skip: searchSkip(page),
    take: SEARCH_FETCH_SIZE,
  });
  return paginateSearchBatch(rows, (batch) => rankUsers(batch, q));
}

// phase-5 spec §4.3/§13.1: same tier-gating + block/community-privacy
// conditions every other post-listing surface (feed-query.ts,
// community-feed.ts, trending) applies — search was the one surface that
// queried Post directly and would otherwise leak a gated post's full body
// to anyone who searches its text, bypassing the gate entirely.
//
// Pure chronological order with no post-fetch re-rank, unlike every other
// tab in this file — so this is the one search function that gets a real
// keyset cursor (same cursorWhere/paginate shape feed-query.ts and GET
// /api/v1/search's posts branch already use) instead of a page number.
export async function searchPosts(q: string, viewerId: string | null, cursor: PostCursor | null) {
  const query = q.startsWith("#") ? q.slice(1) : q;
  if (query.length === 0) return { items: [], nextCursor: null };
  const visibilityConditions = await getPostVisibilityConditions(viewerId);
  const rows = await db.post.findMany({
    where: {
      AND: [{ deletedAt: null, replyToId: null, body: { contains: query } }, ...visibilityConditions, cursorWhere(cursor)],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
    include: { author: { include: { profile: true, username: true } }, media: { orderBy: { position: "asc" } } },
  });
  return paginate(rows);
}

// phase-6 spec §10: exact title match first, then fuzzy title/summary
// match, tie-broken by like_count then recency — same exact-then-fuzzy-
// then-engagement shape rankUsers/rankCommunities/rankBusinesses already
// established, applied to a fifth entity type rather than inventing a
// different ranking philosophy for it.
function rankProjects<T extends { title: string; summary: string; likeCount: number; createdAt: Date }>(
  rows: T[],
  query: string
): T[] {
  const lowerQ = query.toLowerCase();
  return rows.slice().sort((a, b) => {
    const rank = (row: T) => (row.title.toLowerCase() === lowerQ ? 0 : 1);
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    if (a.likeCount !== b.likeCount) return b.likeCount - a.likeCount;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

// phase-6 spec §10: unlisted projects are excluded from the WHERE clause
// itself, not just ranked lower — same "excluded by construction" posture
// searchBusinesses already uses for non-active businesses, so an unlisted
// project can never surface here regardless of match quality (spec §10
// bullet 3's explicit acceptance criterion).
export async function searchProjects(q: string, page = 1) {
  const rows = await db.project.findMany({
    where: {
      visibility: "public",
      status: { not: "archived" },
      OR: [{ title: { contains: q } }, { summary: { contains: q } }],
    },
    select: { id: true, slug: true, title: true, summary: true, likeCount: true, createdAt: true },
    // Matches rankProjects' own tie-break — see searchCommunities above.
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    skip: searchSkip(page),
    take: SEARCH_FETCH_SIZE,
  });
  return paginateSearchBatch(rows, (batch) => rankProjects(batch, q));
}

export type KnowledgeResult = {
  type: "article" | "book" | "wiki_page" | "published_file";
  typeLabel: string;
  id: string;
  href: string;
  title: string;
  subtitle: string;
  likeCount: number;
  createdAt: Date;
};

// phase-7 spec §8: exact title match first, then fuzzy match, tie-broken by
// like_count then recency — same shape rankProjects already established,
// applied across four entity types combined into one tab rather than one
// tab per type (§8's own "worth resisting" reasoning). WikiPage/
// PublishedFile have no cached likeCount (see Reaction/Comment's schema
// comment) so they always tie-break on recency alone within this
// comparator — an accepted, spec-flagged gap (research report's note),
// not an oversight.
function rankKnowledge(rows: KnowledgeResult[], query: string): KnowledgeResult[] {
  const lowerQ = query.toLowerCase();
  return rows.slice().sort((a, b) => {
    const rank = (row: KnowledgeResult) => (row.title.toLowerCase() === lowerQ ? 0 : 1);
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    if (a.likeCount !== b.likeCount) return b.likeCount - a.likeCount;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function knowledgeRowsFromArticles(
  articles: { id: string; slug: string; title: string; subtitle: string | null; likeCount: number; createdAt: Date; author: { username: { handle: string } | null } }[]
): KnowledgeResult[] {
  const results: KnowledgeResult[] = [];
  for (const a of articles) {
    const handle = a.author.username?.handle;
    if (!handle) continue;
    results.push({
      type: "article",
      typeLabel: "Article",
      id: a.id,
      href: `/${handle}/articles/${a.slug}`,
      title: a.title,
      subtitle: a.subtitle ?? "",
      likeCount: a.likeCount,
      createdAt: a.createdAt,
    });
  }
  return results;
}

// phase-7 spec §8: one combined "Articles & Docs" tab spanning Article,
// Book, and public WikiPage/PublishedFile rows — `private` is excluded from
// every WHERE clause itself (never merely filtered post-fetch, same
// "excluded by construction" posture searchBusinesses/searchProjects use),
// and per the spec's own admission that this SQLite codebase has no real
// FTS engine (see searchProjects et al.'s plain `contains` queries),
// `unlisted` gets the identical treatment as unlisted projects: excluded
// from the WHERE too, not "indexed but excluded" (there is no separate
// index to exclude *from* here — reality wins over the spec's Postgres-FTS
// prose, same posture this codebase applies throughout).
//
// Four independent sources share one ranked, capped-at-SEARCH_PAGE_SIZE
// list — a single page number can't paginate that correctly (see
// pagination.ts's encodeOffsetCursor comment): splitting one shared page
// evenly across sources either stops showing a source's own further
// results too early, or re-shows ones another source's overflow already
// displayed. Instead the cursor tracks how many of *each* source have
// actually been displayed so far, independent of how the other three are
// doing — advanced only by that count, so an over-fetched-but-not-shown
// remainder gets re-considered next time instead of skipped past.
export async function searchKnowledge(q: string, viewerId: string | null, cursorRaw: string | null) {
  const offsets = parseOffsetCursor(cursorRaw);
  const [articles, books, wikiPages, files] = await Promise.all([
    db.article.findMany({
      where: {
        status: "published",
        visibility: "public",
        OR: [{ title: { contains: q } }, { body: { contains: q } }],
      },
      include: { author: { select: { username: true } } },
      // Matches rankKnowledge's own tie-break — see searchCommunities above.
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: offsets.a ?? 0,
      take: SEARCH_FETCH_SIZE,
    }),
    db.book.findMany({
      where: {
        status: "published",
        visibility: "public",
        OR: [{ title: { contains: q } }, { description: { contains: q } }],
      },
      include: { profile: { select: { user: { select: { username: true } } } } },
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: offsets.b ?? 0,
      take: SEARCH_FETCH_SIZE,
    }),
    db.wikiPage.findMany({
      where: {
        profileId: { not: null },
        kind: { in: ["wiki", "documentation"] },
        visibility: "public",
        OR: [{ title: { contains: q } }, { currentRevision: { is: { body: { contains: q } } } }],
      },
      include: { profile: { select: { user: { select: { username: true } } } } },
      // No likeCount field on WikiPage (rankKnowledge treats it as a
      // constant 0 for these rows — see its own comment), so recency is
      // the whole tie-break here.
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: offsets.w ?? 0,
      take: SEARCH_FETCH_SIZE,
    }),
    db.publishedFile.findMany({
      where: {
        visibility: "public",
        OR: [{ title: { contains: q } }, { description: { contains: q } }],
      },
      include: { profile: { select: { user: { select: { username: true } } } } },
      // Same as WikiPage above — no likeCount field on PublishedFile.
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: offsets.f ?? 0,
      take: SEARCH_FETCH_SIZE,
    }),
  ]);

  function trim<T>(rows: T[]): { batch: T[]; hasMore: boolean } {
    const hasMore = rows.length > SEARCH_PAGE_SIZE;
    return { batch: hasMore ? rows.slice(0, SEARCH_PAGE_SIZE) : rows, hasMore };
  }
  const { batch: articleBatch, hasMore: articleHasMore } = trim(articles);
  const { batch: bookBatch, hasMore: bookHasMore } = trim(books);
  const { batch: wikiBatch, hasMore: wikiHasMore } = trim(wikiPages);
  const { batch: fileBatch, hasMore: fileHasMore } = trim(files);

  const results: KnowledgeResult[] = knowledgeRowsFromArticles(articleBatch);
  for (const b of bookBatch) {
    const handle = b.profile.user.username?.handle;
    if (!handle) continue;
    results.push({
      type: "book",
      typeLabel: "Book",
      id: b.id,
      href: `/${handle}/books/${b.slug}`,
      title: b.title,
      subtitle: b.description,
      likeCount: b.likeCount,
      createdAt: b.createdAt,
    });
  }
  for (const w of wikiBatch) {
    const handle = w.profile?.user.username?.handle;
    if (!handle) continue;
    results.push({
      type: "wiki_page",
      typeLabel: w.kind === "documentation" ? "Documentation" : "Wiki",
      id: w.id,
      href: `/${handle}/wiki/${w.slug}`,
      title: w.title,
      subtitle: "",
      likeCount: 0,
      createdAt: w.createdAt,
    });
  }
  for (const f of fileBatch) {
    const handle = f.profile.user.username?.handle;
    if (!handle) continue;
    results.push({
      type: "published_file",
      typeLabel: "File",
      id: f.id,
      href: `/${handle}/files/${f.slug}`,
      title: f.title,
      subtitle: f.description,
      likeCount: 0,
      createdAt: f.createdAt,
    });
  }

  const ranked = rankKnowledge(results, q);
  const items = ranked.slice(0, SEARCH_PAGE_SIZE);
  const shownCount = (type: KnowledgeResult["type"]) => items.filter((i) => i.type === type).length;
  const hasMore = articleHasMore || bookHasMore || wikiHasMore || fileHasMore || ranked.length > SEARCH_PAGE_SIZE;
  const nextCursor = hasMore
    ? encodeOffsetCursor({
        a: (offsets.a ?? 0) + shownCount("article"),
        b: (offsets.b ?? 0) + shownCount("book"),
        w: (offsets.w ?? 0) + shownCount("wiki_page"),
        f: (offsets.f ?? 0) + shownCount("published_file"),
      })
    : null;

  // phase-11 spec §8.1: semantic re-ranking as a supplementary signal over
  // the existing lexical order, exact title matches pinned ahead of it —
  // see semanticRerank's own comment for why this needs no separate vector
  // index (§8.2). Reranks only this page's own window, same as the lexical
  // rank step above.
  const reranked = await semanticRerank({
    query: q,
    rows: items,
    getText: (row) => `${row.title} ${row.subtitle}`,
    getId: (row) => row.id,
    isExactMatch: (row) => row.title.toLowerCase() === q.toLowerCase(),
    requestedById: viewerId,
  });
  return { items: reranked, nextCursor };
}

// The "All" view (search Marketplace tab with no further category filter):
// every category's own ranking still applies within itself, results are
// then interleaved by recency only across categories — a neutral default
// for mixing genuinely incomparable per-category scores (an app's install
// count and a course's sale count aren't on the same scale), not a seventh
// global formula. Same per-source offset cursor as searchKnowledge above —
// but unlike searchKnowledge, each fetcher's *default* orderBy (engagement:
// sales/installs/rating) doesn't match the recency-only cross-source merge
// below, so "how many of this source got displayed" wouldn't be a prefix
// of that source's own fetched order (see pagination.ts's
// encodeOffsetCursor comment for why that prefix property is what makes
// the offset cursor correct). The merge already fully re-sorts by
// createdAt regardless of each fetcher's own order, so requesting
// `createdAt desc, id asc` directly here changes nothing about the final
// result, only which rows are *already in the right order* before that
// re-sort — doesn't reuse fetchAllMarketplaceCategories, since that one is
// a flat, unpaginated merge for /m and GET /api/v1/marketplace, not shaped
// for per-source hasMore/offset bookkeeping.
const MARKETPLACE_RECENCY_ORDER = [{ createdAt: "desc" as const }, { id: "asc" as const }];

export async function searchMarketplace(q: string, cursorRaw: string | null): Promise<{ items: MarketplaceBrowseItem[]; nextCursor: string | null }> {
  const offsets = parseOffsetCursor(cursorRaw);
  const [courses, digitalProducts, freelanceServices, themes, templates, apps] = await Promise.all([
    fetchCourses(q, SEARCH_FETCH_SIZE, offsets.co ?? 0, MARKETPLACE_RECENCY_ORDER),
    fetchDigitalProducts(q, SEARCH_FETCH_SIZE, offsets.dp ?? 0, MARKETPLACE_RECENCY_ORDER),
    fetchFreelanceServices(q, SEARCH_FETCH_SIZE, offsets.fr ?? 0, MARKETPLACE_RECENCY_ORDER),
    fetchListings("theme", q, SEARCH_FETCH_SIZE, offsets.th ?? 0, MARKETPLACE_RECENCY_ORDER),
    fetchListings("template", q, SEARCH_FETCH_SIZE, offsets.tp ?? 0, MARKETPLACE_RECENCY_ORDER),
    fetchListings("app", q, SEARCH_FETCH_SIZE, offsets.ap ?? 0, MARKETPLACE_RECENCY_ORDER),
  ]);

  function trim(rows: MarketplaceBrowseItem[]): { batch: MarketplaceBrowseItem[]; hasMore: boolean } {
    const hasMore = rows.length > SEARCH_PAGE_SIZE;
    return { batch: hasMore ? rows.slice(0, SEARCH_PAGE_SIZE) : rows, hasMore };
  }
  const { batch: courseBatch, hasMore: courseHasMore } = trim(courses);
  const { batch: digitalProductBatch, hasMore: digitalProductHasMore } = trim(digitalProducts);
  const { batch: freelanceBatch, hasMore: freelanceHasMore } = trim(freelanceServices);
  const { batch: themeBatch, hasMore: themeHasMore } = trim(themes);
  const { batch: templateBatch, hasMore: templateHasMore } = trim(templates);
  const { batch: appBatch, hasMore: appHasMore } = trim(apps);

  const merged = [...courseBatch, ...digitalProductBatch, ...freelanceBatch, ...themeBatch, ...templateBatch, ...appBatch].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id)
  );
  const items = merged.slice(0, SEARCH_PAGE_SIZE);
  const shownCount = (category: MarketplaceBrowseItem["category"]) => items.filter((i) => i.category === category).length;
  const hasMore =
    courseHasMore ||
    digitalProductHasMore ||
    freelanceHasMore ||
    themeHasMore ||
    templateHasMore ||
    appHasMore ||
    merged.length > SEARCH_PAGE_SIZE;
  const nextCursor = hasMore
    ? encodeOffsetCursor({
        co: (offsets.co ?? 0) + shownCount("course"),
        dp: (offsets.dp ?? 0) + shownCount("digital_product"),
        fr: (offsets.fr ?? 0) + shownCount("freelance_service"),
        th: (offsets.th ?? 0) + shownCount("theme"),
        tp: (offsets.tp ?? 0) + shownCount("template"),
        ap: (offsets.ap ?? 0) + shownCount("app"),
      })
    : null;
  return { items, nextCursor };
}
