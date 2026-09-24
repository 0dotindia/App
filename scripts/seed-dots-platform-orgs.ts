import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PALETTES, avatarSvg, coverSvg } from "./seed-dots-art";
import { SEED_EMAIL_DOMAIN, recountNonSeed } from "./seed-dots-cleanup";
import { REPLIES } from "./seed-dots-data";
import { REVIEW_BODIES, REVIEW_RESPONSES } from "./seed-dots-orgs-data";

// Makes the platform account (@dot by default) part of the communities and
// businesses seeded by seed-dots-orgs.ts, and gives it its own official
// community: it owns "0dot Welcome Hall" (~70 seeded dots join, @dot posts
// announcements, dots like and reply, @dot answers some), joins a handful of seeded
// communities (likes and comments on their posts), leaves reviews on a few
// businesses (owners reply, owners get a business_review notification) and
// likes/comments on business posts.
//
// Run seed-dots.ts and seed-dots-orgs.ts first. Safe to re-run: every step tops up to a
// fixed target instead of adding more.
//
// Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-platform-orgs.ts
//        PLATFORM_HANDLE=dot SEED=5 npx tsx scripts/seed-dots-platform-orgs.ts
//        UNDO=1 npx tsx scripts/seed-dots-platform-orgs.ts   (delete the Welcome Hall community)
// Cleanup: RESET=1 seed-dots-orgs.ts / delete-seed-users.ts remove @dot's activity in seeded
// communities and businesses; only the Welcome Hall (owned by @dot) needs UNDO=1.

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(Number(process.env.SEED ?? 5));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T,>(arr: readonly T[]): T[] => [...arr].sort(() => rand() - 0.5);

