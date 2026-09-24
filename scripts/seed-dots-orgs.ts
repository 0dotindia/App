import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PALETTES, avatarSvg, coverSvg } from "./seed-dots-art";
import { SEED_EMAIL_DOMAIN } from "./seed-dots-cleanup";
import { REPLIES } from "./seed-dots-data";
import { BUSINESSES, COMMUNITIES, REVIEW_BODIES, REVIEW_RESPONSES } from "./seed-dots-orgs-data";

// Gives the seeded dots (seed-dots.ts) communities and businesses to belong to:
// 14 communities (owners, moderators, members, rules, tags, posts, replies, likes)
// and 13 fictional businesses (owner + team, contact info, location and hours,
// offerings, reviews with owner responses, business-authored posts, a few jobs).
// Owners and members are picked by matching each dot's bio to the community/business
// theme. Run seed-dots.ts first.
//
// Everything is owned by seeded accounts, so `delete-seed-users.ts` (or RESET=1 on
// seed-dots.ts) removes it all through the schema's cascades.
//
// Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-orgs.ts          (skips slugs that already exist)
//        RESET=1 npx tsx scripts/seed-dots-orgs.ts   (delete these communities/businesses first, then reseed)
//        SEED=9 npx tsx scripts/seed-dots-orgs.ts    (different, still reproducible, layout)

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
const rand = mulberry32(Number(process.env.SEED ?? 11));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T,>(arr: readonly T[]): T[] => [...arr].sort(() => rand() - 0.5);
const initialsOf = (name: string) =>
  name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

type Dot = { id: string; handle: string; bio: string; createdAt: Date };

