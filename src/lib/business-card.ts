import "server-only";
import { db } from "@/lib/db";
import type { CardFieldKey } from "@/lib/card-fields";

export type BusinessCardData = {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  workTitle: string | null;
  email: string | null;
  socialLinks: { platform: string; url: string }[];
};

// Shared by the public card page and the vCard export route — both need
// the identical enabled-check + field-filter, spec §6.1's "same canonical
// profile" posture applied to the read side too.
//
// FIX_PLAN P3 #1 (privacy-policy call, resolved: respect the same gate):
// socialLinks/email are opt-in, owner-enabled card fields, but they used to
// bypass the private-follower gate the main profile enforces for its own
// socialLinks entirely — an enabled card leaked them to anyone, private
// account or not. bio/workTitle stay ungated, matching the app's own
// documented spec: isPrivate only ever gates posts/links/portfolio, never
// the bio (or, by the same reasoning, the work title).
export async function getBusinessCard(handle: string, viewerId: string | null): Promise<BusinessCardData | null> {
  const username = await db.username.findUnique({
    where: { handle },
    include: {
      user: {
        include: {
          profile: {
            include: {
              workExperiences: { orderBy: { position: "asc" }, take: 1 },
              socialLinks: { orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!username?.user.profile) return null;

  const card = await db.digitalBusinessCard.findUnique({ where: { profileId: username.user.profile.id } });
  if (!card || !card.enabled) return null;

  const fields = JSON.parse(card.includedFields) as CardFieldKey[];
  const profile = username.user.profile;
  const latestWork = profile.workExperiences[0];

  const isOwner = viewerId === username.userId;
  const canViewGatedFields =
    isOwner ||
    !profile.isPrivate ||
    (viewerId
      ? (await db.follow.findUnique({
          where: { followerId_followeeId: { followerId: viewerId, followeeId: username.userId } },
        }))?.status === "accepted"
      : false);

  return {
    handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: fields.includes("bio") ? profile.bio : null,
    workTitle: fields.includes("workTitle") && latestWork ? `${latestWork.title} — ${latestWork.company}` : null,
    email: fields.includes("email") && canViewGatedFields ? username.user.email : null,
    socialLinks:
      fields.includes("socialLinks") && canViewGatedFields
        ? profile.socialLinks.map((s) => ({ platform: s.platform, url: s.url }))
        : [],
  };
}
