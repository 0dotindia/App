import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { SearchBox } from "./SearchBox";
import { getCurrentUser } from "@/lib/session";
import { businessCategoryLabel } from "@/lib/business-categories";
import {
  searchUsers,
  searchPosts,
  searchCommunities,
  searchBusinesses,
  searchProjects,
  searchKnowledge,
  searchEvents,
  searchMarketplace,
} from "@/lib/search";
import { parseCursor, SEARCH_MAX_PAGE } from "@/lib/pagination";

export const metadata: Metadata = { title: "Search" };

type SearchTab = "users" | "posts" | "communities" | "businesses" | "projects" | "knowledge" | "events" | "marketplace";
const TABS: { key: SearchTab; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "posts", label: "Posts" },
  { key: "communities", label: "Communities" },
  { key: "businesses", label: "Businesses" },
  { key: "projects", label: "Projects" },
  { key: "knowledge", label: "Articles & Docs" },
  { key: "events", label: "Events" },
  { key: "marketplace", label: "Marketplace" },
];

// users/communities/businesses/projects/events paginate by page number
// (plain skip/take — see lib/search.ts); posts/knowledge/marketplace
// paginate by an opaque cursor instead (a keyset cursor for posts, a
// per-source offset cursor for the two merged tabs — see searchKnowledge's
// comment), so they only ever get a "Next" link via NextCursorLink, no page
// numbers/Prev.

function tabHref(q: string, tab: SearchTab) {
  return `/search?q=${encodeURIComponent(q)}&tab=${tab}`;
}

function eventWhenHref(q: string, when: "upcoming" | "past") {
  return `/search?q=${encodeURIComponent(q)}&tab=events&when=${when}`;
}

function pageHref(q: string, tab: SearchTab, page: number, when?: "upcoming" | "past") {
  const whenParam = when ? `&when=${when}` : "";
  return `/search?q=${encodeURIComponent(q)}&tab=${tab}${whenParam}&page=${page}`;
}

function cursorHref(q: string, tab: SearchTab, cursor: string) {
  return `/search?q=${encodeURIComponent(q)}&tab=${tab}&cursor=${encodeURIComponent(cursor)}`;
}

function Pager({ q, tab, page, hasMore, when }: { q: string; tab: SearchTab; page: number; hasMore: boolean; when?: "upcoming" | "past" }) {
  if (page === 1 && !hasMore) return null;
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
      {page > 1 && (
        <Link href={pageHref(q, tab, page - 1, when)} className="button buttonSmall buttonSecondary">
          Previous
        </Link>
      )}
      {hasMore && (
        <Link href={pageHref(q, tab, page + 1, when)} className="button buttonSmall buttonSecondary">
          Next
        </Link>
      )}
    </div>
  );
}

