import bcrypt from "bcryptjs";
import { createCipheriv, randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { validateUsernameFormat } from "../src/lib/reserved-usernames";
import { PALETTES, avatarSvg, coverSvg } from "./seed-dots-art";
import { cleanupBeforeSeedDelete, recountNonSeed } from "./seed-dots-cleanup";
import { PEOPLE, ROLES, GENERIC_POSTS, REPLIES, DM_SCRIPTS, type RoleKey } from "./seed-dots-data";

// Seeds 99 realistic Indian "dots" (0dot users) with polished profiles, then
// makes them interact with each other: a follow graph with a few popular
// accounts, posts, likes, threaded replies, @mentions, reposts, bookmarks,
// skill endorsements, notifications and encrypted DMs.
//
// Every account uses the @seed.0dot.local email domain (same as
// seed-users.ts), so `scripts/delete-seed-users.ts` removes all of it —
// cascades take posts/follows/likes/messages/notifications with them.
//
// Local only: refuses any non-file: DATABASE_URL unless ALLOW_REMOTE=1.
//
// Usage: npx tsx scripts/seed-dots.ts            (fails if seeded dots already exist)
//        RESET=1 npx tsx scripts/seed-dots.ts     (wipe seeded dots first, then reseed)
//        SEED=42 npx tsx scripts/seed-dots.ts     (different, still reproducible, random layout)

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fall back to defaults below
}

const SEED_EMAIL_DOMAIN = "seed.0dot.local";
const SEED_PASSWORD = "SeedUser!2026";
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

// ---------- deterministic RNG ----------
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
const rand = mulberry32(Number(process.env.SEED ?? 2026));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;

