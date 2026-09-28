import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { getWirePage, initialWireCursor, parseWireCursor, DISPATCH_COUNT } from "@/lib/front-page";
import { parseChannelFeed, mergeVideos } from "@/lib/youtube-channel";
import { createCommunity, createPost, createUser, addCommunityMember } from "@/test/factories";

// The Wire puts strangers' posts in front of every logged-out visitor, so
// its author bar is stricter than /explore's: active, public, discoverable
// accounts only (the sitemap's bar). Walks the public phase to its end
// rather than checking page one, since other test files share the DB and
// may have pushed these posts past the first page.
async function allPublicWireIds() {
  const ids: string[] = [];
  let cursor: string | null = "p_";
  for (let i = 0; cursor && i < 200; i++) {
    const page = await getWirePage(cursor);
    ids.push(...page.items.map((item) => item.id));
    cursor = page.next;
  }
  return ids;
}

describe("front page Wire", () => {
  it("only promotes posts from active, public, discoverable authors", async () => {
    const ok = await createUser();
    const privateAuthor = await createUser();
    await db.profile.update({ where: { userId: privateAuthor.id }, data: { isPrivate: true } });
    const hiddenAuthor = await createUser();
    await db.profile.update({ where: { userId: hiddenAuthor.id }, data: { discoverableInSearch: false } });
    const suspended = await createUser({ status: "suspended" });

    const visible = await createPost({ authorId: ok.id });
    const fromPrivate = await createPost({ authorId: privateAuthor.id });
    const fromHidden = await createPost({ authorId: hiddenAuthor.id });
    const fromSuspended = await createPost({ authorId: suspended.id });

    const ids = await allPublicWireIds();
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(fromPrivate.id);
    expect(ids).not.toContain(fromHidden.id);
    expect(ids).not.toContain(fromSuspended.id);
  });

  it("never shows private-community posts or replies", async () => {
    const author = await createUser();
    const community = await createCommunity({ visibility: "private", creatorId: author.id });
    await addCommunityMember(community.id, author.id, { role: "owner" });
    const inPrivateCommunity = await createPost({ authorId: author.id, communityId: community.id });
    const parent = await createPost({ authorId: author.id });
    const reply = await db.post.create({ data: { authorId: author.id, body: "a reply", replyToId: parent.id } });

    const ids = await allPublicWireIds();
    expect(ids).toContain(parent.id);
    expect(ids).not.toContain(inPrivateCommunity.id);
    expect(ids).not.toContain(reply.id);
  });

  it("pages without duplicates", async () => {
    const ids = await allPublicWireIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts in the official phase only when the dispatches column was full", () => {
    const dispatch = { id: "x", body: "b", createdAt: new Date("2026-09-01T00:00:00Z"), imageUrl: null, likeCount: 0, replyCount: 0 };
    const desk = (n: number) => ({ handle: "dot", displayName: "0dot", avatarUrl: null, dispatches: Array(n).fill(dispatch) });
    expect(initialWireCursor(null)).toBe("p_");
    expect(initialWireCursor(desk(DISPATCH_COUNT - 1))).toBe("p_");
    expect(initialWireCursor(desk(DISPATCH_COUNT))).toBe("o_2026-09-01T00:00:00.000Z~x");
  });

  it("rejects malformed cursors", () => {
    expect(parseWireCursor("p_")).toEqual({ phase: "p", after: null });
    expect(parseWireCursor("o_2026-09-01T00:00:00.000Z~abc")?.phase).toBe("o");
    for (const bad of [null, "", "x_", "p", "p_nonsense", "o_2026-99-99~id"]) {
      expect(parseWireCursor(bad)).toBeNull();
    }
  });
});

describe("youtube channel feed", () => {
  it("parses entries and decodes titles", () => {
    const xml = `<feed><entry><yt:videoId>JimIb92jriQ</yt:videoId><title>The Story of 0dot: Humanity&#39;s &amp; more</title></entry>
      <entry><yt:videoId>bad</yt:videoId><title>skipped</title></entry></feed>`;
    expect(parseChannelFeed(xml)).toEqual([{ id: "JimIb92jriQ", title: "The Story of 0dot: Humanity's & more" }]);
  });

  it("keeps pinned videos first and drops channel duplicates", () => {
    const pinned = [{ id: "JimIb92jriQ", title: "Pinned", caption: "c" }];
    const channel = [
      { id: "JimIb92jriQ", title: "Same video from the feed" },
      { id: "dQw4w9WgXcQ", title: "New upload" },
    ];
    expect(mergeVideos(pinned, channel).map((v) => v.title)).toEqual(["Pinned", "New upload"]);
  });
});
