import { describe, it, expect } from "vitest";
import { getFeedPosts } from "@/lib/feed-query";
import { getFolloweeIds } from "@/lib/follow-graph";
import {
  createUser,
  createCommunity,
  addCommunityMember,
  createPost,
  createBusiness,
  blockUser,
  createFollow,
  setProfilePrivacy,
} from "@/test/factories";

// Regression coverage for BUGS.md #1-#3 in the second review batch: private
// community posts, blocked users' posts, and pending-business posts must
// never appear on the global Explore/Home surface getFeedPosts backs.
describe("getFeedPosts visibility", () => {
  it("excludes posts from a private community the viewer isn't a member of", async () => {
    const viewer = await createUser();
    const author = await createUser();
    const privateCommunity = await createCommunity({ visibility: "private", creatorId: author.id });
    await addCommunityMember(privateCommunity.id, author.id, { role: "owner" });
    const hiddenPost = await createPost({ authorId: author.id, communityId: privateCommunity.id });
    const visiblePost = await createPost({ authorId: author.id });

    const { items } = await getFeedPosts({ cursor: null, viewerId: viewer.id });
    const ids = items.map((p) => p.id);
    expect(ids).not.toContain(hiddenPost.id);
    expect(ids).toContain(visiblePost.id);
  });

  it("includes private-community posts for an active member of that community", async () => {
    const author = await createUser();
    const privateCommunity = await createCommunity({ visibility: "private", creatorId: author.id });
    await addCommunityMember(privateCommunity.id, author.id, { role: "owner" });
    const post = await createPost({ authorId: author.id, communityId: privateCommunity.id });

    const { items } = await getFeedPosts({ cursor: null, viewerId: author.id });
    expect(items.map((p) => p.id)).toContain(post.id);
  });

  it("excludes posts authored by a user the viewer has blocked (either direction)", async () => {
    const viewer = await createUser();
    const blocked = await createUser();
    await blockUser(viewer.id, blocked.id);
    const hiddenPost = await createPost({ authorId: blocked.id });

    const { items } = await getFeedPosts({ cursor: null, viewerId: viewer.id });
    expect(items.map((p) => p.id)).not.toContain(hiddenPost.id);
  });

  it("excludes posts authored by a pending (unapproved) business", async () => {
    const viewer = await createUser();
    const business = await createBusiness({ status: "pending" });
    const post = await createPost({ authorId: business.createdBy, businessAuthorId: business.id });

    const { items } = await getFeedPosts({ cursor: null, viewerId: viewer.id });
    expect(items.map((p) => p.id)).not.toContain(post.id);
  });

  it("includes posts authored by an active (approved) business", async () => {
    const viewer = await createUser();
    const business = await createBusiness({ status: "active" });
    const post = await createPost({ authorId: business.createdBy, businessAuthorId: business.id });

    const { items } = await getFeedPosts({ cursor: null, viewerId: viewer.id });
    expect(items.map((p) => p.id)).toContain(post.id);
  });

  // Regression coverage for a privacy bug found during the FIX_PLAN P3
  // session: getPostVisibilityConditions had no isPrivate check at all, so
  // a private account's posts leaked onto the fully public Explore/Trending
  // surface (getFeedPosts with no viewer), and getFolloweeIds had no
  // status filter, so a *pending* (unapproved) follow request leaked them
  // into that requester's Home feed too.
  describe("private accounts", () => {
    it("excludes a private account's posts from an anonymous/global view (Explore/Trending)", async () => {
      const author = await createUser();
      await setProfilePrivacy(author.id, true);
      const post = await createPost({ authorId: author.id });

      const { items } = await getFeedPosts({ cursor: null, viewerId: null });
      expect(items.map((p) => p.id)).not.toContain(post.id);
    });

    it("excludes a private account's posts from a viewer with only a pending follow request", async () => {
      const viewer = await createUser();
      const author = await createUser();
      await setProfilePrivacy(author.id, true);
      await createFollow(viewer.id, author.id, { status: "pending" });
      const post = await createPost({ authorId: author.id });

      expect(await getFolloweeIds(viewer.id)).not.toContain(author.id);
      const { items } = await getFeedPosts({ cursor: null, viewerId: viewer.id });
      expect(items.map((p) => p.id)).not.toContain(post.id);
    });

    it("includes a private account's posts for an accepted follower", async () => {
      const viewer = await createUser();
      const author = await createUser();
      await setProfilePrivacy(author.id, true);
      await createFollow(viewer.id, author.id, { status: "accepted" });
      const post = await createPost({ authorId: author.id });

      expect(await getFolloweeIds(viewer.id)).toContain(author.id);
      const { items } = await getFeedPosts({ cursor: null, viewerId: viewer.id });
      expect(items.map((p) => p.id)).toContain(post.id);
    });

    it("includes a private account's own posts for themselves", async () => {
      const author = await createUser();
      await setProfilePrivacy(author.id, true);
      const post = await createPost({ authorId: author.id });

      const { items } = await getFeedPosts({ cursor: null, viewerId: author.id });
      expect(items.map((p) => p.id)).toContain(post.id);
    });
  });
});