function NextCursorLink({ q, tab, nextCursor }: { q: string; tab: SearchTab; nextCursor: string | null }) {
  if (!nextCursor) return null;
  return (
    <div style={{ marginTop: "1rem" }}>
      <Link href={cursorHref(q, tab, nextCursor)} className="button buttonSmall buttonSecondary">
        Next
      </Link>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; when?: string; page?: string; cursor?: string }>;
}) {
  const { q: rawQ, tab: rawTab, when: rawWhen, page: rawPage, cursor: rawCursor } = await searchParams;
  const q = (rawQ ?? "").trim();
  const tab: SearchTab = (
    ["users", "posts", "communities", "businesses", "projects", "knowledge", "events", "marketplace"] as const
  ).includes(rawTab as SearchTab)
    ? (rawTab as SearchTab)
    : "users";
  const eventsWhen: "upcoming" | "past" = rawWhen === "past" ? "past" : "upcoming";
  const page = Math.min(Math.max(parseInt(rawPage ?? "1", 10) || 1, 1), SEARCH_MAX_PAGE);
  const cursorParam = rawCursor ?? null;

  let users: Awaited<ReturnType<typeof searchUsers>> = { items: [], hasMore: false };
  let posts: Awaited<ReturnType<typeof searchPosts>> = { items: [], nextCursor: null };
  let communities: Awaited<ReturnType<typeof searchCommunities>> = { items: [], hasMore: false };
  let businesses: Awaited<ReturnType<typeof searchBusinesses>> = { items: [], hasMore: false };
  let projects: Awaited<ReturnType<typeof searchProjects>> = { items: [], hasMore: false };
  let knowledge: Awaited<ReturnType<typeof searchKnowledge>> = { items: [], nextCursor: null };
  let events: Awaited<ReturnType<typeof searchEvents>> = { items: [], hasMore: false };
  let marketplace: Awaited<ReturnType<typeof searchMarketplace>> = { items: [], nextCursor: null };
  if (q.length > 0) {
    if (tab === "users") users = await searchUsers(q, page);
    if (tab === "posts") {
      const viewerId = (await getCurrentUser())?.id ?? null;
      posts = await searchPosts(q, viewerId, parseCursor(cursorParam ?? undefined));
    }
    if (tab === "communities") communities = await searchCommunities(q, page);
    if (tab === "businesses") businesses = await searchBusinesses(q, page);
    if (tab === "projects") projects = await searchProjects(q, page);
    if (tab === "knowledge") knowledge = await searchKnowledge(q, (await getCurrentUser())?.id ?? null, cursorParam);
    if (tab === "events") events = await searchEvents(q, eventsWhen, page);
    if (tab === "marketplace") marketplace = await searchMarketplace(q, cursorParam);
  }

  return (
    <div className="profileCard">
      <SearchBox defaultValue={q} tab={tab} when={tab === "events" ? eventsWhen : undefined} />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(q, t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`button buttonSmall ${tab === t.key ? "" : "buttonSecondary"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {q.length === 0 && <p className="mutedText">Search for people or posts.</p>}

      {q.length > 0 && tab === "users" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {users.items.length === 0 && <EmptyState title={`No users found for "${q}".`} />}
            {users.items.map((row) => (
              <Link key={row.id} href={`/${row.handle}`} className="profileLinkItem" style={{ fontWeight: 600 }}>
                {row.user.profile?.displayName ?? row.handle}
                {row.user.profile?.isVerified && (
                  <span className="verifiedBadge" title="Verified" aria-label="Verified">
                    <BadgeCheck size={14} aria-hidden="true" />
                  </span>
                )}
                <span className="mutedText" style={{ marginLeft: "0.5rem" }}>
                  <span className="brandUrl">0dot.in</span>/{row.handle}
                </span>
              </Link>
            ))}
          </div>
          <Pager q={q} tab={tab} page={page} hasMore={users.hasMore} />
        </>
      )}

      {q.length > 0 && tab === "posts" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {posts.items.length === 0 && <EmptyState title={`No posts found for "${q}".`} />}
            {posts.items.map((post) => (
              <Link
                key={post.id}
                href={post.author.username ? `/${post.author.username.handle}` : "#"}
                className="profileLinkItem"
                style={{ flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}
              >
                <span className="mutedText" style={{ fontSize: "0.85rem" }}>
                  {post.author.profile?.displayName ?? "Unknown"}
                  {post.author.profile?.isVerified && (
                    <span className="verifiedBadge" title="Verified" aria-label="Verified">
                      <BadgeCheck size={14} aria-hidden="true" />
                    </span>
                  )}
                  {post.author.username && (
                    <>
                      {" · "}
                      <span className="brandUrl">0dot.in</span>/{post.author.username.handle}
                    </>
                  )}
                </span>
                <span>{post.body}</span>
              </Link>
            ))}
          </div>
          <NextCursorLink q={q} tab={tab} nextCursor={posts.nextCursor} />
        </>
      )}

      {q.length > 0 && tab === "communities" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {communities.items.length === 0 && <EmptyState title={`No communities found for "${q}".`} />}
            {communities.items.map((community) => (
              <Link
                key={community.id}
                href={`/c/${community.slug}`}
                className="profileLinkItem"
                style={{ fontWeight: 600 }}
              >
                {community.name}
                <span className="mutedText" style={{ marginLeft: "0.5rem" }}>
                  /c/{community.slug} · {community.memberCount} member{community.memberCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
          <Pager q={q} tab={tab} page={page} hasMore={communities.hasMore} />
        </>
      )}

      {q.length > 0 && tab === "businesses" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {businesses.items.length === 0 && <EmptyState title={`No businesses found for "${q}".`} />}
            {businesses.items.map((business) => (
              <Link key={business.id} href={`/b/${business.slug}`} className="profileLinkItem" style={{ fontWeight: 600 }}>
                {business.name}
                {business.isVerified && (
                  <span className="verifiedBadge" title="Verified" aria-label="Verified">
                    <BadgeCheck size={14} aria-hidden="true" />
                  </span>
                )}
                <span className="mutedText" style={{ marginLeft: "0.5rem" }}>
                  {businessCategoryLabel(business.category)}
                  {business.reviewCount > 0 && ` · ★ ${business.averageRating.toFixed(1)} (${business.reviewCount})`}
                </span>
              </Link>
            ))}
          </div>
          <Pager q={q} tab={tab} page={page} hasMore={businesses.hasMore} />
        </>
      )}
      {q.length > 0 && tab === "projects" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {projects.items.length === 0 && <EmptyState title={`No projects found for "${q}".`} />}
            {projects.items.map((project) => (
              <Link key={project.id} href={`/p/${project.slug}`} className="profileLinkItem" style={{ fontWeight: 600 }}>
                {project.title}
                <span className="mutedText" style={{ marginLeft: "0.5rem" }}>
                  {project.summary}
                  {project.likeCount > 0 && ` · ♥ ${project.likeCount}`}
                </span>
              </Link>
            ))}
          </div>
          <Pager q={q} tab={tab} page={page} hasMore={projects.hasMore} />
        </>
      )}
      {q.length > 0 && tab === "knowledge" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {knowledge.items.length === 0 && <EmptyState title={`No articles or docs found for "${q}".`} />}
            {knowledge.items.map((row) => (
              <Link key={`${row.type}-${row.id}`} href={row.href} className="profileLinkItem" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.15rem" }}>
                <span style={{ fontWeight: 600 }}>{row.title}</span>
                <span className="mutedText" style={{ fontSize: "0.85rem" }}>
                  {row.typeLabel}
                  {row.subtitle && ` · ${row.subtitle}`}
                </span>
              </Link>
            ))}
          </div>
          <NextCursorLink q={q} tab={tab} nextCursor={knowledge.nextCursor} />
        </>
      )}
      {q.length > 0 && tab === "events" && (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Link
              href={eventWhenHref(q, "upcoming")}
              aria-current={eventsWhen === "upcoming" ? "page" : undefined}
              className={`button buttonSmall ${eventsWhen === "upcoming" ? "" : "buttonSecondary"}`}
            >
              Upcoming
            </Link>
            <Link
              href={eventWhenHref(q, "past")}
              aria-current={eventsWhen === "past" ? "page" : undefined}
              className={`button buttonSmall ${eventsWhen === "past" ? "" : "buttonSecondary"}`}
            >
              Past
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {events.items.length === 0 && <EmptyState title={`No ${eventsWhen} events found for "${q}".`} />}
            {events.items.map((event) => (
              <Link key={event.id} href={`/e/${event.slug}`} className="profileLinkItem" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.15rem" }}>
                <span style={{ fontWeight: 600 }}>{event.title}</span>
                <span className="mutedText" style={{ fontSize: "0.85rem" }}>
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(event.startsAt)}
                </span>
              </Link>
            ))}
          </div>
          <Pager q={q} tab={tab} page={page} hasMore={events.hasMore} when={eventsWhen} />
        </div>
      )}
      {q.length > 0 && tab === "marketplace" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {marketplace.items.length === 0 && <EmptyState title={`No marketplace results found for "${q}".`} />}
            {marketplace.items.map((item) => (
              <Link
                key={`${item.category}-${item.id}`}
                href={item.href}
                className="profileLinkItem"
                style={{ flexDirection: "column", alignItems: "stretch", gap: "0.15rem" }}
              >
                <span style={{ fontWeight: 600 }}>{item.title}</span>
                <span className="mutedText" style={{ fontSize: "0.85rem" }}>
                  {item.categoryLabel} · {item.subtitle} · {item.priceLabel}
                </span>
              </Link>
            ))}
          </div>
          <NextCursorLink q={q} tab={tab} nextCursor={marketplace.nextCursor} />
        </>
      )}
    </div>
  );
}
