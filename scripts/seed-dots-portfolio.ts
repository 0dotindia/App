import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { validateProjectSlugFormat } from "../src/lib/reserved-project-slugs";
import { PALETTES, coverSvg } from "./seed-dots-art";
import { SEED_EMAIL_DOMAIN } from "./seed-dots-cleanup";
import { PEOPLE } from "./seed-dots-data";
import {
  AWARD_YEAR_SPREAD_DAYS, COLLAB_ROLES, COMMENT_BODIES, EXTERNAL_COLLABS, PAPER_COAUTHORS, PLATFORM_PROJECT_COMMENTS, PORTFOLIO,
} from "./seed-dots-portfolio-data";

// Fills the Portfolio section of all seeded dots (seed-dots.ts): 2-3 projects each (with
// cover art, links, skill tags, collaborators, likes and comments), certificates, awards,
// and, by role, repositories and research papers. Skills, work history and education
// already exist from seed-dots.ts. The platform account (@dot) likes and comments on
// a selection of projects. Run seed-dots.ts first.
//
// Everything belongs to seeded accounts, so delete-seed-users.ts removes it via cascades.
// Repository, DOI and credential links use `.example` domains on purpose.
//
// Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-portfolio.ts          (skips users/sections that already have items)
//        RESET=1 npx tsx scripts/seed-dots-portfolio.ts   (wipe seeded portfolios first, then reseed)
//        SEED=3 PLATFORM_HANDLE=dot npx tsx scripts/seed-dots-portfolio.ts

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
const rand = mulberry32(Number(process.env.SEED ?? 3));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T,>(arr: readonly T[]): T[] => [...arr].sort(() => rand() - 0.5);
const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const snake = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  console.log(`Seeding portfolios at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const now = Date.now();
  const seedUser = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };

  try {
    if (process.env.RESET === "1") {
      const slugs = (await prisma.project.findMany({ where: { owner: seedUser }, select: { slug: true } })).map((p) => p.slug);
      await prisma.notification.deleteMany({ where: { subjectType: "project", subjectId: { in: slugs } } });
      const [pr, gr, rp, ce, aw] = await Promise.all([
        prisma.project.deleteMany({ where: { owner: seedUser } }),
        prisma.gitRepository.deleteMany({ where: { profile: { user: seedUser } } }),
        prisma.researchPaper.deleteMany({ where: { profile: { user: seedUser } } }),
        prisma.certificate.deleteMany({ where: { profile: { user: seedUser } } }),
        prisma.award.deleteMany({ where: { profile: { user: seedUser } } }),
      ]);
      console.log(`RESET: removed ${pr.count} projects, ${gr.count} repositories, ${rp.count} papers, ${ce.count} certificates, ${aw.count} awards.`);
    }

    const roleByName = new Map(PEOPLE.map(([first, last, , , role]) => [`${first} ${last}`, role]));
    const users = await prisma.user.findMany({
      where: seedUser,
      select: {
        id: true, createdAt: true,
        username: { select: { handle: true } },
        profile: { select: { id: true, displayName: true, skills: { select: { id: true, name: true } } } },
      },
    });
    if (users.length === 0) throw new Error("No seeded dots found. Run scripts/seed-dots.ts first.");
    const dots = users.map((u) => ({
      id: u.id, createdAt: u.createdAt.getTime(), handle: u.username!.handle, profileId: u.profile!.id,
      name: u.profile!.displayName, skills: u.profile!.skills, role: roleByName.get(u.profile!.displayName),
    }));
    const missing = dots.filter((d) => !d.role);
    if (missing.length) throw new Error(`No role found for ${missing.length} dots (e.g. ${missing[0].name}). Did seed-dots-data.ts change?`);

    const [hasProject, hasRepo, hasPaper, hasCert, hasAward] = await Promise.all([
      prisma.project.findMany({ where: { owner: seedUser }, select: { ownerId: true }, distinct: ["ownerId"] }),
      prisma.gitRepository.findMany({ where: { profile: { user: seedUser } }, select: { profileId: true }, distinct: ["profileId"] }),
      prisma.researchPaper.findMany({ where: { profile: { user: seedUser } }, select: { profileId: true }, distinct: ["profileId"] }),
      prisma.certificate.findMany({ where: { profile: { user: seedUser } }, select: { profileId: true }, distinct: ["profileId"] }),
      prisma.award.findMany({ where: { profile: { user: seedUser } }, select: { profileId: true }, distinct: ["profileId"] }),
    ]);
    const hasP = new Set(hasProject.map((r) => r.ownerId));
    const hasR = new Set(hasRepo.map((r) => r.profileId));
    const hasPa = new Set(hasPaper.map((r) => r.profileId));
    const hasC = new Set(hasCert.map((r) => r.profileId));
    const hasA = new Set(hasAward.map((r) => r.profileId));
    const takenSlugs = new Set((await prisma.project.findMany({ select: { slug: true } })).map((p) => p.slug));

    mkdirSync("public/uploads", { recursive: true });
    type NotifRow = { recipientId: string; actorId: string; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null };
    const notifs: NotifRow[] = [];
    const readMaybe = (at: Date) => (chance(0.55) ? new Date(at.getTime() + between(5, 600) * MIN) : null);
    const after = (from: number, maxDays: number) => new Date(Math.min(now - MIN, from + 3 * MIN + rand() * maxDays * DAY));
    const totals = { projects: 0, likes: 0, comments: 0, collabs: 0, repos: 0, papers: 0, certs: 0, awards: 0 };

    for (const [di, d] of dots.entries()) {
      const persona = PORTFOLIO[d.role!];

      // ---- projects ----
      let firstProjectId: string | null = null;
      const freshUser = !hasP.has(d.id); // the paper dice roll only happens on a user's first run
      if (freshUser) {
        const picks = shuffle(persona.projects).slice(0, Math.min(persona.projects.length, between(2, 3)));
        const others = dots.filter((o) => o.id !== d.id);
        for (const [pi, [title, summary, description, linkLabels]] of picks.entries()) {
          let slug = `${d.handle}_${snake(title)}`.slice(0, 60).replace(/_+$/g, "");
          if (validateProjectSlugFormat(slug) !== null || takenSlugs.has(slug)) slug = `${d.handle}_${snake(title).slice(0, 20)}_${between(10, 99)}`.slice(0, 60);
          if (validateProjectSlugFormat(slug) !== null || takenSlugs.has(slug)) throw new Error(`Bad or taken project slug: ${slug}`);
          takenSlugs.add(slug);

          const createdAt = new Date(Math.min(now - 3 * DAY, d.createdAt + between(1, 25) * DAY));
          const startedAt = new Date(now - between(90, 900) * DAY);
          const status = chance(0.7) ? "completed" : chance(0.8) ? "in_progress" : "archived";
          const completedAt = status === "in_progress" ? null : new Date(Math.min(now - DAY, startedAt.getTime() + between(20, 240) * DAY));
          const stem = slug.replace(/_/g, "-");
          const links = linkLabels.map((label) => ({ label, url: `https://${stem}.example/${snake(label)}` }));
          const ownSkills = shuffle(d.skills).slice(0, Math.min(d.skills.length, between(2, 3)));

          writeFileSync(`public/uploads/project-${slug}.svg`, coverSvg(PALETTES[(di * 3 + pi * 5 + 1) % PALETTES.length], di + pi));

          const likers = shuffle(others).filter((o) => o.createdAt < createdAt.getTime() + 10 * DAY).slice(0, between(2, 25));
          const commenters = shuffle(others).slice(0, chance(0.6) ? between(1, 3) : 0);
          const collabs = chance(0.35)
            ? shuffle(others).slice(0, between(1, 2)).map((o) => ({ userId: o.id, displayName: null as string | null, role: pick(COLLAB_ROLES) }))
            : [];
          if (chance(0.2)) collabs.push({ userId: null as unknown as string, displayName: pick(EXTERNAL_COLLABS), role: pick(COLLAB_ROLES) });

          const project = await prisma.project.create({
            data: {
              slug,
              ownerId: d.id,
              title,
              summary,
              description,
              coverImageUrl: `/uploads/project-${slug}.svg`,
              status,
              startedAt,
              completedAt,
              externalLinksJson: JSON.stringify(links),
              visibility: "public",
              featuredOnResume: pi === 0,
              position: pi,
              likeCount: likers.length,
              commentCount: commenters.length,
              createdAt,
              skills: { create: ownSkills.map((s) => ({ skillId: s.id })) },
              collaborators: { create: collabs.map((c) => ({ userId: c.userId, displayName: c.displayName, role: c.role, createdAt })) },
              likes: { create: likers.map((o) => ({ userId: o.id, createdAt: after(createdAt.getTime(), 30) })) },
              comments: { create: commenters.map((o, i) => ({ authorId: o.id, body: COMMENT_BODIES[(di + pi + i) % COMMENT_BODIES.length], createdAt: after(createdAt.getTime(), 30) })) },
            },
            select: { id: true },
          });
          if (pi === 0) firstProjectId = project.id;
          totals.projects++;
          totals.likes += likers.length;
          totals.comments += commenters.length;
          totals.collabs += collabs.length;
          for (const o of likers.slice(0, 5)) {
            const at = after(createdAt.getTime(), 30);
            notifs.push({ recipientId: d.id, actorId: o.id, type: "like", subjectType: "project", subjectId: slug, createdAt: at, readAt: readMaybe(at) });
          }
          for (const o of commenters) {
            const at = after(createdAt.getTime(), 30);
            notifs.push({ recipientId: d.id, actorId: o.id, type: "comment", subjectType: "project", subjectId: slug, createdAt: at, readAt: readMaybe(at) });
          }
        }
      }

      // ---- repositories ----
      if (persona.repos && !hasR.has(d.profileId)) {
        const repos = shuffle(persona.repos).slice(0, between(2, persona.repos.length));
        await prisma.gitRepository.createMany({
          data: repos.map(([name, description, primaryLanguage], i) => ({
            profileId: d.profileId,
            projectId: i === 0 ? firstProjectId : null,
            provider: "github",
            url: `https://github.example/${d.handle}/${name}`,
            displayName: name,
            description,
            primaryLanguage,
            starCount: between(0, 400),
            lastSyncedAt: new Date(now - between(0, 20) * DAY),
          })),
        });
        totals.repos += repos.length;
      }

      // ---- research papers ----
      if (persona.papers && freshUser && !hasPa.has(d.profileId) && chance(persona.paperChance ?? 1)) {
        const papers = shuffle(persona.papers).slice(0, between(1, persona.papers.length));
        await prisma.researchPaper.createMany({
          data: papers.map(([title, venue, abstract]) => ({
            profileId: d.profileId,
            title,
            authors: `${d.name}, ${pick(PAPER_COAUTHORS)}`,
            venue,
            publishDate: new Date(now - between(60, 1200) * DAY),
            doiOrUrl: `https://doi.example/10.9999/${snake(title).slice(0, 24)}.${between(100, 999)}`,
            abstract,
          })),
        });
        totals.papers += papers.length;
      }

      // ---- certificates ----
      if (!hasC.has(d.profileId)) {
        const certs = shuffle(persona.certs).slice(0, Math.min(persona.certs.length, between(2, 3)));
        await prisma.certificate.createMany({
          data: certs.map(([title, issuingOrg]) => {
            const issueDate = new Date(now - between(60, 1500) * DAY);
            const credentialId = `${issuingOrg.split(" ").map((w) => w[0]).join("").toUpperCase()}-${between(100000, 999999)}`;
            return {
              profileId: d.profileId,
              title,
              issuingOrg,
              issueDate,
              expiryDate: chance(0.3) ? new Date(issueDate.getTime() + 2 * 365 * DAY) : null,
              credentialId,
              credentialUrl: `https://credentials.example/${credentialId.toLowerCase()}`,
            };
          }),
        });
        totals.certs += certs.length;
      }

      // ---- awards ----
      if (!hasA.has(d.profileId)) {
        const awards = shuffle(persona.awards).slice(0, between(1, persona.awards.length));
        await prisma.award.createMany({
          data: awards.map(([title, issuingOrg, description]) => ({
            profileId: d.profileId,
            title,
            issuingOrg,
            awardedDate: new Date(now - between(30, AWARD_YEAR_SPREAD_DAYS) * DAY),
            description,
          })),
        });
        totals.awards += awards.length;
      }
    }

    // ---- the platform account likes and comments on projects ----
    const handle = (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase();
    let dotLikes = 0;
    let dotComments = 0;
    const platform = await prisma.username.findUnique({ where: { handle }, select: { userId: true, user: { select: { email: true } } } });
    if (platform && !platform.user.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) {
      const P = platform.userId;
      const projects = await prisma.project.findMany({ where: { owner: seedUser, visibility: "public" }, select: { id: true, slug: true, ownerId: true, createdAt: true, likeCount: true } });
      const liked = new Set((await prisma.projectLike.findMany({ where: { userId: P }, select: { projectId: true } })).map((l) => l.projectId));
      const commentedBefore = await prisma.projectComment.count({ where: { authorId: P, deletedAt: null } });
      const ranked = shuffle(projects).sort((a, b) => b.likeCount * (0.6 + rand()) - a.likeCount * (0.6 + rand())).filter((p) => !liked.has(p.id));
      const toLike = ranked.slice(0, Math.max(0, 40 - liked.size));
      const commentCap = Math.max(0, 10 - commentedBefore);
      for (const [i, p] of toLike.entries()) {
        const at = after(p.createdAt.getTime(), 30);
        await prisma.projectLike.create({ data: { projectId: p.id, userId: P, createdAt: at } });
        let commentInc = 0;
        if (i < commentCap) {
          const cAt = after(at.getTime(), 2);
          await prisma.projectComment.create({ data: { projectId: p.id, authorId: P, body: pick(PLATFORM_PROJECT_COMMENTS), createdAt: cAt } });
          notifs.push({ recipientId: p.ownerId, actorId: P, type: "comment", subjectType: "project", subjectId: p.slug, createdAt: cAt, readAt: readMaybe(cAt) });
          commentInc = 1;
          dotComments++;
        }
        await prisma.project.update({ where: { id: p.id }, data: { likeCount: { increment: 1 }, commentCount: { increment: commentInc } } });
        notifs.push({ recipientId: p.ownerId, actorId: P, type: "like", subjectType: "project", subjectId: p.slug, createdAt: at, readAt: readMaybe(at) });
        dotLikes++;
      }
    } else {
      console.log(`(No platform account @${handle} found; skipping its project interactions.)`);
    }

    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });

    console.log(
      `Done: ${totals.projects} projects (${totals.likes} likes, ${totals.comments} comments, ${totals.collabs} collaborators), ` +
        `${totals.repos} repositories, ${totals.papers} papers, ${totals.certs} certificates, ${totals.awards} awards for ${dots.length} dots.`,
    );
    console.log(`@${handle}: ${dotLikes} project likes, ${dotComments} comments. Notifications created: ${notifs.length}.`);
    console.log(`Cleanup: RESET=1 npx tsx scripts/seed-dots-portfolio.ts (or delete-seed-users.ts)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