// Efraimidis–Spirakis weighted sampling without replacement.
function sampleWeighted(count: number, weights: number[]): number[] {
  return weights
    .map((w, i) => ({ i, key: w > 0 ? Math.pow(rand(), 1 / w) : -1 }))
    .filter((x) => x.key >= 0)
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map((x) => x.i);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function encryptAtRest(plaintext: string): string {
  const key = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY ?? "", "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

type Dot = {
  idx: number;
  id: string;
  profileId: string;
  handle: string;
  first: string;
  displayName: string;
  role: RoleKey;
  city: string;
  createdAt: Date;
  pop: number;
  skillIds: string[];
};

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (PEOPLE.length !== 99) throw new Error(`Expected 99 people, have ${PEOPLE.length}`);
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  console.log(`Seeding dots at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const canEncrypt = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY ?? "", "base64").length === 32;

  try {
    const existing = await prisma.user.count({ where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } });
    if (existing > 0) {
      if (process.env.RESET !== "1") {
        throw new Error(`${existing} seeded dots already exist. Re-run with RESET=1 to wipe and reseed them.`);
      }
      await cleanupBeforeSeedDelete(prisma);
      const { count } = await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } });
      await recountNonSeed(prisma);
      console.log(`RESET: removed ${count} previously seeded dots.`);
    }

    const takenHandles = new Set((await prisma.username.findMany({ select: { handle: true } })).map((u) => u.handle));
    const takenPhones = new Set(
      (await prisma.user.findMany({ where: { phone: { not: null } }, select: { phone: true } })).map((u) => u.phone as string),
    );
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
    const now = Date.now();

    mkdirSync("public/uploads", { recursive: true });

    // ================= 1. Users + profiles =================
    const dots: Dot[] = [];
    const rankOrder = sampleWeighted(PEOPLE.length, PEOPLE.map(() => 1)); // random popularity ranking
    const popByIdx = new Map<number, number>();
    rankOrder.forEach((personIdx, rank) => popByIdx.set(personIdx, Math.pow(1 / (rank + 1), 0.55)));
    const verifiedIdx = new Set(rankOrder.slice(0, 8));

    for (let i = 0; i < PEOPLE.length; i++) {
      const [first, last, , city, role] = PEOPLE[i];
      const persona = ROLES[role];
      const ascii = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
      const base = ascii(first);
      const lastI = ascii(last)[0] ?? "x";
      const candidates = [base, `${base}_${lastI}`, `${base}_${ascii(last)}`, `${base}_${lastI}${between(10, 99)}`];
      const handle = candidates.find((c) => validateUsernameFormat(c) === null && !takenHandles.has(c));
      if (!handle) throw new Error(`No valid handle for ${first} ${last}`);
      takenHandles.add(handle);

      let phone = "";
      do phone = `+91${between(6, 9)}${String(int(1e9)).padStart(9, "0")}`;
      while (takenPhones.has(phone));
      takenPhones.add(phone);

      const isStudent = role === "student";
      const age = isStudent ? between(19, 24) : between(25, 46);
      const dob = new Date(now - age * 365.25 * DAY - int(300) * DAY);
      const createdAt = new Date(now - between(30, 75) * DAY - int(DAY));

      const displayName = `${first} ${last}`;
      const title = pick(persona.titles);
      const company = persona.companies[0];
      const employer = company === "Freelance" ? `${title.toLowerCase()} (freelance)` : `${title} at ${company}`;
      const bio = company === "Freelance"
        ? `${title[0].toUpperCase()}${title.slice(1)}, freelance · 📍 ${city}. ${pick(persona.taglines)}`
        : `${employer} · 📍 ${city}. ${pick(persona.taglines)}`;

      const palette = PALETTES[(i * 5 + int(3)) % PALETTES.length];
      const initials = `${first[0]}${last[0]}`.toUpperCase();
      writeFileSync(`public/uploads/dot-${handle}.svg`, avatarSvg(initials, palette, i));
      writeFileSync(
        `public/uploads/dot-${handle}-cover.svg`,
        coverSvg(PALETTES[(i * 7 + 3) % PALETTES.length], i + 1),
      );

      // Work history: current role + one earlier stint. Students get no work entry.
      const currentStart = new Date(now - between(1, 6) * 365 * DAY);
      const prevEnd = new Date(currentStart.getTime() - between(10, 60) * DAY);
      const prevStart = new Date(prevEnd.getTime() - between(1, 3) * 365 * DAY);
      const workDescs = [
        "Working closely with a small, passionate team on things people actually use.",
        "Owned projects end-to-end, from the first sketch to the final launch.",
        "Learned a lot, shipped a lot, and made some great friends along the way.",
      ];
      const skills = [...persona.skills].sort(() => rand() - 0.5).slice(0, between(4, 6));
      const skillRows = skills.map((name, position) => ({ id: randomUUID(), name, position }));

      const eduStart = new Date(dob.getTime() + between(18, 19) * 365.25 * DAY);
      const eduEnd = isStudent ? null : new Date(eduStart.getTime() + between(3, 5) * 365.25 * DAY);

      const created = await prisma.user.create({
        data: {
          email: `${handle}@${SEED_EMAIL_DOMAIN}`,
          phone,
          passwordHash,
          status: "active",
          emailVerifiedAt: createdAt,
          dateOfBirth: dob,
          createdAt,
          lastActiveAt: new Date(now - int(3 * DAY)),
          username: { create: { handle, claimedAt: createdAt } },
          profile: {
            create: {
              displayName,
              bio,
              avatarUrl: `/uploads/dot-${handle}.svg`,
              coverUrl: `/uploads/dot-${handle}-cover.svg`,
              themePreset: pick(persona.themes),
              isVerified: verifiedIdx.has(i),
              createdAt,
              skills: { create: skillRows },
              workExperiences: isStudent
                ? undefined
                : {
                    create: [
                      { company, title, location: city, startDate: currentStart, endDate: null, description: pick(workDescs), position: 0 },
                      { company: persona.companies[1], title: pick(persona.titles), location: city, startDate: prevStart, endDate: prevEnd, description: pick(workDescs), position: 1 },
                    ],
                  },
              education: {
                create: [
                  { institution: pick(persona.institutions), degree: persona.degree, fieldOfStudy: persona.field, startDate: eduStart, endDate: eduEnd, position: 0 },
                ],
              },
            },
          },
        },
        include: { profile: { select: { id: true } } },
      });

      dots.push({
        idx: i,
        id: created.id,
        profileId: created.profile!.id,
        handle,
        first,
        displayName,
        role,
        city,
        createdAt,
        pop: popByIdx.get(i)!,
        skillIds: skillRows.map((s) => s.id),
      });
    }
    console.log(`Created ${dots.length} dots with profiles, avatars, covers, skills, work + education.`);

    const meanPop = dots.reduce((s, d) => s + d.pop, 0) / dots.length;
    const popRel = (d: Dot) => d.pop / meanPop;
    const N = dots.length;

    // ================= 2. Follow graph =================
    // Weighted by popularity, with homophily: same role and same city are likelier.
    const following: Set<number>[] = dots.map(() => new Set());
    const followedBy: Set<number>[] = dots.map(() => new Set());
    const followAt = new Map<string, number>();
    const addFollow = (a: number, b: number) => {
      if (a === b || following[a].has(b)) return;
      following[a].add(b);
      followedBy[b].add(a);
      const lo = Math.max(dots[a].createdAt.getTime(), dots[b].createdAt.getTime());
      followAt.set(`${a}:${b}`, lo + rand() * (now - 2 * MIN - lo));
    };
    for (const a of dots) {
      const weights = dots.map((b) =>
        b.idx === a.idx ? 0 : b.pop * (b.role === a.role ? 2.5 : 1) * (b.city === a.city ? 3 : 1),
      );
      for (const b of sampleWeighted(between(8, 34), weights)) {
        addFollow(a.idx, b);
        if (chance(0.38)) addFollow(b, a.idx); // follow-back
      }
    }
    for (const d of dots) {
      // Nobody left with zero followers.
      while (followedBy[d.idx].size < 2) addFollow(int(N), d.idx);
    }
    const followRows: { followerId: string; followeeId: string; status: string; createdAt: Date }[] = [];
    for (const [key, at] of followAt) {
      const [a, b] = key.split(":").map(Number);
      followRows.push({ followerId: dots[a].id, followeeId: dots[b].id, status: "accepted", createdAt: new Date(at) });
    }
    for (const part of chunk(followRows, 500)) await prisma.follow.createMany({ data: part });
    await Promise.all(
      dots.map((d) =>
        prisma.profile.update({
          where: { userId: d.id },
          data: { followerCount: followedBy[d.idx].size, followingCount: following[d.idx].size },
        }),
      ),
    );
    let mutualPairs = 0;
    for (const d of dots) for (const b of following[d.idx]) if (b > d.idx && following[b].has(d.idx)) mutualPairs++;
    console.log(`Created ${followRows.length} follow edges (${mutualPairs} mutual pairs).`);

    // ================= 3. Posts =================
    type PostRow = {
      id: string; authorId: string; body: string; createdAt: Date;
      likeCount: number; replyCount: number; repostCount: number; trendingScore: number;
      replyToId?: string | null; repostOfId?: string | null;
    };
    type NotifRow = { recipientId: string; actorId: string; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null };

    const posts: PostRow[] = [];
    const postAuthorIdx = new Map<string, number>();
    const notifs: NotifRow[] = [];
    const likes: { postId: string; userId: string; createdAt: Date }[] = [];
    const bookmarks: { postId: string; userId: string; createdAt: Date }[] = [];
    const usedTexts = new Set<string>();
    const rolePools = new Map<RoleKey, string[]>();

    const uniqueBody = (d: Dot): string => {
      const pool = rolePools.get(d.role) ?? [...ROLES[d.role].posts].sort(() => rand() - 0.5);
      rolePools.set(d.role, pool);
      let body: string | undefined;
      // Prefer a role-specific post; fall back to a generic one once the role pool is spent.
      if (pool.length > 0 && chance(0.72)) body = pool.pop();
      for (let attempt = 0; !body && attempt < 20; attempt++) {
        const t = pick(GENERIC_POSTS).replaceAll("{city}", d.city);
        if (!usedTexts.has(t)) body = t;
      }
      body ??= pick(GENERIC_POSTS).replaceAll("{city}", d.city);
      usedTexts.add(body);
      if (chance(0.18)) body += ` #${d.city.toLowerCase().replace(/[^a-z]/g, "")}`;
      return body.length > 500 ? body.slice(0, 500) : body;
    };

    const markRead = (at: Date) => (chance(0.55) ? new Date(at.getTime() + between(5, 600) * MIN) : null);
    const later = (from: number, maxDays: number) => new Date(Math.min(now - MIN, from + rand() * maxDays * DAY + 3 * MIN));

    for (const d of dots) {
      const n = between(2, 3) + (popRel(d) > 2 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const ageDays = 21 * (1 - Math.pow(rand(), 1.4)); // skew toward recent
        const createdAt = new Date(now - ageDays * DAY - int(DAY / 2));
        const id = randomUUID();
        posts.push({ id, authorId: d.id, body: uniqueBody(d), createdAt, likeCount: 0, replyCount: 0, repostCount: 0, trendingScore: 0 });
        postAuthorIdx.set(id, d.idx);
      }
    }
    const originals = [...posts];

    // ================= 4. Likes, replies, mentions, reposts, bookmarks =================
    const interactorWeights = (author: Dot) =>
      dots.map((u) =>
        u.idx === author.idx
          ? 0
          : 1 * (followedBy[author.idx].has(u.idx) ? 8 : 1) * (u.role === author.role ? 2 : 1) * (u.city === author.city ? 2 : 1),
      );

    const nestedThanks = ["Thank you! 🙏", "Glad you liked it!", "Haha exactly!", "Appreciate it 😊", "Means a lot, thanks!", "Thanks for stopping by!"];
    const tagLines = ["you have to see this 👀", "this is so you 😄", "thought of you when I read this", "check this out!"];

    for (const p of originals) {
      const author = dots[postAuthorIdx.get(p.id)!];
      const w = interactorWeights(author);

      // likes
      const likeN = Math.min(N - 1, Math.floor(popRel(author) * (2 + rand() * 9)));
      for (const u of sampleWeighted(likeN, w)) {
        const at = later(p.createdAt.getTime(), 5);
        likes.push({ postId: p.id, userId: dots[u].id, createdAt: at });
        notifs.push({ recipientId: author.id, actorId: dots[u].id, type: "like", subjectType: "post", subjectId: p.id, createdAt: at, readAt: markRead(at) });
      }
      p.likeCount = likeN;

      // replies (+ occasional author reply-back, occasional @tag)
      if (chance(0.45)) {
        const replyN = Math.min(5, 1 + int(1 + Math.ceil(popRel(author))));
        for (const u of sampleWeighted(replyN, w)) {
          const replier = dots[u];
          const at = later(p.createdAt.getTime(), 3);
          let body = pick(REPLIES);
          let tagged: Dot | null = null;
          if (chance(0.15)) {
            const tagIdx = sampleWeighted(1, dots.map((t) => (t.idx === replier.idx || t.idx === author.idx ? 0 : followedBy[replier.idx].has(t.idx) || following[replier.idx].has(t.idx) ? 5 : 1)))[0];
            tagged = dots[tagIdx];
            body = `@${tagged.handle} ${pick(tagLines)}`;
          }
          const replyId = randomUUID();
          posts.push({ id: replyId, authorId: replier.id, body, createdAt: at, likeCount: 0, replyCount: 0, repostCount: 0, trendingScore: 0, replyToId: p.id });
          p.replyCount++;
          notifs.push({ recipientId: author.id, actorId: replier.id, type: "comment", subjectType: "post", subjectId: p.id, createdAt: at, readAt: markRead(at) });
          if (tagged) notifs.push({ recipientId: tagged.id, actorId: replier.id, type: "mention", subjectType: "post", subjectId: replyId, createdAt: at, readAt: markRead(at) });

          if (chance(0.4)) {
            const backAt = later(at.getTime(), 1);
            const backId = randomUUID();
            posts.push({ id: backId, authorId: author.id, body: pick(nestedThanks), createdAt: backAt, likeCount: 0, replyCount: 0, repostCount: 0, trendingScore: 0, replyToId: replyId });
            const parent = posts.find((x) => x.id === replyId)!;
            parent.replyCount++;
            notifs.push({ recipientId: replier.id, actorId: author.id, type: "comment", subjectType: "post", subjectId: replyId, createdAt: backAt, readAt: markRead(backAt) });
          }
        }
      }

      // reposts (plain, plus the occasional quote)
      if (chance(0.18)) {
        for (const u of sampleWeighted(1 + int(3), w)) {
          const at = later(p.createdAt.getTime(), 4);
          const quote = chance(0.25);
          posts.push({ id: randomUUID(), authorId: dots[u].id, body: quote ? pick(REPLIES) : "", createdAt: at, likeCount: 0, replyCount: 0, repostCount: 0, trendingScore: 0, repostOfId: p.id });
          p.repostCount++;
        }
      }

      // bookmarks
      if (chance(0.12)) {
        for (const u of sampleWeighted(1 + int(2), w)) bookmarks.push({ postId: p.id, userId: dots[u].id, createdAt: later(p.createdAt.getTime(), 4) });
      }

      const ageD = Math.max(0, (now - p.createdAt.getTime()) / DAY);
      p.trendingScore = (p.likeCount + 2 * p.replyCount + 3 * p.repostCount) / Math.pow(1 + ageD, 1.2);
    }

    // new_follower notifications, mirroring followUser()
    for (const [key, at] of followAt) {
      const [a, b] = key.split(":").map(Number);
      const when = new Date(at);
      notifs.push({ recipientId: dots[b].id, actorId: dots[a].id, type: "new_follower", subjectType: "user", subjectId: dots[a].id, createdAt: when, readAt: markRead(when) });
    }

    // skill endorsements (+ their like/skill notifications)
    const endorsements: { skillId: string; endorserId: string; createdAt: Date }[] = [];
    const skillCounts = new Map<string, number>();
    for (const d of dots) {
      const w = dots.map((u) => (u.idx === d.idx ? 0 : (followedBy[d.idx].has(u.idx) ? 6 : 1) * (u.role === d.role ? 3 : 1)));
      for (const skillId of d.skillIds) {
        if (!chance(0.55)) continue;
        for (const u of sampleWeighted(between(1, 4), w)) {
          const at = new Date(now - rand() * 30 * DAY);
          endorsements.push({ skillId, endorserId: dots[u].id, createdAt: at });
          skillCounts.set(skillId, (skillCounts.get(skillId) ?? 0) + 1);
          notifs.push({ recipientId: d.id, actorId: dots[u].id, type: "like", subjectType: "skill", subjectId: skillId, createdAt: at, readAt: markRead(at) });
        }
      }
    }

    // ---- write it all ----
    // Parents must exist before replies/reposts that reference them (self-relation FKs).
    const topLevel = posts.filter((p) => !p.replyToId && !p.repostOfId);
    const dependents = posts.filter((p) => p.replyToId || p.repostOfId);
    const replyLevel1 = dependents.filter((p) => !p.repostOfId && topLevel.some((t) => t.id === p.replyToId));
    const replyLevel1Ids = new Set(replyLevel1.map((p) => p.id));
    const rest = dependents.filter((p) => !replyLevel1Ids.has(p.id));
    const toData = (p: PostRow) => ({
      id: p.id, authorId: p.authorId, body: p.body, createdAt: p.createdAt,
      likeCount: p.likeCount, replyCount: p.replyCount, repostCount: p.repostCount, trendingScore: p.trendingScore,
      replyToId: p.replyToId ?? null, repostOfId: p.repostOfId ?? null,
    });
    for (const batch of [topLevel, replyLevel1, rest]) {
      for (const part of chunk(batch, 400)) await prisma.post.createMany({ data: part.map(toData) });
    }
    for (const part of chunk(likes, 800)) await prisma.postLike.createMany({ data: part });
    for (const part of chunk(bookmarks, 800)) await prisma.bookmark.createMany({ data: part });
    for (const part of chunk(endorsements, 800)) await prisma.skillEndorsement.createMany({ data: part });
    await Promise.all(
      [...skillCounts].map(([id, endorsementCount]) => prisma.skill.update({ where: { id }, data: { endorsementCount } })),
    );
    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });
    console.log(
      `Created ${topLevel.length} posts, ${posts.filter((p) => p.replyToId).length} replies, ${posts.filter((p) => p.repostOfId).length} reposts, ` +
        `${likes.length} likes, ${bookmarks.length} bookmarks, ${endorsements.length} skill endorsements, ${notifs.length} notifications.`,
    );

    // ================= 5. Direct messages =================
    if (!canEncrypt) {
      console.log("Skipping DMs: MESSAGE_ENCRYPTION_KEY missing/invalid in .env.local.");
    } else {
      const mutual: [number, number][] = [];
      for (const a of dots) for (const b of following[a.idx]) if (b > a.idx && following[b].has(a.idx)) mutual.push([a.idx, b]);
      const pairWeights = mutual.map(([a, b]) => dots[a].pop * dots[b].pop);
      const chosen = sampleWeighted(Math.min(40, mutual.length), pairWeights).map((i) => mutual[i]);
      let msgCount = 0;
      for (const [x, y] of chosen) {
        const [a, b] = chance(0.5) ? [dots[x], dots[y]] : [dots[y], dots[x]];
        const script = pick(DM_SCRIPTS);
        const start = Math.max(a.createdAt.getTime(), b.createdAt.getTime(), followAt.get(`${a.idx}:${b.idx}`) ?? 0, followAt.get(`${b.idx}:${a.idx}`) ?? 0);
        let t = start + rand() * Math.max(1, now - start - 2 * DAY);
        const msgs = script.map((line, i) => {
          t += between(1, 40) * MIN;
          return { id: randomUUID(), senderId: i % 2 === 0 ? a.id : b.id, body: line.replaceAll("{a}", a.first).replaceAll("{b}", b.first), createdAt: new Date(Math.min(t, now - MIN)) };
        });
        const last = msgs[msgs.length - 1];
        const conv = await prisma.conversation.create({
          data: {
            kind: "direct",
            createdBy: a.id,
            createdAt: msgs[0].createdAt,
            directKey: [a.id, b.id].sort().join(":"),
            lastMessageAt: last.createdAt,
            lastMessageSenderId: last.senderId,
            lastMessagePreview: encryptAtRest(last.body.length > 80 ? `${last.body.slice(0, 77)}...` : last.body),
            participants: { create: [{ userId: a.id, joinedAt: msgs[0].createdAt }, { userId: b.id, joinedAt: msgs[0].createdAt }] },
            requestState: { create: { status: "accepted", initiatedBy: a.id } },
          },
        });
        await prisma.message.createMany({
          data: msgs.map((m) => ({ id: m.id, conversationId: conv.id, senderId: m.senderId, body: encryptAtRest(m.body), createdAt: m.createdAt })),
        });
        // The sender of the last line has read everything; the other side reads it 60% of the time.
        await prisma.conversationParticipant.update({
          where: { conversationId_userId: { conversationId: conv.id, userId: last.senderId } },
          data: { lastReadMessageId: last.id },
        });
        if (chance(0.6)) {
          const other = last.senderId === a.id ? b.id : a.id;
          await prisma.conversationParticipant.update({
            where: { conversationId_userId: { conversationId: conv.id, userId: other } },
            data: { lastReadMessageId: last.id },
          });
        }
        msgCount += msgs.length;
      }
      console.log(`Created ${chosen.length} DM conversations (${msgCount} encrypted messages).`);
    }

    // ================= Summary =================
    const top = [...dots].sort((a, b) => followedBy[b.idx].size - followedBy[a.idx].size).slice(0, 6);
    console.log("\nMost-followed dots:");
    for (const d of top) console.log(`  @${d.handle.padEnd(12)} ${d.displayName.padEnd(22)} ${followedBy[d.idx].size} followers`);
    console.log(`\nLog in as any of them, e.g. ${dots[0].handle}@${SEED_EMAIL_DOMAIN}, password: ${SEED_PASSWORD}`);
    console.log(`Cleanup: DATABASE_URL="${url}" npx tsx scripts/delete-seed-users.ts`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