const HALL_SLUG = "welcome_hall";
const HALL = {
  name: "0dot Welcome Hall",
  description: "The official community of the 0dot team. Announcements, tips, feedback and a friendly place to say hello. New here? Introduce yourself!",
  tags: ["tech", "news"],
  rules: [
    ["Be kind", "Everyone here is new to something. Help each other out."],
    ["Feedback welcome", "Tell us what's broken or missing. Specific beats angry."],
    ["No spam", "Promotions and referral links will be removed."],
  ] as [string, string][],
  posts: [
    { body: "Welcome to the 0dot Welcome Hall 🙏 This is our home for announcements and your questions. Introduce yourself below, and tell us what you're building.", daysAgo: 14, pinned: true },
    { body: "You can now start communities and businesses on 0dot. Try one for your city, craft or shop, and invite people who care about the same things.", daysAgo: 8, pinned: false },
    { body: "Community tip: pin a welcome post, add three clear rules and answer the first few posts yourself. Communities that do this grow noticeably faster.", daysAgo: 4, pinned: false },
    { body: "What would make your community or business page more useful? Reply with one thing, we're reading every answer.", daysAgo: 1.5, pinned: false },
  ],
};
const HALL_REPLIES = [
  "Namaste! Excited to be here 🙏", "Thank you for building this ❤️", "Introducing myself: happy to be here and looking for people in my city.",
  "This is exactly the kind of community I was hoping for.", "Just created my first community, thank you for the tips!", "Small and friendly, please keep it that way.",
  "Love the businesses feature. Setting one up for my family shop.", "A way to schedule community announcements would be great.",
  "Could we have an events calendar inside communities?", "Reviews for businesses are a great touch.", "Hello from Kolkata 👋",
];
const HALL_REPLY_BACKS = ["Thank you, glad you're here!", "Noted, thanks for the suggestion 📝", "Welcome aboard! 🙌", "Great to hear, thank you!"];
const COMMUNITY_COMMENTS = ["Welcome to the community, great post!", "Love seeing communities like this on 0dot.", "Thanks for sharing this here 🙏", "Really nice discussion, thanks for starting it.", "Great tip. Pinning this for the team ✨"];
const BUSINESS_COMMENTS = ["Lovely to see local businesses on 0dot!", "Congratulations, wishing you the best 🎉", "Great to have you here 🙏", "Looks wonderful. Thanks for sharing!"];
const DOT_REVIEWS = [
  "The 0dot team stopped by and came away impressed. Warm service and good quality.",
  "Tried them out while testing Businesses on 0dot. Genuinely a pleasant experience.",
  "Good quality and helpful staff. Happy to recommend to other dots.",
];

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  const handle = (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase();
  console.log(`Platform community/business interactions for @${handle} at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const now = Date.now();
  const seedFilter = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };

  try {
    const platformName = await prisma.username.findUnique({ where: { handle }, select: { userId: true, user: { select: { email: true } } } });
    if (!platformName) throw new Error(`No account with handle @${handle}.`);
    if (platformName.user.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) throw new Error(`@${handle} is a seeded dot, not the platform account.`);
    const P = platformName.userId;

    if (process.env.UNDO === "1") {
      const { count } = await prisma.community.deleteMany({ where: { slug: HALL_SLUG, createdBy: P } });
      console.log(`UNDO: removed ${count} community (${HALL_SLUG}).`);
      return;
    }

    const seeded = await prisma.user.findMany({ where: seedFilter, select: { id: true, createdAt: true } });
    const S = seeded.map((u) => ({ id: u.id, createdAt: u.createdAt.getTime() }));
    const seededCommunities = await prisma.community.findMany({ where: { creator: seedFilter }, select: { id: true, slug: true, visibility: true, createdAt: true } });
    const seededBusinesses = await prisma.business.findMany({ where: { creator: seedFilter, status: "active" }, select: { id: true, slug: true, createdBy: true, createdAt: true } });
    if (S.length === 0 || seededCommunities.length === 0 || seededBusinesses.length === 0) {
      throw new Error("Seeded dots/communities/businesses missing. Run seed-dots.ts and seed-dots-orgs.ts first.");
    }
    const after = (from: number, maxDays: number) => new Date(Math.min(now - MIN, from + 3 * MIN + rand() * maxDays * DAY));

    type NotifRow = { recipientId: string; actorId: string; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null };
    const notifs: NotifRow[] = [];
    const readMaybe = (at: Date, toPlatform: boolean) => (chance(toPlatform ? 0.12 : 0.55) ? new Date(at.getTime() + between(5, 600) * MIN) : null);
    type PostRow = { id: string; authorId: string; body: string; createdAt: Date; communityId: string | null; replyToId: string | null; pinnedAt?: Date | null; likeCount?: number; replyCount?: number };
    const newPosts: PostRow[] = [];
    const newLikes: { postId: string; userId: string; createdAt: Date }[] = [];
    const bump = new Map<string, { like: number; reply: number }>();
    const bumpOf = (id: string) => bump.get(id) ?? bump.set(id, { like: 0, reply: 0 }).get(id)!;

    // ---- 1. The official Welcome Hall community, owned by @dot ----
    let hall = await prisma.community.findUnique({ where: { slug: HALL_SLUG }, select: { id: true, createdBy: true, createdAt: true } });
    if (hall && hall.createdBy !== P) throw new Error(`Community /c/${HALL_SLUG} exists but isn't owned by @${handle}.`);
    let hallCreated = false;
    if (!hall) {
      mkdirSync("public/uploads", { recursive: true });
      writeFileSync(`public/uploads/community-${HALL_SLUG}.svg`, avatarSvg("0", PALETTES[0], 0));
      writeFileSync(`public/uploads/community-${HALL_SLUG}-cover.svg`, coverSvg(PALETTES[0], 1));
      hall = await prisma.community.create({
        data: {
          slug: HALL_SLUG,
          name: HALL.name,
          description: HALL.description,
          visibility: "public",
          avatarUrl: `/uploads/community-${HALL_SLUG}.svg`,
          coverUrl: `/uploads/community-${HALL_SLUG}-cover.svg`,
          createdBy: P,
          createdAt: new Date(now - 16 * DAY),
          members: { create: [{ userId: P, role: "owner", status: "active", joinedAt: new Date(now - 16 * DAY) }] },
          tags: { create: HALL.tags.map((tag) => ({ tag })) },
          rules: { create: HALL.rules.map(([title, body], position) => ({ title, body, position })) },
        },
        select: { id: true, createdBy: true, createdAt: true },
      });
      hallCreated = true;
    }
    const hallStart = hall.createdAt.getTime();

    const hallMembers = new Set((await prisma.communityMember.findMany({ where: { communityId: hall.id }, select: { userId: true } })).map((m) => m.userId));
    const joiners = shuffle(S.filter((s) => !hallMembers.has(s.id))).slice(0, Math.max(0, 70 - (hallMembers.size - 1)));
    await prisma.communityMember.createMany({
      data: joiners.map((s) => ({ communityId: hall!.id, userId: s.id, role: "member", status: "active", joinedAt: after(Math.max(hallStart, s.createdAt), 12) })),
    });
    joiners.forEach((s) => hallMembers.add(s.id));
    const hallAudience = S.filter((s) => hallMembers.has(s.id));

    const hallExisting = new Map((await prisma.post.findMany({ where: { communityId: hall.id, authorId: P, replyToId: null, deletedAt: null }, select: { id: true, body: true } })).map((p) => [p.body, p.id]));
    for (const hp of HALL.posts) {
      if (hallExisting.has(hp.body)) continue; // already posted (and reacted to) on an earlier run
      const createdAt = new Date(now - hp.daysAgo * DAY);
      const id = randomUUID();
      const audience = shuffle(hallAudience);
      const likers = audience.slice(0, Math.floor(audience.length * (0.3 + rand() * 0.35)));
      likers.forEach((s) => {
        const at = after(createdAt.getTime(), 4);
        newLikes.push({ postId: id, userId: s.id, createdAt: at });
        notifs.push({ recipientId: P, actorId: s.id, type: "like", subjectType: "post", subjectId: id, createdAt: at, readAt: readMaybe(at, true) });
      });
      const repliers = shuffle(audience).slice(0, between(4, 8));
      const hallReplies: PostRow[] = repliers.map((s, i) => ({ id: randomUUID(), authorId: s.id, body: HALL_REPLIES[(i + int(3)) % HALL_REPLIES.length], createdAt: after(createdAt.getTime(), 3), communityId: hall!.id, replyToId: id }));
      let replyCount = hallReplies.length;
      hallReplies.forEach((r) => notifs.push({ recipientId: P, actorId: r.authorId, type: "comment", subjectType: "post", subjectId: id, createdAt: r.createdAt, readAt: readMaybe(r.createdAt, true) }));
      for (const r of hallReplies) {
        if (!chance(0.5)) continue;
        const at = after(r.createdAt.getTime(), 1);
        newPosts.push({ id: randomUUID(), authorId: P, body: pick(HALL_REPLY_BACKS), createdAt: at, communityId: hall!.id, replyToId: r.id, likeCount: 0, replyCount: 0 });
        r.replyCount = 1;
        notifs.push({ recipientId: r.authorId, actorId: P, type: "comment", subjectType: "post", subjectId: r.id, createdAt: at, readAt: readMaybe(at, false) });
      }
      newPosts.push({ id, authorId: P, body: hp.body, createdAt, communityId: hall.id, replyToId: null, pinnedAt: hp.pinned ? createdAt : null, likeCount: likers.length, replyCount });
      newPosts.push(...hallReplies);
    }

    // ---- 2. @dot joins seeded communities, likes and comments on their posts ----
    const joinedBefore = new Set((await prisma.communityMember.findMany({ where: { userId: P, communityId: { in: seededCommunities.map((c) => c.id) } }, select: { communityId: true } })).map((m) => m.communityId));
    const toJoin = shuffle(seededCommunities.filter((c) => c.visibility === "public" && !joinedBefore.has(c.id))).slice(0, Math.max(0, 8 - joinedBefore.size));
    await prisma.communityMember.createMany({ data: toJoin.map((c) => ({ communityId: c.id, userId: P, role: "member", status: "active", joinedAt: after(c.createdAt.getTime(), 20) })) });
    toJoin.forEach((c) => joinedBefore.add(c.id));

    const communityPosts = await prisma.post.findMany({
      where: { communityId: { in: [...joinedBefore] }, replyToId: null, deletedAt: null, author: seedFilter },
      select: { id: true, authorId: true, createdAt: true, likeCount: true },
    });
    const likedAlready = new Set((await prisma.postLike.findMany({ where: { userId: P, postId: { in: communityPosts.map((p) => p.id) } }, select: { postId: true } })).map((l) => l.postId));
    const commentedBefore = await prisma.post.count({ where: { authorId: P, communityId: { in: [...joinedBefore] }, replyToId: { not: null }, deletedAt: null } });
    const ranked = shuffle(communityPosts).sort((a, b) => b.likeCount * (0.6 + rand()) - a.likeCount * (0.6 + rand()));
    const cLikes = ranked.filter((p) => !likedAlready.has(p.id)).slice(0, Math.max(0, 25 - likedAlready.size));
    const communityOf = new Map((await prisma.post.findMany({ where: { id: { in: cLikes.map((p) => p.id) } }, select: { id: true, communityId: true } })).map((p) => [p.id, p.communityId]));
    cLikes.forEach((p, i) => {
      const at = after(p.createdAt.getTime(), 4);
      newLikes.push({ postId: p.id, userId: P, createdAt: at });
      bumpOf(p.id).like++;
      notifs.push({ recipientId: p.authorId, actorId: P, type: "like", subjectType: "post", subjectId: p.id, createdAt: at, readAt: readMaybe(at, false) });
      if (i < Math.max(0, 8 - commentedBefore)) {
        const cAt = after(p.createdAt.getTime() + 5 * MIN, 4);
        newPosts.push({ id: randomUUID(), authorId: P, body: pick(COMMUNITY_COMMENTS), createdAt: cAt, communityId: communityOf.get(p.id) ?? null, replyToId: p.id, likeCount: 0, replyCount: 0 });
        bumpOf(p.id).reply++;
        notifs.push({ recipientId: p.authorId, actorId: P, type: "comment", subjectType: "post", subjectId: p.id, createdAt: cAt, readAt: readMaybe(cAt, false) });
      }
    });

    // ---- 3. @dot reviews a few businesses; owners answer ----
    const reviewedBefore = new Set((await prisma.review.findMany({ where: { authorId: P }, select: { businessId: true } })).map((r) => r.businessId));
    const toReview = shuffle(seededBusinesses.filter((b) => !reviewedBefore.has(b.id))).slice(0, Math.max(0, 5 - reviewedBefore.size));
    const dotReviews: { id: string; businessId: string; authorId: string; rating: number; body: string; createdAt: Date }[] = [];
    for (const b of toReview) {
      const rating = chance(0.6) ? 5 : 4;
      const createdAt = after(b.createdAt.getTime() + 2 * DAY, 30);
      dotReviews.push({ id: randomUUID(), businessId: b.id, authorId: P, rating, body: chance(0.5) ? pick(DOT_REVIEWS) : pick(REVIEW_BODIES[rating]), createdAt });
      notifs.push({ recipientId: b.createdBy, actorId: P, type: "business_review", subjectType: "business", subjectId: b.id, createdAt, readAt: readMaybe(createdAt, false) });
    }
    if (dotReviews.length) {
      await prisma.review.createMany({ data: dotReviews });
      await prisma.reviewResponse.createMany({
        data: dotReviews.map((r) => ({ reviewId: r.id, responderId: seededBusinesses.find((b) => b.id === r.businessId)!.createdBy, body: pick(REVIEW_RESPONSES), createdAt: after(r.createdAt.getTime(), 2) })),
      });
      for (const businessId of new Set(dotReviews.map((r) => r.businessId))) {
        const agg = await prisma.review.aggregate({ where: { businessId }, _avg: { rating: true }, _count: true });
        await prisma.business.update({ where: { id: businessId }, data: { reviewCount: agg._count, averageRating: Math.round((agg._avg.rating ?? 0) * 100) / 100 } });
      }
    }

    // ---- 4. @dot likes and comments on business posts ----
    const bizPosts = await prisma.post.findMany({ where: { businessAuthorId: { in: seededBusinesses.map((b) => b.id) }, replyToId: null, deletedAt: null }, select: { id: true, authorId: true, createdAt: true, likeCount: true } });
    const bLikedAlready = new Set((await prisma.postLike.findMany({ where: { userId: P, postId: { in: bizPosts.map((p) => p.id) } }, select: { postId: true } })).map((l) => l.postId));
    const bCommentedBefore = await prisma.post.count({ where: { authorId: P, replyTo: { businessAuthorId: { in: seededBusinesses.map((b) => b.id) } }, deletedAt: null } });
    const bLikes = shuffle(bizPosts).filter((p) => !bLikedAlready.has(p.id)).slice(0, Math.max(0, 12 - bLikedAlready.size));
    bLikes.forEach((p, i) => {
      const at = after(p.createdAt.getTime(), 4);
      newLikes.push({ postId: p.id, userId: P, createdAt: at });
      bumpOf(p.id).like++;
      notifs.push({ recipientId: p.authorId, actorId: P, type: "like", subjectType: "post", subjectId: p.id, createdAt: at, readAt: readMaybe(at, false) });
      if (i < Math.max(0, 4 - bCommentedBefore)) {
        const cAt = after(p.createdAt.getTime() + 5 * MIN, 4);
        newPosts.push({ id: randomUUID(), authorId: P, body: pick(BUSINESS_COMMENTS), createdAt: cAt, communityId: null, replyToId: p.id, likeCount: 0, replyCount: 0 });
        bumpOf(p.id).reply++;
        notifs.push({ recipientId: p.authorId, actorId: P, type: "comment", subjectType: "post", subjectId: p.id, createdAt: cAt, readAt: readMaybe(cAt, false) });
      }
    });

    // ---- write it all (parents before replies) ----
    const parentOf = new Map(newPosts.map((p) => [p.id, p.replyToId]));
    const depth = (p: PostRow): number => (p.replyToId && parentOf.has(p.replyToId) ? 1 + depth(newPosts.find((q) => q.id === p.replyToId)!) : 0);
    const ordered = [...newPosts].sort((a, b) => depth(a) - depth(b));
    await prisma.post.createMany({ data: ordered.map((p) => ({ ...p, repostOfId: null, pinnedAt: p.pinnedAt ?? null, likeCount: p.likeCount ?? 0, replyCount: p.replyCount ?? 0 })) });
    await prisma.postLike.createMany({ data: newLikes });
    for (let i = 0; i < notifs.length; i += 800) await prisma.notification.createMany({ data: notifs.slice(i, i + 800) });
    for (const [id, b] of bump) await prisma.post.update({ where: { id }, data: { likeCount: { increment: b.like }, replyCount: { increment: b.reply } } });

    // Denormalised member counts come from the real rows.
    for (const id of [hall.id, ...toJoin.map((c) => c.id)]) {
      await prisma.community.update({ where: { id }, data: { memberCount: await prisma.communityMember.count({ where: { communityId: id, status: "active" } }) } });
    }
    await recountNonSeed(prisma);

    console.log(`Welcome Hall /c/${HALL_SLUG}: ${hallCreated ? "created" : "exists"}, +${joiners.length} members (${hallMembers.size} total), ${newPosts.filter((p) => p.communityId === hall!.id).length} new posts/replies.`);
    console.log(`@${handle} joined ${toJoin.length} seeded communities (${joinedBefore.size} total), liked ${cLikes.length} community posts.`);
    console.log(`@${handle} reviewed ${dotReviews.length} businesses (${reviewedBefore.size + dotReviews.length} total), liked ${bLikes.length} business posts.`);
    console.log(`Notifications created: ${notifs.length}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
