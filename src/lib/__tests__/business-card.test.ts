import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { getBusinessCard } from "@/lib/business-card";
import { createUser, createFollow, setProfilePrivacy } from "@/test/factories";

// FIX_PLAN P3 #1: socialLinks/email are opt-in, owner-enabled card fields
// that used to bypass the private-follower gate the main profile enforces
// for its own socialLinks — an enabled card leaked them to literally
// anyone regardless of the account's privacy setting. bio/workTitle stay
// ungated (isPrivate only ever gates posts/links/portfolio, never bio).
async function enableCard(profileId: string) {
  await db.digitalBusinessCard.create({
    data: { profileId, includedFields: JSON.stringify(["bio", "workTitle", "email", "socialLinks"]), enabled: true },
  });
}

describe("getBusinessCard privacy gating", () => {
  it("hides email/socialLinks from an anonymous viewer of a private account's card", async () => {
    const author = await createUser({ email: "author1@example.com" });
    await setProfilePrivacy(author.id, true);
    await enableCard(author.profile!.id);

    const card = await getBusinessCard(author.username!.handle, null);
    expect(card?.email).toBeNull();
    expect(card?.socialLinks).toEqual([]);
  });

  it("hides email/socialLinks from a viewer with only a pending follow request", async () => {
    const viewer = await createUser();
    const author = await createUser({ email: "author2@example.com" });
    await setProfilePrivacy(author.id, true);
    await createFollow(viewer.id, author.id, { status: "pending" });
    await enableCard(author.profile!.id);

    const card = await getBusinessCard(author.username!.handle, viewer.id);
    expect(card?.email).toBeNull();
    expect(card?.socialLinks).toEqual([]);
  });

  it("shows email/socialLinks to an accepted follower", async () => {
    const viewer = await createUser();
    const author = await createUser({ email: "author3@example.com" });
    await setProfilePrivacy(author.id, true);
    await createFollow(viewer.id, author.id, { status: "accepted" });
    await db.socialLink.create({ data: { profileId: author.profile!.id, platform: "twitter", url: "https://x.com/author", position: 0 } });
    await enableCard(author.profile!.id);

    const card = await getBusinessCard(author.username!.handle, viewer.id);
    expect(card?.email).toBe("author3@example.com");
    expect(card?.socialLinks).toHaveLength(1);
  });

  it("shows email/socialLinks to the owner viewing their own private card", async () => {
    const author = await createUser({ email: "author4@example.com" });
    await setProfilePrivacy(author.id, true);
    await enableCard(author.profile!.id);

    const card = await getBusinessCard(author.username!.handle, author.id);
    expect(card?.email).toBe("author4@example.com");
  });

  it("shows email/socialLinks to anyone for a public account", async () => {
    const author = await createUser({ email: "author5@example.com" });
    await enableCard(author.profile!.id);

    const card = await getBusinessCard(author.username!.handle, null);
    expect(card?.email).toBe("author5@example.com");
  });

  it("never gates bio/workTitle, regardless of privacy or viewer", async () => {
    const author = await createUser();
    await setProfilePrivacy(author.id, true);
    await db.profile.update({ where: { id: author.profile!.id }, data: { bio: "Hello there" } });
    await db.workExperience.create({
      data: { profileId: author.profile!.id, title: "Engineer", company: "Acme", startDate: new Date(), position: 0 },
    });
    await enableCard(author.profile!.id);

    const card = await getBusinessCard(author.username!.handle, null);
    expect(card?.bio).toBe("Hello there");
    expect(card?.workTitle).toBe("Engineer — Acme");
  });
});