// Matching dots first (in random order), then everyone else, so a small pool still fills up.
function ranked(dots: Dot[], match: RegExp, cityHint?: string): Dot[] {
  const fits = shuffle(dots.filter((d) => match.test(d.bio)));
  const inCity = cityHint ? fits.filter((d) => d.bio.includes(cityHint)) : [];
  const rest = shuffle(dots.filter((d) => !match.test(d.bio)));
  return [...new Set([...inCity, ...fits, ...rest])];
}

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  console.log(`Seeding communities & businesses at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });

  try {
    const seedFilter = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };
    const users = await prisma.user.findMany({
      where: seedFilter,
      select: { id: true, createdAt: true, username: { select: { handle: true } }, profile: { select: { bio: true } } },
    });
    const dots: Dot[] = users.map((u) => ({ id: u.id, handle: u.username?.handle ?? "", bio: u.profile?.bio ?? "", createdAt: u.createdAt }));
    if (dots.length < 30) throw new Error(`Only ${dots.length} seeded dots found — run scripts/seed-dots.ts first.`);
    const now = Date.now();

    // ---------- RESET: remove previously seeded communities/businesses ----------
    if (process.env.RESET === "1") {
      const cSlugs = COMMUNITIES.map((c) => c.slug);
      const bSlugs = BUSINESSES.map((b) => b.slug);
      const bizIds = (await prisma.business.findMany({ where: { slug: { in: bSlugs }, creator: seedFilter }, select: { id: true } })).map((b) => b.id);
      // Business posts survive their business (SetNull), so delete them explicitly, replies first.
      for (let i = 0; i < 3; i++) {
        await prisma.post.deleteMany({ where: { OR: [{ businessAuthorId: { in: bizIds } }, { replyTo: { businessAuthorId: { in: bizIds } } }], replies: { none: {} }, reposts: { none: {} } } });
      }
      const c = await prisma.community.deleteMany({ where: { slug: { in: cSlugs }, creator: seedFilter } });
      const b = await prisma.business.deleteMany({ where: { id: { in: bizIds } } });
      console.log(`RESET: removed ${c.count} communities and ${b.count} businesses.`);
    }

    mkdirSync("public/uploads", { recursive: true });
    const usedCommunityOwners = new Set<string>();
    const usedBusinessOwners = new Set<string>();
    const totals = { communities: 0, members: 0, cPosts: 0, businesses: 0, offerings: 0, reviews: 0, bPosts: 0, jobs: 0 };

    // ================= Communities =================
    for (const [ci, spec] of COMMUNITIES.entries()) {
      if (await prisma.community.findUnique({ where: { slug: spec.slug } })) {
        console.log(`  skip community /c/${spec.slug} (exists)`);
        continue;
      }
      const pool = ranked(dots, spec.match);
      const owner = pool.find((d) => !usedCommunityOwners.has(d.id)) ?? pool[0];
      usedCommunityOwners.add(owner.id);

      const wanted = between(spec.size[0], spec.size[1]);
      const matched = pool.filter((d) => spec.match.test(d.bio) && d.id !== owner.id);
      const others = pool.filter((d) => !spec.match.test(d.bio) && d.id !== owner.id);
      // ~75% of members fit the theme (if enough do), the rest are curious outsiders.
      const fitCount = Math.min(matched.length, Math.round(wanted * 0.75));
      const memberDots = [...matched.slice(0, fitCount), ...others.slice(0, Math.max(0, wanted - 1 - fitCount))];
      const moderators = matched.slice(0, between(1, 2));
      const createdAt = new Date(Math.min(now - 5 * DAY, owner.createdAt.getTime() + between(1, 10) * DAY));

      const palette = PALETTES[(ci * 5 + 2) % PALETTES.length];
      writeFileSync(`public/uploads/community-${spec.slug}.svg`, avatarSvg(initialsOf(spec.name), palette, ci));
      writeFileSync(`public/uploads/community-${spec.slug}-cover.svg`, coverSvg(PALETTES[(ci * 7 + 4) % PALETTES.length], ci + 1));

      const community = await prisma.community.create({
        data: {
          slug: spec.slug,
          name: spec.name,
          description: spec.description,
          visibility: spec.visibility,
          avatarUrl: `/uploads/community-${spec.slug}.svg`,
          coverUrl: `/uploads/community-${spec.slug}-cover.svg`,
          createdBy: owner.id,
          createdAt,
          tags: { create: spec.tags.map((tag) => ({ tag })) },
          rules: { create: spec.rules.map(([title, body], position) => ({ title, body, position })) },
        },
      });

      const joinedAt = () => new Date(createdAt.getTime() + int(Math.max(1, Math.floor((now - createdAt.getTime()) / MIN))) * MIN);
      const memberRows = [
        { communityId: community.id, userId: owner.id, role: "owner", status: "active", joinedAt: createdAt },
        ...memberDots.map((d) => ({
          communityId: community.id,
          userId: d.id,
          role: moderators.some((m) => m.id === d.id) ? "moderator" : "member",
          status: "active",
          joinedAt: joinedAt(),
        })),
      ];
      // A restricted community shows a couple of people waiting for approval.
      if (spec.visibility === "restricted") {
        for (const d of others.slice(memberDots.length, memberDots.length + 2)) {
          memberRows.push({ communityId: community.id, userId: d.id, role: "member", status: "pending", joinedAt: joinedAt() });
        }
      }
      await prisma.communityMember.createMany({ data: memberRows });
      const activeMembers = memberRows.filter((m) => m.status === "active");
      await prisma.community.update({ where: { id: community.id }, data: { memberCount: activeMembers.length } });
      totals.members += activeMembers.length;

      // Posts (+ replies and likes) written by members.
      const authors = activeMembers.map((m) => m.userId);
      const posts: { id: string; authorId: string; body: string; communityId: string; replyToId: string | null; createdAt: Date; pinnedAt: Date | null; likeCount: number; replyCount: number }[] = [];
      const likes: { postId: string; userId: string; createdAt: Date }[] = [];
      spec.posts.forEach((body, i) => {
        const postedAt = new Date(now - between(1, Math.max(2, Math.floor((now - createdAt.getTime()) / DAY))) * DAY - int(DAY));
        const author = i === 0 ? owner.id : pick(authors);
        const id = randomUUID();
        const likers = shuffle(authors.filter((a) => a !== author)).slice(0, between(2, Math.min(18, authors.length - 1)));
        likers.forEach((userId) => likes.push({ postId: id, userId, createdAt: new Date(postedAt.getTime() + between(5, 3000) * MIN) }));
        const replyCount = between(0, 3);
        posts.push({ id, authorId: author, body, communityId: community.id, replyToId: null, createdAt: postedAt, pinnedAt: i === 0 ? postedAt : null, likeCount: likers.length, replyCount });
        for (let r = 0; r < replyCount; r++) {
          posts.push({
            id: randomUUID(),
            authorId: pick(authors.filter((a) => a !== author)),
            body: pick(REPLIES),
            communityId: community.id,
            replyToId: id,
            createdAt: new Date(postedAt.getTime() + between(10, 2000) * MIN),
            pinnedAt: null,
            likeCount: 0,
            replyCount: 0,
          });
        }
      });
      await prisma.post.createMany({ data: posts });
      await prisma.postLike.createMany({ data: likes });
      totals.cPosts += posts.length;
      totals.communities++;
      console.log(`  community /c/${spec.slug}: ${activeMembers.length} members, ${posts.length} posts`);
    }

    // ================= Businesses =================
    const teamRoles: [string, string][] = [["admin", "Operations Lead"], ["editor", "Community Manager"], ["member", "Team Member"], ["member", "Associate"]];
    for (const [bi, spec] of BUSINESSES.entries()) {
      if (await prisma.business.findUnique({ where: { slug: spec.slug } })) {
        console.log(`  skip business /b/${spec.slug} (exists)`);
        continue;
      }
      const pool = ranked(dots, spec.match, spec.city);
      const owner = pool.find((d) => !usedBusinessOwners.has(d.id)) ?? pool[0];
      usedBusinessOwners.add(owner.id);
      const team = pool.filter((d) => d.id !== owner.id && !usedBusinessOwners.has(d.id)).slice(0, between(1, 3));
      team.forEach((d) => usedBusinessOwners.add(d.id));
      const createdAt = new Date(Math.min(now - 7 * DAY, owner.createdAt.getTime() + between(1, 10) * DAY));

      const palette = PALETTES[(bi * 3 + 1) % PALETTES.length];
      writeFileSync(`public/uploads/biz-${spec.slug}.svg`, avatarSvg(initialsOf(spec.name), palette, bi));
      writeFileSync(`public/uploads/biz-${spec.slug}-cover.svg`, coverSvg(PALETTES[(bi * 5 + 6) % PALETTES.length], bi + 2));

      const hoursJson = JSON.stringify(Object.fromEntries(spec.days.map((d) => [d, [{ opens: spec.hours[0], closes: spec.hours[1] }]])));
      const slugStem = spec.slug.replace(/_/g, "");
      const business = await prisma.business.create({
        data: {
          slug: spec.slug,
          name: spec.name,
          tagline: spec.tagline,
          description: spec.description,
          category: spec.category,
          foundedYear: spec.foundedYear,
          sizeRange: spec.sizeRange,
          isVerified: spec.verified,
          status: "active",
          logoUrl: `/uploads/biz-${spec.slug}.svg`,
          coverUrl: `/uploads/biz-${spec.slug}-cover.svg`,
          createdBy: owner.id,
          createdAt,
          members: {
            create: [
              { userId: owner.id, role: "owner", title: "Founder", isPublic: true, joinedAt: createdAt },
              ...team.map((d, i) => ({ userId: d.id, role: teamRoles[i][0], title: teamRoles[i][1], isPublic: true, joinedAt: new Date(createdAt.getTime() + between(1, 20) * DAY) })),
            ],
          },
          contactInfo: {
            create: {
              email: `hello@${slugStem}.example`,
              phone: `+91 ${between(6, 9)}${String(int(1e9)).padStart(9, "0")}`,
              website: `https://${slugStem}.example`,
            },
          },
          locations: { create: [{ label: "Main location", address: spec.address, hoursJson }] },
          offerings: {
            create: spec.offerings.map((o, i) => ({
              kind: o.kind,
              name: o.name,
              description: o.description,
              price: o.price,
              currency: o.price === null ? null : "INR",
              status: "active",
              sku: o.kind === "product" ? `${slugStem.slice(0, 4).toUpperCase()}-${String(i + 1).padStart(3, "0")}` : null,
              stockStatus: o.kind === "product" ? (o.stock ?? "in_stock") : null,
              isBookable: o.kind === "service" ? false : null,
              createdAt,
            })),
          },
        },
      });
      totals.offerings += spec.offerings.length;

      // Reviews from customers (never the team), with the owner replying to a few.
      const teamIds = new Set([owner.id, ...team.map((t) => t.id)]);
      const reviewers = shuffle(dots.filter((d) => !teamIds.has(d.id))).slice(0, between(4, 12));
      const reviewRows = reviewers.map((d) => {
        const rating = chance(0.55) ? 5 : chance(0.75) ? 4 : 3;
        return { id: randomUUID(), businessId: business.id, authorId: d.id, rating, body: pick(REVIEW_BODIES[rating]), createdAt: new Date(now - between(1, 50) * DAY - int(DAY)) };
      });
      await prisma.review.createMany({ data: reviewRows });
      const responses = reviewRows.filter(() => chance(0.35)).map((r) => ({ reviewId: r.id, responderId: owner.id, body: pick(REVIEW_RESPONSES), createdAt: new Date(r.createdAt.getTime() + between(2, 48) * 60 * MIN) }));
      if (responses.length) await prisma.reviewResponse.createMany({ data: responses });
      const avg = reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length;
      await prisma.business.update({ where: { id: business.id }, data: { reviewCount: reviewRows.length, averageRating: Math.round(avg * 100) / 100 } });
      totals.reviews += reviewRows.length;

      // Business-authored posts (the acting user stays attributable via authorId) with likes.
      const others = dots.filter((d) => !teamIds.has(d.id));
      const bPosts: { id: string; authorId: string; businessAuthorId: string; body: string; createdAt: Date; likeCount: number }[] = [];
      const bLikes: { postId: string; userId: string; createdAt: Date }[] = [];
      for (const body of spec.posts) {
        const id = randomUUID();
        const postedAt = new Date(now - between(1, 40) * DAY - int(DAY));
        const likers = shuffle(others).slice(0, between(3, 25));
        likers.forEach((d) => bLikes.push({ postId: id, userId: d.id, createdAt: new Date(postedAt.getTime() + between(5, 4000) * MIN) }));
        bPosts.push({ id, authorId: owner.id, businessAuthorId: business.id, body, createdAt: postedAt, likeCount: likers.length });
      }
      await prisma.post.createMany({ data: bPosts });
      await prisma.postLike.createMany({ data: bLikes });
      totals.bPosts += bPosts.length;

      // An open job for some businesses, with a couple of applicants.
      if (spec.job) {
        const job = await prisma.job.create({
          data: {
            businessId: business.id,
            title: spec.job.title,
            description: spec.job.description,
            location: spec.job.remote ? null : spec.city,
            isRemote: spec.job.remote,
            employmentType: spec.job.type,
            salaryMin: spec.job.min,
            salaryMax: spec.job.max,
            status: "open",
            postedAt: new Date(now - between(2, 20) * DAY),
          },
        });
        const applicants = shuffle(others).slice(0, between(1, 3));
        await prisma.jobApplication.createMany({
          data: applicants.map((d) => ({
            jobId: job.id,
            applicantId: d.id,
            coverNote: "Hi! I'd love to be part of your team. Happy to share more about my experience whenever suits you.",
            status: chance(0.3) ? "reviewed" : "submitted",
            createdAt: new Date(now - between(1, 15) * DAY),
          })),
        });
        totals.jobs++;
      }
      totals.businesses++;
      console.log(`  business /b/${spec.slug}: ${team.length + 1} team, ${spec.offerings.length} offerings, ${reviewRows.length} reviews`);
    }

    console.log(
      `Done: ${totals.communities} communities (${totals.members} memberships, ${totals.cPosts} posts/replies), ` +
        `${totals.businesses} businesses (${totals.offerings} offerings, ${totals.reviews} reviews, ${totals.bPosts} posts, ${totals.jobs} jobs).`,
    );
    console.log(`Cleanup: DATABASE_URL="${url}" npx tsx scripts/delete-seed-users.ts   (or RESET=1 npx tsx scripts/seed-dots-orgs.ts)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
