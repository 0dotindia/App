import type { PrismaClient } from "../src/generated/prisma/client";

// Shared by seed-dots.ts (RESET=1), seed-dots-platform.ts (UNDO=1) and
// delete-seed-users.ts. Seeded dots can be entangled with *non*-seed accounts
// (e.g. the platform account replying to a seeded post), and Post's reply/repost
// self-relations are NoAction — so those rows have to go before the seeded
// users do or the delete fails on a foreign key.

export const SEED_EMAIL_DOMAIN = "seed.0dot.local";

// Reaction/Comment are polymorphic (subjectType + subjectId, no FK), so when seeded articles, books,
// files or wiki pages go away their likes and comments (including the platform account's) stay behind.
export async function cleanupSeedContentReactions(prisma: PrismaClient): Promise<void> {
  const seedUser = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };
  const rows = await Promise.all([
    prisma.article.findMany({ where: { author: seedUser }, select: { id: true } }),
    prisma.book.findMany({ where: { profile: { user: seedUser } }, select: { id: true } }),
    prisma.publishedFile.findMany({ where: { profile: { user: seedUser } }, select: { id: true } }),
    prisma.wikiPage.findMany({ where: { OR: [{ profile: { user: seedUser } }, { community: { creator: seedUser } }, { book: { profile: { user: seedUser } } }] }, select: { id: true } }),
  ]);
  const ids = rows.flat().map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500);
    await prisma.reaction.deleteMany({ where: { subjectId: { in: part } } });
    await prisma.comment.deleteMany({ where: { subjectId: { in: part } } });
  }
}

export async function cleanupBeforeSeedDelete(prisma: PrismaClient): Promise<void> {
  await cleanupSeedContentReactions(prisma);
  const seedAuthor = { author: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } };
  const nonSeedAuthor = { author: { email: { not: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } } };

  // Non-seed replies/quotes/reposts pointing at seeded posts (replies-to-replies first).
  for (let depth = 0; depth < 4; depth++) {
    const { count } = await prisma.post.deleteMany({
      where: {
        ...nonSeedAuthor,
        OR: [{ replyTo: seedAuthor }, { repostOf: seedAuthor }],
        replies: { none: {} },
        reposts: { none: {} },
      },
    });
    if (count === 0) break;
  }

  // Ghost notifications: a seed actor is SetNull on delete, which would leave
  // dangling "someone liked your post" rows for real accounts.
  await prisma.notification.deleteMany({
    where: {
      actor: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
      recipient: { email: { not: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } },
    },
  });

  // DM threads between a seeded and a non-seed account would be left with one participant.
  await prisma.conversation.deleteMany({
    where: {
      participants: { some: { user: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } } },
      AND: [{ participants: { some: { user: { email: { not: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } } } } }],
    },
  });
}

// Denormalised counters on non-seed accounts go stale once seeded rows vanish;
// recompute them from the real rows.
export async function recountNonSeed(prisma: PrismaClient): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { not: { endsWith: `@${SEED_EMAIL_DOMAIN}` } }, profile: { isNot: null } },
    select: { id: true },
  });
  for (const u of users) {
    const [followerCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followeeId: u.id, status: "accepted" } }),
      prisma.follow.count({ where: { followerId: u.id, status: "accepted" } }),
    ]);
    await prisma.profile.update({ where: { userId: u.id }, data: { followerCount, followingCount } });
    const posts = await prisma.post.findMany({ where: { authorId: u.id, deletedAt: null }, select: { id: true } });
    for (const p of posts) {
      const [likeCount, replyCount, repostCount] = await Promise.all([
        prisma.postLike.count({ where: { postId: p.id } }),
        prisma.post.count({ where: { replyToId: p.id, deletedAt: null } }),
        prisma.post.count({ where: { repostOfId: p.id, deletedAt: null } }),
      ]);
      await prisma.post.update({ where: { id: p.id }, data: { likeCount, replyCount, repostCount } });
    }
  }
}
