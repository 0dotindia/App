import { randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { validateArticleSlugFormat } from "../src/lib/reserved-article-slugs";
import { PALETTES, avatarSvg } from "./seed-dots-art";
import { SEED_EMAIL_DOMAIN, cleanupSeedContentReactions } from "./seed-dots-cleanup";
import { PEOPLE, type RoleKey } from "./seed-dots-data";
import { ARTICLES, ARTICLE_COMMENTS, BOOKS, CHAT_LINES, COMMUNITY_WIKI, NEWSLETTERS, WIKI, articleBody } from "./seed-dots-content-data";
import { COURSES, FILES, LIVESTREAMS, PODCASTS } from "./seed-dots-media-data";

// Fills the Content section for the seeded dots (seed-dots.ts): articles/tutorials/notes for
// all 99 (with tags, likes, comments), books with chapters, profile and community wiki pages,
// newsletters with sent issues and subscribers, courses (text lessons, learners, progress,
// learning paths), podcasts with episodes, livestreams (ended with chat, and upcoming) and
// downloadable files. The platform account (@dot) likes/comments, subscribes to newsletters.
// Run seed-dots.ts (and ideally seed-dots-orgs.ts) first.
//
// Limits (by design): podcast episodes and course lessons are metadata/text only. Protected
// audio/video uploads live in Vercel Blob, so episodes have placeholder keys and won't play,
// livestreams use the stub provider (no real stream), and lessons are text-only.
//
// Everything belongs to seeded accounts, so delete-seed-users.ts removes it through cascades.
// Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-content.ts          (articles per user; other sections skip if seeded)
//        RESET=1 npx tsx scripts/seed-dots-content.ts   (wipe seeded content first, then reseed)
//        SEED=8 PLATFORM_HANDLE=dot npx tsx scripts/seed-dots-content.ts

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

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
const rand = mulberry32(Number(process.env.SEED ?? 8));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T,>(arr: readonly T[]): T[] => [...arr].sort(() => rand() - 0.5);
const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const snake = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

type Dot = { id: string; createdAt: number; handle: string; profileId: string; name: string; first: string; role: RoleKey };

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  console.log(`Seeding content at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const now = Date.now();
  const seedUser = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };

  try {
    // ---------- RESET ----------
    if (process.env.RESET === "1") {
      await cleanupSeedContentReactions(prisma);
      const owned = { creator: seedUser };
      const slugs = (await prisma.article.findMany({ where: { author: seedUser }, select: { slug: true, author: { select: { username: { select: { handle: true } } } } } })).map((a) => `/${a.author.username?.handle}/articles/${a.slug}`);
      await prisma.notification.deleteMany({ where: { subjectType: "article", subjectId: { in: slugs } } });
      const r = await Promise.all([
        prisma.article.deleteMany({ where: { author: seedUser } }),
        prisma.wikiPage.deleteMany({ where: { OR: [{ profile: { user: seedUser } }, { community: { creator: seedUser } }] } }),
        prisma.book.deleteMany({ where: { profile: { user: seedUser } } }),
        prisma.publishedFile.deleteMany({ where: { profile: { user: seedUser } } }),
        prisma.learningPath.deleteMany({ where: owned }),
        prisma.course.deleteMany({ where: owned }),
        prisma.podcast.deleteMany({ where: owned }),
        prisma.livestream.deleteMany({ where: owned }),
        prisma.newsletterIssue.deleteMany({ where: owned }),
        prisma.newsletterSubscription.deleteMany({ where: owned }),
      ]);
      console.log(`RESET: removed ${r[0].count} articles, ${r[1].count} wiki pages, ${r[2].count} books, ${r[3].count} files, ${r[4].count} learning paths, ${r[5].count} courses, ${r[6].count} podcasts, ${r[7].count} livestreams, ${r[8].count} newsletter issues.`);
    }

    // ---------- people ----------
    const roleByName = new Map(PEOPLE.map(([first, last, , , role]) => [`${first} ${last}`, role]));
    const users = await prisma.user.findMany({
      where: seedUser,
      select: { id: true, createdAt: true, username: { select: { handle: true } }, profile: { select: { id: true, displayName: true } } },
    });
    if (users.length === 0) throw new Error("No seeded dots found. Run scripts/seed-dots.ts first.");
    const dots: Dot[] = users.map((u) => ({
      id: u.id, createdAt: u.createdAt.getTime(), handle: u.username!.handle, profileId: u.profile!.id,
      name: u.profile!.displayName, first: u.profile!.displayName.split(" ")[0], role: roleByName.get(u.profile!.displayName)!,
    }));
    if (dots.some((d) => !d.role)) throw new Error("Some dots have no role match. Did seed-dots-data.ts change?");
    const byRole = (role: RoleKey) => shuffle(dots.filter((d) => d.role === role));
    const others = (d: Dot) => dots.filter((o) => o.id !== d.id);
    const createdAfter = (d: Dot, days: [number, number]) => new Date(Math.min(now - 2 * DAY, d.createdAt + between(days[0], days[1]) * DAY));
    const after = (from: number, maxDays: number) => new Date(Math.min(now - MIN, from + 3 * MIN + rand() * maxDays * DAY));

    type NotifRow = { recipientId: string; actorId: string; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null };
    const notifs: NotifRow[] = [];
    const readMaybe = (at: Date) => (chance(0.55) ? new Date(at.getTime() + between(5, 600) * MIN) : null);
    type ReactionRow = { subjectType: string; subjectId: string; userId: string; kind: string; createdAt: Date };
    type CommentRow = { subjectType: string; subjectId: string; authorId: string; body: string; createdAt: Date };
    const reactions: ReactionRow[] = [];
    const comments: CommentRow[] = [];
    const addReactions = (subjectType: string, subjectId: string, owner: Dot, from: number, count: number, path?: string) => {
      const likers = shuffle(others(owner)).slice(0, count);
      likers.forEach((o, i) => {
        const at = after(from, 30);
        reactions.push({ subjectType, subjectId, userId: o.id, kind: "like", createdAt: at });
        if (path && i < 4) notifs.push({ recipientId: owner.id, actorId: o.id, type: "like", subjectType, subjectId: path, createdAt: at, readAt: readMaybe(at) });
      });
      return likers.length;
    };
    const addComments = (subjectType: string, subjectId: string, owner: Dot, from: number, count: number, path?: string) => {
      const authors = shuffle(others(owner)).slice(0, count);
      authors.forEach((o) => {
        const at = after(from, 30);
        comments.push({ subjectType, subjectId, authorId: o.id, body: pick(ARTICLE_COMMENTS), createdAt: at });
        if (path) notifs.push({ recipientId: owner.id, actorId: o.id, type: "comment", subjectType, subjectId: path, createdAt: at, readAt: readMaybe(at) });
      });
      return authors.length;
    };
    const totals: Record<string, number> = {};
    const tally = (k: string, n = 1) => (totals[k] = (totals[k] ?? 0) + n);
    mkdirSync("public/uploads", { recursive: true });

    // ================= Articles =================
    const hasArticle = new Set((await prisma.article.findMany({ where: { author: seedUser }, select: { authorId: true }, distinct: ["authorId"] })).map((a) => a.authorId));
    const articleRows: Record<string, unknown>[] = [];
    const tagLinks: { articleId: string; tag: string }[] = [];
    for (const d of dots) {
      if (hasArticle.has(d.id)) continue;
      const picks = shuffle(ARTICLES[d.role]).slice(0, between(1, 3));
      for (const [i, [title, subtitle, format, tags, intro, points, closing]] of picks.entries()) {
        const slug = snake(title).slice(0, 80);
        if (validateArticleSlugFormat(slug) !== null) throw new Error(`Bad article slug: ${slug}`);
        const body = articleBody(format, intro, points, closing);
        const draft = i === picks.length - 1 && picks.length > 1 && chance(0.12);
        const createdAt = createdAfter(d, [2, 30]);
        const publishedAt = draft ? null : after(createdAt.getTime(), 40);
        const id = randomUUID();
        const likeCount = draft ? 0 : addReactions("article", id, d, publishedAt!.getTime(), between(2, 25), `/${d.handle}/articles/${slug}`);
        const commentCount = draft ? 0 : addComments("article", id, d, publishedAt!.getTime(), chance(0.65) ? between(1, 3) : 0, `/${d.handle}/articles/${slug}`);
        articleRows.push({
          id, authorId: d.id, slug, title, subtitle, format, body,
          status: draft ? "draft" : "published", visibility: "public",
          readingTimeMinutes: draft ? 0 : Math.max(1, Math.ceil(words(body) / 200)),
          likeCount, commentCount, viewCount: draft ? 0 : likeCount * between(8, 40) + between(20, 400),
          publishedAt, createdAt, updatedAt: publishedAt ?? createdAt,
        });
        tags.forEach((tag) => tagLinks.push({ articleId: id, tag }));
      }
    }
    if (articleRows.length) {
      await prisma.article.createMany({ data: articleRows as never });
      const tagIds = new Map<string, string>();
      for (const tag of new Set(tagLinks.map((t) => t.tag))) {
        tagIds.set(tag, (await prisma.hashtag.upsert({ where: { name: tag }, update: {}, create: { name: tag }, select: { id: true } })).id);
      }
      await prisma.articleHashtag.createMany({ data: tagLinks.map((t) => ({ articleId: t.articleId, hashtagId: tagIds.get(t.tag)! })) });
    }
    tally("articles", articleRows.length);

    // ================= Books =================
    const bookCount = await prisma.book.count({ where: { profile: { user: seedUser } } });
    if (bookCount === 0) {
      const used = new Set<string>();
      for (const spec of BOOKS) {
        const owners = spec.roles.flatMap((r) => byRole(r)).filter((d) => !used.has(d.id)).slice(0, 2);
        for (const owner of owners) {
          used.add(owner.id);
          const createdAt = createdAfter(owner, [5, 30]);
          const book = await prisma.book.create({ data: { profileId: owner.profileId, slug: spec.slug, title: spec.title, description: spec.description, status: "published", visibility: "public", createdAt } });
          for (const [pos, [title, text]] of spec.chapters.entries()) {
            const page = await prisma.wikiPage.create({ data: { bookId: book.id, slug: snake(title).slice(0, 60), title, kind: "book_chapter", position: pos, createdAt } });
            const rev = await prisma.wikiRevision.create({ data: { wikiPageId: page.id, body: `# ${title}\n\n${text}`, editedBy: owner.id, createdAt } });
            await prisma.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: rev.id } });
            tally("chapters");
          }
          const likeCount = addReactions("book", book.id, owner, createdAt.getTime(), between(2, 20));
          const commentCount = addComments("book", book.id, owner, createdAt.getTime(), between(0, 3));
          await prisma.book.update({ where: { id: book.id }, data: { likeCount, commentCount } });
          tally("books");
        }
      }
    }

    // ================= Wiki pages (profile + community) =================
    const wikiCount = await prisma.wikiPage.count({ where: { OR: [{ profile: { user: seedUser } }, { community: { creator: seedUser } }] } });
    if (wikiCount === 0) {
      const makePage = async (scope: { profileId: string } | { communityId: string }, title: string, body: string, kind: string, editor: string, position: number, parentPageId: string | null, createdAt: Date) => {
        const page = await prisma.wikiPage.create({ data: { ...scope, slug: snake(title).slice(0, 60), title, kind, position, parentPageId, createdAt } });
        const rev = await prisma.wikiRevision.create({ data: { wikiPageId: page.id, body: `# ${title}\n\n${body}`, editedBy: editor, createdAt } });
        await prisma.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: rev.id } });
        tally("wikiPages");
        return page.id;
      };
      for (const [role, spec] of Object.entries(WIKI) as [RoleKey, NonNullable<(typeof WIKI)[RoleKey]>][]) {
        for (const d of byRole(role).slice(0, 2)) {
          const createdAt = createdAfter(d, [5, 40]);
          const rootId = await makePage({ profileId: d.profileId }, spec.root[0], spec.root[1], "documentation", d.id, 0, null, createdAt);
          await makePage({ profileId: d.profileId }, spec.child[0], spec.child[1], "documentation", d.id, 0, rootId, createdAt);
        }
      }
      for (const cw of COMMUNITY_WIKI) {
        const community = await prisma.community.findUnique({ where: { slug: cw.slug }, select: { id: true, createdBy: true, createdAt: true } });
        if (!community) continue;
        for (const [pos, [title, body]] of cw.pages.entries()) await makePage({ communityId: community.id }, title, body, "wiki", community.createdBy, pos, null, new Date(community.createdAt.getTime() + DAY));
      }
    }

    // ================= Newsletters =================
    if ((await prisma.newsletterIssue.count({ where: { creator: seedUser } })) === 0) {
      for (const [role, spec] of Object.entries(NEWSLETTERS) as [RoleKey, NonNullable<(typeof NEWSLETTERS)[RoleKey]>][]) {
        const perRole = ["writer", "founder", "finance", "marketing", "pm"].includes(role) ? 2 : 1;
        for (const d of byRole(role).slice(0, perRole)) {
          for (const [i, [subject, blurb, bullets]] of spec.issues.entries()) {
            const sentAt = new Date(Math.max(d.createdAt + 3 * DAY, now - (spec.issues.length - i) * 7 * DAY - int(DAY)));
            await prisma.newsletterIssue.create({
              data: {
                creatorId: d.id, subject: `${spec.name}: ${subject}`,
                body: `Hi friends,\n\n${blurb}\n\n${bullets.map((b) => `- ${b}`).join("\n")}\n\nUntil next time,\n${d.first}`,
                status: "sent", sentAt, createdAt: new Date(sentAt.getTime() - DAY),
              },
            });
            tally("issues");
          }
          const subs = shuffle(others(d)).slice(0, between(10, 40));
          await prisma.newsletterSubscription.createMany({
            data: subs.map((s) => ({
              creatorId: d.id, subscriberUserId: s.id, subscriberEmail: `${s.handle}@${SEED_EMAIL_DOMAIN}`, unsubscribeToken: randomUUID(),
              subscribedAt: after(Math.max(d.createdAt, s.createdAt), 40), unsubscribedAt: chance(0.08) ? after(now - 20 * DAY, 15) : null,
            })),
          });
          tally("subscribers", subs.length);
        }
      }
    }

    // ================= Courses (+ learners, progress, learning paths) =================
    if ((await prisma.course.count({ where: { creator: seedUser } })) === 0) {
      const pathTitles: Partial<Record<RoleKey, string>> = { swe: "Become a Backend Developer", data: "From Analyst to ML Practitioner", teacher: "The Confident Teacher Path", fitness: "Move Well, Get Strong" };
      for (const [role, templates] of Object.entries(COURSES) as [RoleKey, NonNullable<(typeof COURSES)[RoleKey]>][]) {
        const creator = byRole(role)[0];
        const courseIds: string[] = [];
        for (const t of templates) {
          const createdAt = createdAfter(creator, [5, 30]);
          const course = await prisma.course.create({
            data: {
              creatorId: creator.id, title: t.title, description: t.description, price: t.price, currency: "INR", status: "active", createdAt,
              modules: { create: t.modules.map(([title, lessons], mi) => ({ title, position: mi, lessons: { create: lessons.map(([lt, body], li) => ({ title: lt, position: li, contentType: "text", body })) } })) },
            },
            select: { id: true, modules: { select: { lessons: { select: { id: true } } } } },
          });
          courseIds.push(course.id);
          tally("courses");
          const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
          tally("lessons", lessonIds.length);
          // Learners: local-only access grants (no payment record), with partial progress.
          const learners = shuffle(others(creator)).slice(0, between(3, 10));
          await prisma.courseAccessGrant.createMany({ data: learners.map((l) => ({ courseId: course.id, userId: l.id, grantedVia: "purchase", createdAt: after(createdAt.getTime(), 40) })) });
          const progress = learners.flatMap((l) => shuffle(lessonIds).slice(0, between(0, lessonIds.length)).map((lessonId) => ({ userId: l.id, lessonId, completedAt: after(createdAt.getTime(), 40) })));
          if (progress.length) await prisma.courseProgress.createMany({ data: progress });
          tally("learners", learners.length);
        }
        if (courseIds.length > 1 && pathTitles[role]) {
          await prisma.learningPath.create({ data: { creatorId: creator.id, title: pathTitles[role]!, courseIdsJson: JSON.stringify(courseIds), createdAt: new Date(now - between(3, 30) * DAY) } });
          tally("paths");
        }
      }
    }

    // ================= Podcasts =================
    if ((await prisma.podcast.count({ where: { creator: seedUser } })) === 0) {
      for (const [role, spec] of Object.entries(PODCASTS) as [RoleKey, NonNullable<(typeof PODCASTS)[RoleKey]>][]) {
        const creator = byRole(role)[0];
        const rssSlug = `${snake(spec.title).replace(/_/g, "-")}-${randomBytes(4).toString("hex")}`;
        writeFileSync(`public/uploads/podcast-${rssSlug}.svg`, avatarSvg(spec.title.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(), PALETTES[int(PALETTES.length)], int(3)));
        const createdAt = createdAfter(creator, [5, 25]);
        const podcast = await prisma.podcast.create({ data: { creatorId: creator.id, title: spec.title, description: spec.description, coverUrl: `/uploads/podcast-${rssSlug}.svg`, rssSlug, createdAt } });
        await prisma.podcastEpisode.createMany({
          data: spec.episodes.map(([title, description, durationS], i) => {
            const publishAt = new Date(Math.max(createdAt.getTime() + DAY, now - (spec.episodes.length - i) * 7 * DAY - int(2 * DAY)));
            return {
              podcastId: podcast.id, episodeNumber: i + 1, title, description, durationS,
              // Placeholder key in the protected-storage shape: the audio itself isn't seeded (Vercel Blob only).
              fileKey: `protected/${randomBytes(16).toString("hex")}.mp3`, fileMimeType: "audio/mpeg", fileSizeBytes: durationS * 16000,
              publishAt, createdAt: publishAt,
            };
          }),
        });
        tally("podcasts");
        tally("episodes", spec.episodes.length);
      }
    }

    // ================= Livestreams =================
    if ((await prisma.livestream.count({ where: { creator: seedUser } })) === 0) {
      for (const [role, [pastTitle, nextTitle]] of Object.entries(LIVESTREAMS) as [RoleKey, [string, string]][]) {
        const creator = byRole(role)[0];
        const id = randomUUID();
        const startedAt = new Date(now - between(3, 30) * DAY);
        await prisma.livestream.create({
          data: {
            id, creatorId: creator.id, title: pastTitle, status: "ended", scheduledAt: startedAt, startedAt, endedAt: new Date(startedAt.getTime() + between(40, 90) * MIN),
            ingestKey: `stub_ingest_${randomBytes(12).toString("hex")}`, playbackUrl: `/stub-playback/${id}`, createdAt: new Date(startedAt.getTime() - 2 * DAY),
          },
        });
        const chatters = shuffle(others(creator)).slice(0, between(4, 10));
        await prisma.livestreamChatMessage.createMany({
          data: chatters.flatMap((c) => Array.from({ length: between(1, 3) }, () => ({ livestreamId: id, senderId: c.id, body: pick(CHAT_LINES), createdAt: new Date(startedAt.getTime() + between(1, 40) * MIN) }))),
        });
        const nextId = randomUUID();
        await prisma.livestream.create({
          data: {
            id: nextId, creatorId: creator.id, title: nextTitle, status: "scheduled", scheduledAt: new Date(now + between(2, 14) * DAY + between(0, 12) * HOUR),
            ingestKey: `stub_ingest_${randomBytes(12).toString("hex")}`, playbackUrl: `/stub-playback/${nextId}`,
          },
        });
        tally("livestreams", 2);
      }
    }

    // ================= Published files =================
    if ((await prisma.publishedFile.count({ where: { profile: { user: seedUser } } })) === 0) {
      for (const [role, spec] of Object.entries(FILES) as [RoleKey, NonNullable<(typeof FILES)[RoleKey]>][]) {
        for (const owner of byRole(role).slice(0, 2)) {
          const fileName = `file-${owner.handle}-${spec.filename}`;
          writeFileSync(`public/uploads/${fileName}`, spec.content);
          const publishedAt = createdAfter(owner, [5, 40]);
          const file = await prisma.publishedFile.create({
            data: {
              profileId: owner.profileId, slug: snake(spec.title).slice(0, 60), title: spec.title, description: spec.description,
              fileUrl: `/uploads/${fileName}`, fileMimeType: spec.mime, fileSizeBytes: Buffer.byteLength(spec.content), visibility: "public",
              downloadCount: between(5, 300), publishedAt, createdAt: publishedAt,
            },
          });
          addReactions("published_file", file.id, owner, publishedAt.getTime(), between(2, 15));
          tally("files");
        }
      }
    }

    // ================= Platform account (@dot) =================
    const handle = (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase();
    const platform = await prisma.username.findUnique({ where: { handle }, select: { userId: true, user: { select: { email: true } } } });
    let dotLikes = 0;
    let dotComments = 0;
    let dotSubs = 0;
    if (platform && !platform.user.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) {
      const P = platform.userId;
      const [likedBefore, commentedBefore] = await Promise.all([
        prisma.reaction.count({ where: { userId: P, subjectType: "article" } }),
        prisma.comment.count({ where: { authorId: P, subjectType: "article", deletedAt: null } }),
      ]);
      const allArticles = await prisma.article.findMany({ where: { author: seedUser, status: "published" }, select: { id: true, slug: true, authorId: true, publishedAt: true, author: { select: { username: { select: { handle: true } } } } } });
      const already = new Set((await prisma.reaction.findMany({ where: { userId: P, subjectType: "article" }, select: { subjectId: true } })).map((r) => r.subjectId));
      const toLike = shuffle(allArticles).filter((a) => !already.has(a.id)).slice(0, Math.max(0, 40 - likedBefore));
      const commentCap = Math.max(0, 8 - commentedBefore);
      for (const [i, a] of toLike.entries()) {
        const path = `/${a.author.username?.handle}/articles/${a.slug}`;
        const at = after((a.publishedAt ?? new Date(now - 5 * DAY)).getTime(), 30);
        await prisma.reaction.create({ data: { subjectType: "article", subjectId: a.id, userId: P, kind: "like", createdAt: at } });
        let inc = 0;
        if (i < commentCap) {
          const cAt = after(at.getTime(), 2);
          await prisma.comment.create({ data: { subjectType: "article", subjectId: a.id, authorId: P, body: pick(["Thanks for sharing this with the community 🙏", "Really useful, thank you for writing it.", "Great read. Featuring articles like this in our thoughts today ✨", "Clear, practical and kind. Keep writing!"]), createdAt: cAt } });
          notifs.push({ recipientId: a.authorId, actorId: P, type: "comment", subjectType: "article", subjectId: path, createdAt: cAt, readAt: readMaybe(cAt) });
          inc = 1;
          dotComments++;
        }
        await prisma.article.update({ where: { id: a.id }, data: { likeCount: { increment: 1 }, commentCount: { increment: inc } } });
        notifs.push({ recipientId: a.authorId, actorId: P, type: "like", subjectType: "article", subjectId: path, createdAt: at, readAt: readMaybe(at) });
        dotLikes++;
      }
      // Book/file likes and newsletter subscriptions (top up to 4 / 4 / 6).
      const likedOther = new Set((await prisma.reaction.findMany({ where: { userId: P, subjectType: { in: ["book", "published_file"] } }, select: { subjectId: true } })).map((r) => r.subjectId));
      for (const [type, model] of [["book", "book"], ["published_file", "publishedFile"]] as const) {
        const rows = await (prisma[model] as unknown as { findMany: (a: unknown) => Promise<{ id: string }[]> }).findMany({ where: { profile: { user: seedUser } }, select: { id: true } });
        for (const r of shuffle(rows).filter((x) => !likedOther.has(x.id)).slice(0, 4 - [...likedOther].filter((id) => rows.some((x) => x.id === id)).length)) {
          await prisma.reaction.create({ data: { subjectType: type, subjectId: r.id, userId: P, kind: "like", createdAt: after(now - 20 * DAY, 15) } });
          if (type === "book") await prisma.book.update({ where: { id: r.id }, data: { likeCount: { increment: 1 } } });
          dotLikes++;
        }
      }
      const subscribedTo = new Set((await prisma.newsletterSubscription.findMany({ where: { subscriberUserId: P }, select: { creatorId: true } })).map((s) => s.creatorId));
      const creators = await prisma.newsletterIssue.findMany({ where: { creator: seedUser }, select: { creatorId: true }, distinct: ["creatorId"] });
      for (const c of shuffle(creators).filter((c) => !subscribedTo.has(c.creatorId)).slice(0, Math.max(0, 6 - subscribedTo.size))) {
        await prisma.newsletterSubscription.create({ data: { creatorId: c.creatorId, subscriberUserId: P, subscriberEmail: platform.user.email, unsubscribeToken: randomUUID(), subscribedAt: after(now - 25 * DAY, 20) } });
        notifs.push({ recipientId: c.creatorId, actorId: P, type: "new_subscriber", subjectType: "user", subjectId: P, createdAt: after(now - 20 * DAY, 15), readAt: null });
        dotSubs++;
      }
    } else {
      console.log(`(No platform account @${handle} found; skipping its content interactions.)`);
    }

    // ---------- flush reactions, comments, notifications ----------
    for (const part of chunk(reactions, 800)) await prisma.reaction.createMany({ data: part });
    for (const part of chunk(comments, 800)) await prisma.comment.createMany({ data: part });
    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });

    console.log(
      "Done: " + (Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing new (everything already seeded)") +
        `; reactions ${reactions.length}, comments ${comments.length}.`,
    );
    console.log(`@${handle}: ${dotLikes} likes, ${dotComments} comments, ${dotSubs} newsletter subscriptions. Notifications created: ${notifs.length}.`);
    console.log("Cleanup: RESET=1 npx tsx scripts/seed-dots-content.ts (or delete-seed-users.ts)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
