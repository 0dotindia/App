import { randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { validateArticleSlugFormat } from "../src/lib/reserved-article-slugs";
import { validateProjectSlugFormat } from "../src/lib/reserved-project-slugs";
import { cleanupSeedContentReactions } from "./seed-dots-cleanup";
import {
  DAY, HOUR, MIN, SHOWCASE_DOMAIN, SHOWCASE_HANDLE, SCALE_COLORS, chunk, dotSquareSvg, loadDots, loadShowcase, makeAfter, makeRng, openDb, snake, type NotifRow,
} from "./seed-showcase-common";
import { PERSON, SCALES, PAPERS } from "./seed-showcase-data";
import {
  COMMENTS, CONTENT, COURSES, EXTRA_ARTICLES, FILES, FORM, LIVESTREAMS, WIKI_FIELD_GUIDE, projectBody,
} from "./seed-showcase-content-data";
import { CHAT_LINES } from "./seed-dots-content-data";

// Content for the showcase profile: 7 projects (one per scale, with gallery, collaborators, skill tags, likes and
// comments, linked to repositories and papers), 11 articles/tutorials/notes with tags and engagement, the book
// "Scales of Living" (9 chapters), a profile wiki (field guide with a revision history), 3 downloadable files,
// 2 courses + a learning path (text lessons, ~70 learners with progress), the podcast "Small Big Things"
// (9 episodes, placeholder audio), the newsletter "Scale Notes" (8 issues, ~300 subscribers), 4 livestreams
// (3 ended with chat, 1 upcoming) and a published survey with responses. @dot likes, comments and subscribes.
//
// Limits: podcast audio uses placeholder keys (protected uploads live in Vercel Blob); lessons are text-only.
// Run seed-showcase-profile.ts first. Local only.
// Usage: npx tsx scripts/seed-showcase-content.ts     (refuses if content already exists)
//        RESET=1 npx tsx scripts/seed-showcase-content.ts   (remove the showcase's content first, then reseed)

async function main() {
  const { url, prisma } = await openDb();
  const { rand, int, between, pick, chance, shuffle } = makeRng(Number(process.env.SEED ?? 13));
  const now = Date.now();
  const after = makeAfter(now, rand);
  console.log(`Seeding showcase content at: ${url}`);
  const showcaseUser = { email: { endsWith: `@${SHOWCASE_DOMAIN}` } };

  try {
    const me = await loadShowcase(prisma);
    const dots = await loadDots(prisma);
    const dotAccount = await prisma.username.findUnique({ where: { handle: (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase() }, select: { userId: true, user: { select: { createdAt: true, email: true } } } });

    if (process.env.RESET === "1") {
      await cleanupSeedContentReactions(prisma, SHOWCASE_DOMAIN);
      const slugs = (await prisma.article.findMany({ where: { author: showcaseUser }, select: { slug: true } })).map((a) => `/${SHOWCASE_HANDLE}/articles/${a.slug}`);
      await prisma.notification.deleteMany({ where: { subjectType: { in: ["article", "project"] }, subjectId: { in: slugs } } });
      await Promise.all([
        prisma.project.deleteMany({ where: { owner: showcaseUser } }), prisma.article.deleteMany({ where: { author: showcaseUser } }),
        prisma.wikiPage.deleteMany({ where: { profile: { user: showcaseUser } } }), prisma.book.deleteMany({ where: { profile: { user: showcaseUser } } }),
        prisma.publishedFile.deleteMany({ where: { profile: { user: showcaseUser } } }), prisma.learningPath.deleteMany({ where: { creator: showcaseUser } }),
        prisma.course.deleteMany({ where: { creator: showcaseUser } }), prisma.podcast.deleteMany({ where: { creator: showcaseUser } }),
        prisma.livestream.deleteMany({ where: { creator: showcaseUser } }), prisma.newsletterIssue.deleteMany({ where: { creator: showcaseUser } }),
        prisma.newsletterSubscription.deleteMany({ where: { creator: showcaseUser } }), prisma.form.deleteMany({ where: { ownerProfile: { user: showcaseUser } } }),
      ]);
      console.log("RESET: removed showcase content.");
    }
    if ((await prisma.project.count({ where: { ownerId: me.id } })) > 0) {
      console.log("Showcase content already exists. Re-run with RESET=1 to rebuild it.");
      return;
    }
    mkdirSync("public/uploads", { recursive: true });

    const notifs: NotifRow[] = [];
    const markRead = (at: Date) => (chance(0.55) ? new Date(at.getTime() + between(5, 600) * MIN) : null);
    const spread = (i: number, n: number, daysBack: number) => new Date(now - daysBack * DAY + ((i + rand() * 0.7) / n) * (daysBack * DAY - 2 * DAY));
    const reactions: { subjectType: string; subjectId: string; userId: string; kind: string; createdAt: Date }[] = [];
    const comments: { subjectType: string; subjectId: string; authorId: string; body: string; createdAt: Date }[] = [];
    const engage = (type: string, id: string, from: Date, nLikes: number, nComments: number, path?: string) => {
      const likers = shuffle(dots).slice(0, nLikes);
      likers.forEach((d, i) => {
        const at = after([d.createdAt], Math.max(from.getTime(), d.createdAt), from.getTime() + 60 * DAY);
        reactions.push({ subjectType: type, subjectId: id, userId: d.id, kind: "like", createdAt: at });
        if (path && i < 4) notifs.push({ recipientId: me.id, actorId: d.id, type: "like", subjectType: type, subjectId: path, createdAt: at, readAt: markRead(at) });
      });
      const writers = shuffle(dots).slice(0, nComments);
      writers.forEach((d) => {
        const at = after([d.createdAt], Math.max(from.getTime(), d.createdAt), from.getTime() + 60 * DAY);
        comments.push({ subjectType: type, subjectId: id, authorId: d.id, body: pick(COMMENTS), createdAt: at });
        if (path) notifs.push({ recipientId: me.id, actorId: d.id, type: "comment", subjectType: type, subjectId: path, createdAt: at, readAt: markRead(at) });
      });
      return { likes: likers.length, comments: writers.length };
    };

    const skillIds = new Map((await prisma.skill.findMany({ where: { profileId: me.profileId }, select: { id: true, name: true } })).map((s) => [s.name, s.id]));
    const totals: Record<string, number> = {};
    const tally = (k: string, n = 1) => (totals[k] = (totals[k] ?? 0) + n);

    // ================= Projects (one per scale) =================
    const projectIdByScale: string[] = [];
    for (const [i, s] of SCALES.entries()) {
      const c = CONTENT[i].project;
      const slug = `${SHOWCASE_HANDLE}_${c.slug}`;
      if (validateProjectSlugFormat(slug) !== null) throw new Error(`Bad project slug: ${slug}`);
      writeFileSync(`public/uploads/showcase-project-${s.key}.svg`, dotSquareSvg(c.title, i + 2, SCALE_COLORS[i], 900, `${s.name} · ${s.size}`));
      const createdAt = spread(i, 7, 130);
      const collabs = shuffle(dots).slice(0, between(3, 5));
      const likers = shuffle(dots).slice(0, between(45, 95));
      const commenters = shuffle(dots).slice(0, between(6, 12));
      const project = await prisma.project.create({
        data: {
          slug, ownerId: me.id, title: c.title, summary: c.summary, description: projectBody(c.body, c.highlights), coverImageUrl: `/uploads/showcase-project-${s.key}.svg`,
          galleryJson: JSON.stringify([`/uploads/showcase-scale-${s.key}-0.svg`, `/uploads/showcase-scale-${s.key}-1.svg`, `/uploads/showcase-scale-${SCALES[(i + 1) % 7].key}-0.svg`]),
          status: i === 6 ? "in_progress" : "completed", startedAt: new Date(createdAt.getTime() - between(60, 400) * DAY), completedAt: i === 6 ? null : new Date(createdAt.getTime() + between(20, 200) * DAY > now ? now - DAY : createdAt.getTime() + between(20, 200) * DAY),
          externalLinksJson: JSON.stringify(c.links.map(([label, u]) => ({ label, url: u }))), visibility: "public", featuredOnResume: true, position: i, likeCount: likers.length, commentCount: commenters.length, createdAt,
          skills: { create: c.skills.filter((n) => skillIds.has(n)).map((n) => ({ skillId: skillIds.get(n)! })) },
          collaborators: { create: [...collabs.map((d, k) => ({ userId: d.id, role: ["Design", "Field research", "Data", "Community lead", "Engineering"][k % 5], createdAt })), { displayName: pick(["Dr. A. Pillai", "S. Varghese", "M. Thomas", "R. Nair"]), role: "Advisor", createdAt }] },
          likes: { create: likers.map((d) => ({ userId: d.id, createdAt: after([d.createdAt], Math.max(createdAt.getTime(), d.createdAt), now) })) },
          comments: { create: commenters.map((d) => ({ authorId: d.id, body: pick(COMMENTS), createdAt: after([d.createdAt], Math.max(createdAt.getTime(), d.createdAt), now) })) },
        },
        select: { id: true },
      });
      projectIdByScale.push(project.id);
      for (const d of likers.slice(0, 5)) notifs.push({ recipientId: me.id, actorId: d.id, type: "like", subjectType: "project", subjectId: slug, createdAt: after([d.createdAt], Math.max(createdAt.getTime(), d.createdAt), now), readAt: null });
      tally("projects");
    }
    // Link repositories and papers to their projects.
    const repoProject: Record<string, number> = { "city-air-ledger": 4, "open-grain-commons": 5, "planet-health-index": 6, "seed-library-kit": 0, "scale-ladder": 6 };
    for (const [name, idx] of Object.entries(repoProject)) await prisma.gitRepository.updateMany({ where: { profileId: me.profileId, displayName: name }, data: { projectId: projectIdByScale[idx] } });
    const paperProject: [string, number][] = [["Household Greywater", 2], ["Community Sensor Networks", 4], ["Ward-Level Composting", 3], ["Open Data as Food-Security", 5], ["Scales of Living", 6]];
    for (const [prefix, idx] of paperProject) await prisma.researchPaper.updateMany({ where: { profileId: me.profileId, title: { startsWith: prefix } }, data: { projectId: projectIdByScale[idx] } });
    void PAPERS;

    // ================= Articles =================
    const articleDefs = [
      ...CONTENT.map((c) => ({ ...c.essay, format: "article" as const, points: [...c.essay.points] })),
      ...EXTRA_ARTICLES,
    ];
    const bodyOf = (a: { format: string; intro: string; points: string[]; closing: string }) =>
      a.format === "tutorial" ? `${a.intro}\n\n## Steps\n\n${a.points.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\n${a.closing}` : a.format === "note" ? `${a.intro}\n\n${a.points.map((p) => `- ${p}`).join("\n")}\n\n${a.closing}` : `${a.intro}\n\n## Key ideas\n\n${a.points.map((p) => `- ${p}`).join("\n")}\n\n${a.closing}`;
    const articleRows: Record<string, unknown>[] = [];
    const tagLinks: { articleId: string; tag: string }[] = [];
    articleDefs.forEach((a, i) => {
      const slug = snake(a.title).slice(0, 80);
      if (validateArticleSlugFormat(slug) !== null) throw new Error(`Bad article slug: ${slug}`);
      const publishedAt = spread(i, articleDefs.length, 125);
      const id = randomUUID();
      const path = `/${SHOWCASE_HANDLE}/articles/${slug}`;
      const eng = engage("article", id, publishedAt, between(35, 95), between(5, 12), path);
      const body = bodyOf(a);
      articleRows.push({ id, authorId: me.id, slug, title: a.title, subtitle: a.subtitle, format: a.format, body, status: "published", visibility: "public", readingTimeMinutes: Math.max(1, Math.ceil(body.split(/\s+/).length / 200)), likeCount: eng.likes, commentCount: eng.comments, viewCount: between(900, 24000), publishedAt, createdAt: publishedAt, updatedAt: publishedAt });
      a.tags.forEach((tag) => tagLinks.push({ articleId: id, tag }));
    });
    await prisma.article.createMany({ data: articleRows as never });
    const tagIds = new Map<string, string>();
    for (const tag of new Set(tagLinks.map((t) => t.tag))) tagIds.set(tag, (await prisma.hashtag.upsert({ where: { name: tag }, update: {}, create: { name: tag }, select: { id: true } })).id);
    await prisma.articleHashtag.createMany({ data: tagLinks.map((t) => ({ articleId: t.articleId, hashtagId: tagIds.get(t.tag)! })) });
    tally("articles", articleRows.length);

    // ================= Book: Scales of Living =================
    const bookAt = spread(2, 8, 100);
    const book = await prisma.book.create({ data: { profileId: me.profileId, slug: "scales_of_living", title: "Scales of Living", description: "A seven-scale guide to the things that matter to live, from a single seed to the whole planet, with worked examples, exercises and open data.", status: "published", visibility: "public", createdAt: bookAt } });
    const chapters: [string, string][] = [
      ["Preface: A Dot", "Every scale begins with a dot. This book is about seeing the dot, and then seeing what it is part of. Read it in order or jump to the scale you care about most."],
      ...CONTENT.map((c, i) => [c.chapter[0], `${c.chapter[1]}\n\n**What matters to live here:** ${SCALES[i].matters}.\n\n**Try this:** ${c.lesson[1]}`] as [string, string]),
      ["Epilogue: Back to the Dot", "The ladder has no top and no bottom. When you finish, return to the smallest thing you can do this week and do it. That is how every large thing gets built."],
    ];
    for (const [pos, [title, text]] of chapters.entries()) {
      const at = new Date(bookAt.getTime() + pos * DAY);
      const page = await prisma.wikiPage.create({ data: { bookId: book.id, slug: snake(title).slice(0, 60), title, kind: "book_chapter", position: pos, createdAt: at } });
      const rev = await prisma.wikiRevision.create({ data: { wikiPageId: page.id, body: `# ${title}\n\n${text}`, editedBy: me.id, createdAt: at } });
      await prisma.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: rev.id } });
      tally("chapters");
    }
    const bookEng = engage("book", book.id, bookAt, between(70, 96), 12);
    await prisma.book.update({ where: { id: book.id }, data: { likeCount: bookEng.likes, commentCount: bookEng.comments } });
    tally("books");

    // ================= Profile wiki (with edit history on the root) =================
    const wikiAt = spread(1, 5, 90);
    const mkPage = async (title: string, body: string, parent: string | null, pos: number, revisions = 1) => {
      const page = await prisma.wikiPage.create({ data: { profileId: me.profileId, slug: snake(title).slice(0, 60), title, kind: "documentation", parentPageId: parent, position: pos, createdAt: wikiAt } });
      let last = "";
      for (let r = 0; r < revisions; r++) {
        const at = new Date(wikiAt.getTime() + r * between(5, 20) * DAY);
        const rev = await prisma.wikiRevision.create({ data: { wikiPageId: page.id, body: `# ${title}\n\n${body}${r < revisions - 1 ? "" : "\n\n_Last reviewed by the Bindu Foundation team._"}`, editedBy: me.id, createdAt: at } });
        last = rev.id;
      }
      await prisma.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: last } });
      tally("wikiPages");
      return page.id;
    };
    const rootId = await mkPage(WIKI_FIELD_GUIDE.root[0], WIKI_FIELD_GUIDE.root[1], null, 0, 4);
    for (const [i, s] of SCALES.entries()) await mkPage(`${i + 1}. ${s.name}`, WIKI_FIELD_GUIDE.pageBody(s.name, s.size, s.matters), rootId, i, i % 3 === 0 ? 2 : 1);
    await mkPage(WIKI_FIELD_GUIDE.glossary[0], WIKI_FIELD_GUIDE.glossary[1], rootId, 8, 2);

    // ================= Published files =================
    for (const f of FILES) {
      const publishedAt = spread(pick([0, 1, 2]), 3, 80);
      const fileName = `showcase-${SHOWCASE_HANDLE}-${f.filename}`;
      writeFileSync(`public/uploads/${fileName}`, f.content);
      const file = await prisma.publishedFile.create({ data: { profileId: me.profileId, slug: snake(f.title).slice(0, 60), title: f.title, description: f.description, fileUrl: `/uploads/${fileName}`, fileMimeType: f.mime, fileSizeBytes: Buffer.byteLength(f.content), visibility: "public", downloadCount: between(400, 4800), publishedAt, createdAt: publishedAt } });
      engage("published_file", file.id, publishedAt, between(25, 70), 0);
      tally("files");
    }

    // ================= Courses + learning path =================
    const courseIds: string[] = [];
    const courseGrantsFor = async (courseId: string, lessonIds: string[], createdAt: Date, n: number) => {
      const learners = shuffle(dots).slice(0, n);
      await prisma.courseAccessGrant.createMany({ data: learners.map((l) => ({ courseId, userId: l.id, grantedVia: "purchase", createdAt: after([l.createdAt], Math.max(createdAt.getTime(), l.createdAt), now) })) });
      const progress = learners.flatMap((l) => shuffle(lessonIds).slice(0, between(0, lessonIds.length)).map((lessonId) => ({ userId: l.id, lessonId, completedAt: after([l.createdAt], Math.max(createdAt.getTime(), l.createdAt), now) })));
      if (progress.length) await prisma.courseProgress.createMany({ data: progress });
      tally("learners", n);
    };
    {
      const c = COURSES[0] as { title: string; description: string; price: number; moduleScales: number[][] };
      const createdAt = spread(3, 8, 110);
      const modNames = ["Seed & Body: Where Life Starts", "Home & Street: Where Life Happens", "City & Nation: Where Life Is Shared", "Planet: The Sum of It All"];
      const course = await prisma.course.create({
        data: {
          creatorId: me.id, title: c.title, description: c.description, price: c.price, currency: "USD", status: "active", createdAt,
          modules: { create: c.moduleScales.map((idxs, mi) => ({ title: modNames[mi], position: mi, lessons: { create: idxs.map((si, li) => ({ title: CONTENT[si].lesson[0], position: li, contentType: "text", body: CONTENT[si].lesson[1] })) } })) },
        },
        select: { id: true, modules: { select: { lessons: { select: { id: true } } } } },
      });
      courseIds.push(course.id);
      await courseGrantsFor(course.id, course.modules.flatMap((m) => m.lessons.map((l) => l.id)), createdAt, 46);
      tally("courses");
    }
    {
      const c = COURSES[1] as { title: string; description: string; price: number; modules: [string, [string, string][]][] };
      const createdAt = spread(5, 8, 90);
      const course = await prisma.course.create({
        data: { creatorId: me.id, title: c.title, description: c.description, price: c.price, currency: "USD", status: "active", createdAt, modules: { create: c.modules.map(([title, lessons], mi) => ({ title, position: mi, lessons: { create: lessons.map(([lt, body], li) => ({ title: lt, position: li, contentType: "text", body })) } })) } },
        select: { id: true, modules: { select: { lessons: { select: { id: true } } } } },
      });
      courseIds.push(course.id);
      await courseGrantsFor(course.id, course.modules.flatMap((m) => m.lessons.map((l) => l.id)), createdAt, 30);
      tally("courses");
    }
    await prisma.learningPath.create({ data: { creatorId: me.id, title: "The Scale Ladder Path", courseIdsJson: JSON.stringify(courseIds), createdAt: new Date(now - 60 * DAY) } });
    tally("learningPaths");

    // ================= Podcast =================
    const rssSlug = `small-big-things-${randomBytes(4).toString("hex")}`;
    writeFileSync(`public/uploads/podcast-${rssSlug}.svg`, dotSquareSvg("Small Big Things", 5, "#1a9c93", 600, "with Ira Menon"));
    const podAt = spread(0, 6, 100);
    const podcast = await prisma.podcast.create({ data: { creatorId: me.id, title: "Small Big Things", description: "A weekly show about the essentials of living, from a single seed to the whole planet, with people who work at every scale.", coverUrl: `/uploads/podcast-${rssSlug}.svg`, rssSlug, createdAt: podAt } });
    const episodes: [string, string, number][] = [["Trailer: A Dot Is Where It Begins", "What this show is about and why the smallest scale matters.", 420], ...CONTENT.map((c) => c.episode), ["Finale: Back to the Dot", "What we learned across seven scales, and what to do next.", 1980]];
    await prisma.podcastEpisode.createMany({
      data: episodes.map(([title, description, durationS], i) => {
        const publishAt = new Date(Math.max(podAt.getTime() + DAY, now - (episodes.length - i) * 7 * DAY - int(2 * DAY)));
        return { podcastId: podcast.id, episodeNumber: i + 1, title, description, durationS, fileKey: `protected/${randomBytes(16).toString("hex")}.mp3`, fileMimeType: "audio/mpeg", fileSizeBytes: durationS * 16000, publishAt, createdAt: publishAt };
      }),
    });
    tally("episodes", episodes.length);

    // ================= Newsletter =================
    const issues = [...CONTENT.map((c) => c.issue), ["Issue 8: See you at the Seed to Planet Summit", "The summit is almost here.", ["Sessions for every scale", "Free and paid tickets", "Bring one seed and one question"] as [string, string, string]] as [string, string, [string, string, string]]];
    for (const [i, [subject, blurb, bullets]] of issues.entries()) {
      const sentAt = new Date(now - (issues.length - i) * 7 * DAY - int(DAY));
      await prisma.newsletterIssue.create({ data: { creatorId: me.id, subject: `Scale Notes: ${subject}`, body: `Hi friends,\n\n${blurb}\n\n${bullets.map((b) => `- ${b}`).join("\n")}\n\nUntil next time,\nIra`, status: "sent", sentAt, createdAt: new Date(sentAt.getTime() - DAY) } });
      tally("issues");
    }
    const subs = [
      ...dots.map((d) => ({ creatorId: me.id, subscriberUserId: d.id as string | null, subscriberEmail: `${d.handle}@seed.0dot.local`, unsubscribeToken: randomUUID(), subscribedAt: after([d.createdAt], Math.max(d.createdAt, now - 90 * DAY), now - DAY), unsubscribedAt: chance(0.04) ? new Date(now - between(1, 20) * DAY) : null })),
      ...Array.from({ length: 200 }, (_, i) => ({ creatorId: me.id, subscriberUserId: null as string | null, subscriberEmail: `reader${i + 1}@example.com`, unsubscribeToken: randomUUID(), subscribedAt: new Date(now - between(1, 140) * DAY), unsubscribedAt: chance(0.05) ? new Date(now - between(1, 30) * DAY) : null })),
    ];
    for (const part of chunk(subs, 400)) await prisma.newsletterSubscription.createMany({ data: part });
    tally("subscribers", subs.length);

    // ================= Livestreams =================
    for (const [title, offset] of LIVESTREAMS) {
      const id = randomUUID();
      const startedAt = new Date(now + offset * DAY);
      const past = offset < 0;
      await prisma.livestream.create({
        data: {
          id, creatorId: me.id, title, status: past ? "ended" : "scheduled", scheduledAt: startedAt, startedAt: past ? startedAt : null, endedAt: past ? new Date(startedAt.getTime() + between(45, 95) * MIN) : null,
          ingestKey: `stub_ingest_${randomBytes(12).toString("hex")}`, playbackUrl: `/stub-playback/${id}`, createdAt: new Date(startedAt.getTime() - 5 * DAY),
        },
      });
      if (past) {
        const chatters = shuffle(dots).slice(0, between(22, 40));
        await prisma.livestreamChatMessage.createMany({ data: chatters.flatMap((c) => Array.from({ length: between(1, 3) }, () => ({ livestreamId: id, senderId: c.id, body: pick(CHAT_LINES), createdAt: new Date(startedAt.getTime() + between(1, 60) * MIN) }))) });
      }
      tally("livestreams");
    }

    // ================= Survey with responses =================
    const form = await prisma.form.create({ data: { ownerType: "profile", ownerProfileId: me.profileId, title: FORM.title, description: FORM.description, fieldsJson: JSON.stringify(FORM.fields), mode: "survey", status: "published", createdAt: new Date(now - 45 * DAY) } });
    const responders = [...shuffle(dots).slice(0, 70).map((d) => d.id), ...Array.from({ length: 20 }, () => null)];
    await prisma.formResponse.createMany({
      data: responders.map((rid) => ({
        formId: form.id, respondentId: rid,
        answersJson: JSON.stringify({ [FORM.fields[0].label]: pick(FORM.fields[0].options), [FORM.fields[1].label]: pick(FORM.fields[1].options), [FORM.fields[2].label]: between(2, 5), [FORM.fields[3].label]: chance(0.6) ? pick(FORM.answers) : "", [FORM.fields[4].label]: new Date(now + between(3, 30) * DAY).toISOString().slice(0, 10) }),
        submittedAt: new Date(now - between(1, 44) * DAY),
      })),
    });
    tally("surveyResponses", responders.length);

    // ================= @dot =================
    let dotLikes = 0;
    if (dotAccount && !dotAccount.user.email.endsWith("@seed.0dot.local")) {
      const P = dotAccount.userId;
      for (const a of shuffle(articleRows).slice(0, 8)) {
        const at = new Date(Math.max(dotAccount.user.createdAt.getTime() + 10 * MIN, now - between(5, 90) * MIN));
        reactions.push({ subjectType: "article", subjectId: a.id as string, userId: P, kind: "like", createdAt: at });
        dotLikes++;
      }
      reactions.push({ subjectType: "book", subjectId: book.id, userId: P, kind: "like", createdAt: new Date(now - 20 * MIN) });
      comments.push({ subjectType: "article", subjectId: shuffle(articleRows)[0].id as string, authorId: P, body: "A beautiful way to think about scale. Sharing this with the 0dot team 🙏", createdAt: new Date(now - 15 * MIN) });
      await prisma.newsletterSubscription.create({ data: { creatorId: me.id, subscriberUserId: P, subscriberEmail: dotAccount.user.email, unsubscribeToken: randomUUID(), subscribedAt: new Date(now - 30 * MIN) } });
    }

    for (const part of chunk(reactions, 800)) await prisma.reaction.createMany({ data: part });
    for (const part of chunk(comments, 800)) await prisma.comment.createMany({ data: part });
    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });
    console.log("Done: " + Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ") + `; reactions ${reactions.length}, comments ${comments.length}, @dot likes ${dotLikes}.`);
    void HOUR;
    void PERSON;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
