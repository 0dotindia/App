import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { getRepostedPostIds } from "@/lib/feed-query";
import { createUser, createPost } from "@/test/factories";

// FIX_PLAN P3 #2: read-side counterpart to toggleRepost (actions/posts.ts)
// — the CSS for a pressed repost button existed, but nothing computed
// which posts the viewer had reposted, so it never showed as toggled.
describe("getRepostedPostIds", () => {
  it("returns the ids of posts the viewer has plain-reposted", async () => {
    const viewer = await createUser();
    const original = await createPost();
    await db.post.create({ data: { authorId: viewer.id, body: "", repostOfId: original.id } });

    const ids = await getRepostedPostIds(viewer.id, [original.id]);
    expect(ids.has(original.id)).toBe(true);
  });

  it("excludes a post the viewer has only quote-reposted, not plain-reposted", async () => {
    const viewer = await createUser();
    const original = await createPost();
    await db.post.create({ data: { authorId: viewer.id, body: "My take on this", repostOfId: original.id } });

    const ids = await getRepostedPostIds(viewer.id, [original.id]);
    expect(ids.has(original.id)).toBe(false);
  });

  it("excludes a repost that was undone (soft-deleted)", async () => {
    const viewer = await createUser();
    const original = await createPost();
    await db.post.create({ data: { authorId: viewer.id, body: "", repostOfId: original.id, deletedAt: new Date() } });

    const ids = await getRepostedPostIds(viewer.id, [original.id]);
    expect(ids.has(original.id)).toBe(false);
  });

  it("excludes another user's repost of the same post", async () => {
    const viewer = await createUser();
    const someoneElse = await createUser();
    const original = await createPost();
    await db.post.create({ data: { authorId: someoneElse.id, body: "", repostOfId: original.id } });

    const ids = await getRepostedPostIds(viewer.id, [original.id]);
    expect(ids.has(original.id)).toBe(false);
  });

  it("returns an empty set for a logged-out viewer or an empty post list", async () => {
    const original = await createPost();
    expect((await getRepostedPostIds(null, [original.id])).size).toBe(0);
    expect((await getRepostedPostIds(undefined, [original.id])).size).toBe(0);
    const viewer = await createUser();
    expect((await getRepostedPostIds(viewer.id, [])).size).toBe(0);
  });
});
