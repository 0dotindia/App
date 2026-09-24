import { createCipheriv, randomBytes, randomUUID } from "crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { SEED_EMAIL_DOMAIN, recountNonSeed } from "./seed-dots-cleanup";

// Makes the seeded dots (seed-dots.ts) interact with the platform account
// (@dot by default): they follow it, like/reply to its posts, tag it, and DM it;
// the platform account follows some back, likes and comments on seeded posts,
// reposts a few, and answers replies. Run seed-dots.ts first.
//
// Adds a handful of platform announcement posts (skipped if already present)
// so there is something to react to. Safe to re-run: every step tops up to a fixed
// target (90% of dots following, 30 follow-backs, 6 DM threads, 70 likes...) instead of
// adding more, and the platform account's counters are recomputed from real rows.
//
// Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-platform.ts
//        PLATFORM_HANDLE=dot SEED=7 npx tsx scripts/seed-dots-platform.ts
// Cleanup: RESET=1 npx tsx scripts/seed-dots.ts (or delete-seed-users.ts) removes
// everything seeded dots did with the platform account, except its announcement posts.

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
const rand = mulberry32(Number(process.env.SEED ?? 7));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => rand() - 0.5);
const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function encryptAtRest(plaintext: string): string {
  const key = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY ?? "", "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

const PLATFORM_POSTS: { body: string; daysAgo: number; feedback?: boolean }[] = [
  { body: "Namaste from the 0dot team 🙏 Thank you for being early. Be kind, be curious, and follow people who make your day better.", daysAgo: 16 },
  { body: "Welcome to 0dot 👋 One home for your profile, posts, messages and portfolio. Say hi below and tell us what you're building.", daysAgo: 13 },
  { body: "Tip: add your skills, work history and education and your profile doubles as a resume. Try the Resume button on any profile.", daysAgo: 9 },
  { body: "Communities are open. Start one for your city, craft or college batch and invite people who care about the same things.", daysAgo: 6 },
  { body: "Reminder: you decide who can message you. Settings → Privacy lets you limit DMs to followers, or turn them off.", daysAgo: 3 },
  { body: "We're listening. What's one thing on 0dot that feels slow, confusing or missing? Reply here, we read every one.", daysAgo: 1.5, feedback: true },
];

const WELCOME_REPLIES = [
  "Namaste! Excited to be here 🙏", "Loving the vibe so far.", "Happy to be part of this from day one!", "Thank you for building this ❤️",
  "Great to be here. Following everyone I can find 😄", "This is a nice, calm corner of the internet.", "Just set up my profile. Clean and fast!",
  "Hello from my city! 👋", "Signed up, stayed for the people.", "Congrats on the launch! Rooting for you.", "Already found some brilliant people here.",
  "Love that it feels like a real community and not a feed of ads.", "Hi team! Big fan already.", "Small, friendly, and fast. Keep it that way!",
];
const FEEDBACK_REPLIES = [
  "Would love a way to schedule posts ahead of time.", "Hindi, Tamil and Bengali UI would be huge for a lot of people here.",
  "Better search filters please: by city, skill and role.", "An option to mute keywords would help my sanity.",
  "Threaded DMs would be great for project chats.", "More profile themes! The current ones are lovely though.",
  "A proper draft folder for longer posts.", "Notification grouping is nice. Maybe a daily digest option too?",
  "Would love to see who bookmarked my posts (privately, just counts).", "Voice notes in DMs work great. Video notes next? 😄",
  "Import followers from other platforms would make onboarding so much easier.", "A calendar view for events near me.",
];
const PLATFORM_REPLY_BACKS = ["Thank you! 🙏", "Glad you're here!", "Appreciate you being early 🙌", "Welcome aboard!", "That means a lot to us."];
const FEEDBACK_REPLY_BACKS = ["Noted, thank you! Passing this to the team.", "Great suggestion. Added to our list 📝", "Thanks for this, super helpful.", "We hear you. Working on it!", "Really useful feedback, thank you 🙏"];
const PLATFORM_COMMENTS = [
  "Love this! 🙌", "Great post, thanks for sharing with the community.", "Welcome to 0dot!", "This is exactly what we hoped people would share here.",
  "Beautifully said.", "Thanks for being part of 0dot 🙏", "Nicely put. Keep posting!", "Featuring posts like this in our thoughts today ✨",
];
const TAG_TAILS = ["any plans for this?", "quick question when you have a moment.", "loving what you're building!", "thanks for the team's hard work 🙏"];

const DM_THREADS: string[][] = [
  ["Hi team, loving 0dot! Quick question: how do I get the verified badge?", "Thanks {a}! Glad you like it. Verification is handled by our team and we'll share the process soon.", "Great, looking forward to it!"],
  ["Hello! I found a small bug on my profile page. The cover image looks a bit cropped on mobile.", "Thank you for reporting, {a}. Could you share a screenshot and your phone model?", "Sure, sending it in a bit."],
  ["Hi, is there a way to move my posts to a community later?", "Hi {a}! Great question. Right now you pick the community when you post. We're noting this as a request.", "Perfect, thanks for the quick reply!"],
  ["Hey! Just wanted to say thanks for making something built for us. 🙏", "That's so kind, {a}. Thank you for being here from the start!"],
  ["Hi 0dot team, how can I report a spam account?", "Hi {a}, use the Report button on their profile or post. Our trust & safety team reviews every report."],
  ["Hello! Can my business use 0dot for a page?", "Hi {a}! Yes, Businesses is under Spaces in the sidebar. Give it a try and tell us how it goes."],
];

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  const handle = (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase();
  console.log(`Platform interactions for @${handle} at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const canEncrypt = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY ?? "", "base64").length === 32;
  const now = Date.now();

  try {
    const platformName = await prisma.username.findUnique({ where: { handle }, select: { userId: true, user: { select: { email: true, createdAt: true } } } });
    if (!platformName) throw new Error(`No account with handle @${handle}.`);
    if (platformName.user.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) throw new Error(`@${handle} is a seeded dot, not the platform account.`);
    const P = platformName.userId;

    const seeded = await prisma.user.findMany({
      where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
      select: { id: true, createdAt: true, username: { select: { handle: true } }, profile: { select: { displayName: true, followerCount: true } } },
    });
    if (seeded.length === 0) throw new Error("No seeded dots found. Run scripts/seed-dots.ts first.");
    const S = seeded.map((u) => ({ id: u.id, handle: u.username!.handle, first: u.profile!.displayName.split(" ")[0], createdAt: u.createdAt.getTime(), pop: u.profile!.followerCount + 1 }));
    const platformCreated = platformName.user.createdAt.getTime();

    type NotifRow = { recipientId: string; actorId: string; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null };
    const notifs: NotifRow[] = [];
    // Notifications to the platform account stay mostly unread so its inbox looks alive.
    const readMaybe = (at: Date, toPlatform: boolean) => (chance(toPlatform ? 0.12 : 0.55) ? new Date(at.getTime() + between(5, 600) * MIN) : null);
    const after = (from: number, maxDays: number) => new Date(Math.min(now - MIN, from + 3 * MIN + rand() * maxDays * DAY));

    // ---- 1. Platform announcement posts ----
    const platformPosts: { id: string; createdAt: number; feedback: boolean }[] = [];
    const existingBodies = new Map((await prisma.post.findMany({ where: { authorId: P, deletedAt: null }, select: { id: true, body: true, createdAt: true } })).map((p) => [p.body, p]));
    let newPlatformPosts = 0;
    for (const pp of PLATFORM_POSTS) {
      const existing = existingBodies.get(pp.body);
      if (existing) {
        platformPosts.push({ id: existing.id, createdAt: existing.createdAt.getTime(), feedback: !!pp.feedback });
        continue;
      }
      const createdAt = new Date(now - pp.daysAgo * DAY);
      const created = await prisma.post.create({ data: { authorId: P, body: pp.body, createdAt } });
      platformPosts.push({ id: created.id, createdAt: createdAt.getTime(), feedback: !!pp.feedback });
      newPlatformPosts++;
    }
    const oldest = Math.min(...platformPosts.map((p) => p.createdAt), platformCreated);

    // ---- 2. Follows both ways ----
    const followsExisting = new Set((await prisma.follow.findMany({ where: { OR: [{ followerId: P }, { followeeId: P }] }, select: { followerId: true, followeeId: true } })).map((f) => `${f.followerId}:${f.followeeId}`));
    const followRows: { followerId: string; followeeId: string; status: string; createdAt: Date }[] = [];
    for (const s of S) {
      if (followsExisting.has(`${s.id}:${P}`) || !chance(0.92)) continue;
      const createdAt = after(Math.max(s.createdAt, oldest), 25);
      followRows.push({ followerId: s.id, followeeId: P, status: "accepted", createdAt });
      notifs.push({ recipientId: P, actorId: s.id, type: "new_follower", subjectType: "user", subjectId: s.id, createdAt, readAt: readMaybe(createdAt, true) });
    }
    // The platform account follows back the most active/popular ~30, not everyone.
    const followingBefore = [...followsExisting].filter((k) => k.startsWith(`${P}:`)).length;
    const followsBack = [...S].sort((a, b) => b.pop * (0.5 + rand()) - a.pop * (0.5 + rand())).filter((s) => !followsExisting.has(`${P}:${s.id}`)).slice(0, Math.max(0, 30 - followingBefore));
    for (const s of followsBack) {
      if (followsExisting.has(`${P}:${s.id}`)) continue;
      const createdAt = after(Math.max(s.createdAt, oldest), 20);
      followRows.push({ followerId: P, followeeId: s.id, status: "accepted", createdAt });
      notifs.push({ recipientId: s.id, actorId: P, type: "new_follower", subjectType: "user", subjectId: P, createdAt, readAt: readMaybe(createdAt, false) });
    }
    for (const part of chunk(followRows, 500)) await prisma.follow.createMany({ data: part });
    const followerSet = new Set([...followsExisting].filter((k) => k.endsWith(`:${P}`)).map((k) => k.split(":")[0]));
    for (const f of followRows) if (f.followeeId === P) followerSet.add(f.followerId);
    const platformFollowers = S.filter((s) => followerSet.has(s.id));

    // ---- 3. Seeded dots react to platform posts ----
    const likeExisting = new Set((await prisma.postLike.findMany({ where: { postId: { in: platformPosts.map((p) => p.id) } }, select: { postId: true, userId: true } })).map((l) => `${l.postId}:${l.userId}`));
    const likeRows: { postId: string; userId: string; createdAt: Date }[] = [];
    const replyRows: { id: string; authorId: string; body: string; createdAt: Date; replyToId: string }[] = [];
    const alreadyReplied = new Set((await prisma.post.findMany({ where: { replyToId: { in: platformPosts.map((p) => p.id) } }, select: { replyToId: true } })).map((r) => r.replyToId));
    for (const post of platformPosts) {
      if (alreadyReplied.has(post.id)) continue; // already reacted to on an earlier run
      const audience = shuffle(platformFollowers.filter((s) => s.createdAt < post.createdAt));
      for (const s of audience.slice(0, Math.floor(audience.length * (0.35 + rand() * 0.4)))) {
        if (likeExisting.has(`${post.id}:${s.id}`)) continue;
        const at = after(post.createdAt, 4);
        likeRows.push({ postId: post.id, userId: s.id, createdAt: at });
        notifs.push({ recipientId: P, actorId: s.id, type: "like", subjectType: "post", subjectId: post.id, createdAt: at, readAt: readMaybe(at, true) });
      }
      const pool = shuffle(post.feedback ? FEEDBACK_REPLIES : WELCOME_REPLIES);
      const repliers = shuffle(audience).slice(0, Math.min(pool.length, post.feedback ? between(9, 12) : between(6, 10)));
      repliers.forEach((s, i) => {
        const at = after(post.createdAt, 3);
        const tagged = post.feedback && chance(0.3);
        const body = tagged ? `@${handle} ${pick(TAG_TAILS)}` : pool[i % pool.length];
        const id = randomUUID();
        replyRows.push({ id, authorId: s.id, body, createdAt: at, replyToId: post.id });
        notifs.push({ recipientId: P, actorId: s.id, type: "comment", subjectType: "post", subjectId: post.id, createdAt: at, readAt: readMaybe(at, true) });
        if (tagged) notifs.push({ recipientId: P, actorId: s.id, type: "mention", subjectType: "post", subjectId: id, createdAt: at, readAt: readMaybe(at, true) });
      });
    }
    // The platform account answers ~half the replies.
    const platformReplyRows: { id: string; authorId: string; body: string; createdAt: Date; replyToId: string }[] = [];
    for (const r of replyRows) {
      if (!chance(0.5)) continue;
      const feedback = platformPosts.find((p) => p.id === r.replyToId)?.feedback;
      const at = after(r.createdAt.getTime(), 1);
      platformReplyRows.push({ id: randomUUID(), authorId: P, body: pick(feedback ? FEEDBACK_REPLY_BACKS : PLATFORM_REPLY_BACKS), createdAt: at, replyToId: r.id });
      notifs.push({ recipientId: r.authorId, actorId: P, type: "comment", subjectType: "post", subjectId: r.id, createdAt: at, readAt: readMaybe(at, false) });
    }

    // ---- 4. Platform account reacts to seeded posts ----
    const seededPosts = await prisma.post.findMany({
      where: { author: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } }, replyToId: null, repostOfId: null, deletedAt: null },
      select: { id: true, authorId: true, createdAt: true, likeCount: true },
    });
    const pAlready = new Set((await prisma.postLike.findMany({ where: { userId: P, post: { author: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } } }, select: { postId: true } })).map((l) => l.postId));
    // Favour posts that already have traction, like a real brand account would.
    const ranked = shuffle(seededPosts).sort((a, b) => b.likeCount * (0.6 + rand()) - a.likeCount * (0.6 + rand()));
    const [commentedBefore, repostedBefore] = await Promise.all([
      prisma.post.count({ where: { authorId: P, replyTo: { author: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } }, deletedAt: null } }),
      prisma.post.count({ where: { authorId: P, repostOf: { author: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } }, deletedAt: null } }),
    ]);
    const likedByPlatform = ranked.filter((p) => !pAlready.has(p.id)).slice(0, Math.max(0, 70 - pAlready.size));
    const commentTarget = Math.max(0, 20 - commentedBefore);
    const repostTarget = Math.max(0, 6 - repostedBefore);
    const bump = new Map<string, { like: number; reply: number; repost: number }>();
    const bumpOf = (id: string) => bump.get(id) ?? bump.set(id, { like: 0, reply: 0, repost: 0 }).get(id)!;
    const platformLikeRows = likedByPlatform.map((p) => {
      const at = after(p.createdAt.getTime(), 4);
      bumpOf(p.id).like++;
      notifs.push({ recipientId: p.authorId, actorId: P, type: "like", subjectType: "post", subjectId: p.id, createdAt: at, readAt: readMaybe(at, false) });
      return { postId: p.id, userId: P, createdAt: at };
    });
    const platformCommentRows: { id: string; authorId: string; body: string; createdAt: Date; replyToId: string }[] = [];
    for (const p of likedByPlatform.slice(0, commentTarget)) {
      const at = after(p.createdAt.getTime() + 5 * MIN, 4);
      platformCommentRows.push({ id: randomUUID(), authorId: P, body: pick(PLATFORM_COMMENTS), createdAt: at, replyToId: p.id });
      bumpOf(p.id).reply++;
      notifs.push({ recipientId: p.authorId, actorId: P, type: "comment", subjectType: "post", subjectId: p.id, createdAt: at, readAt: readMaybe(at, false) });
    }
    const platformRepostRows = likedByPlatform.slice(commentTarget, commentTarget + repostTarget).map((p) => {
      bumpOf(p.id).repost++;
      return { id: randomUUID(), authorId: P, body: "", createdAt: after(p.createdAt.getTime(), 3), repostOfId: p.id };
    });

    // ---- 5. DMs to the platform account ----
    const dmPlan: { s: (typeof S)[number]; lines: string[] }[] = [];
    if (canEncrypt) {
      const existingConvs = new Set((await prisma.conversationParticipant.findMany({ where: { conversation: { participants: { some: { userId: P } } }, userId: { not: P } }, select: { userId: true } })).map((c) => c.userId));
      const candidates = shuffle(platformFollowers.filter((s) => !existingConvs.has(s.id)));
      DM_THREADS.slice(0, Math.max(0, DM_THREADS.length - existingConvs.size)).forEach((lines, i) => candidates[i] && dmPlan.push({ s: candidates[i], lines }));
    } else {
      console.log("Skipping DMs: MESSAGE_ENCRYPTION_KEY missing/invalid.");
    }

    // ---- write it all (parents before dependents) ----
    const mkPost = (r: { id: string; authorId: string; body: string; createdAt: Date; replyToId?: string; repostOfId?: string }) => ({ ...r, replyToId: r.replyToId ?? null, repostOfId: r.repostOfId ?? null });
    for (const part of chunk(replyRows, 400)) await prisma.post.createMany({ data: part.map(mkPost) });
    for (const part of chunk([...platformReplyRows, ...platformCommentRows, ...platformRepostRows], 400)) await prisma.post.createMany({ data: part.map(mkPost) });
    for (const part of chunk([...likeRows, ...platformLikeRows], 800)) await prisma.postLike.createMany({ data: part });
    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });
    // Replies-to-replies: bump the seeded reply's replyCount so threads show correctly.
    for (const r of platformReplyRows) await prisma.post.update({ where: { id: r.replyToId }, data: { replyCount: { increment: 1 } } });
    for (const [id, b] of bump) {
      await prisma.post.update({ where: { id }, data: { likeCount: { increment: b.like }, replyCount: { increment: b.reply }, repostCount: { increment: b.repost } } });
    }
    // Seeded followees gain a follower; seeded followers of the platform account gain a "following".
    for (const f of followRows) {
      if (f.followeeId === P) await prisma.profile.update({ where: { userId: f.followerId }, data: { followingCount: { increment: 1 } } });
      else await prisma.profile.update({ where: { userId: f.followeeId }, data: { followerCount: { increment: 1 } } });
    }

    for (const { s, lines } of dmPlan) {
      const follows = followerSet.has(s.id);
      const start = Math.max(s.createdAt, oldest) + rand() * (now - Math.max(s.createdAt, oldest) - 2 * DAY);
      let t = start;
      const msgs = lines.map((line, i) => {
        t += between(2, 240) * MIN;
        return { id: randomUUID(), senderId: i % 2 === 0 ? s.id : P, body: line.replaceAll("{a}", s.first), createdAt: new Date(Math.min(t, now - MIN)) };
      });
      const last = msgs[msgs.length - 1];
      const conv = await prisma.conversation.create({
        data: {
          kind: "direct",
          createdBy: s.id,
          createdAt: msgs[0].createdAt,
          directKey: [s.id, P].sort().join(":"),
          lastMessageAt: last.createdAt,
          lastMessageSenderId: last.senderId,
          lastMessagePreview: encryptAtRest(last.body.length > 80 ? `${last.body.slice(0, 77)}...` : last.body),
          participants: { create: [{ userId: s.id, joinedAt: msgs[0].createdAt }, { userId: P, joinedAt: msgs[0].createdAt }] },
          requestState: { create: { status: follows ? "accepted" : "pending", initiatedBy: s.id } },
        },
      });
      await prisma.message.createMany({ data: msgs.map((m) => ({ id: m.id, conversationId: conv.id, senderId: m.senderId, body: encryptAtRest(m.body), createdAt: m.createdAt })) });
      // Sender of the last line has read everything. Where the seeded dot spoke last, the platform inbox shows it unread.
      await prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId: conv.id, userId: last.senderId } }, data: { lastReadMessageId: last.id } });
    }

    // Counters on the platform account (and any other non-seed account) come from the real rows.
    await recountNonSeed(prisma);

    const [followerCount, followingCount, unread] = await Promise.all([
      prisma.follow.count({ where: { followeeId: P, status: "accepted" } }),
      prisma.follow.count({ where: { followerId: P, status: "accepted" } }),
      prisma.notification.count({ where: { recipientId: P, readAt: null } }),
    ]);
    console.log(`Platform posts: ${newPlatformPosts} new (${platformPosts.length} total announcement posts).`);
    console.log(`Follows created: ${followRows.filter((f) => f.followeeId === P).length} seeded→@${handle}, ${followRows.filter((f) => f.followerId === P).length} @${handle}→seeded.`);
    console.log(`Seeded reactions on @${handle} posts: ${likeRows.length} likes, ${replyRows.length} replies (${platformReplyRows.length} answered by @${handle}).`);
    console.log(`@${handle} reactions on seeded posts: ${platformLikeRows.length} likes, ${platformCommentRows.length} comments, ${platformRepostRows.length} reposts.`);
    console.log(`DM threads to @${handle}: ${dmPlan.length}. Notifications created: ${notifs.length}.`);
    console.log(`@${handle} now has ${followerCount} followers, follows ${followingCount}, ${unread} unread notifications.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
