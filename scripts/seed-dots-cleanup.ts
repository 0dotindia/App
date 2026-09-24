import type { PrismaClient } from "../src/generated/prisma/client";

// Shared by seed-dots.ts (RESET=1), seed-dots-platform.ts (UNDO=1) and
// delete-seed-users.ts. Seeded dots can be entangled with *non*-seed accounts
// (e.g. the platform account replying to a seeded post), and Post's reply/repost
// self-relations are NoAction — so those rows have to go before the seeded
// users do or the delete fails on a foreign key.

export const SEED_EMAIL_DOMAIN = "seed.0dot.local";

// Reaction/Comment are polymorphic (subjectType + subjectId, no FK), so when seeded articles, books,
// files or wiki pages go away their likes and comments (including the platform account's) stay behind.
export async function cleanupSeedContentReactions(prisma: PrismaClient, domain = SEED_EMAIL_DOMAIN): Promise<void> {
  const seedUser = { email: { endsWith: `@${domain}` } };
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

// LedgerAccount.owner is SetNull and LedgerPosting/LedgerTransaction are Restrict, so deleting seeded
// users would leave their ledger behind (and any tip/transfer with a non-seed account would leave
// that account's balance wrong). Reverse every ledger transaction that touches a seeded account:
// undo its effect on non-seed/system accounts, delete tips + payment rows, postings, transactions
// and finally the seeded accounts themselves. Transactions among only non-seed accounts stay.
export async function cleanupSeedWallet(prisma: PrismaClient, domain = SEED_EMAIL_DOMAIN): Promise<void> {
  const seedAccounts = (await prisma.ledgerAccount.findMany({ where: { owner: { email: { endsWith: `@${domain}` } } }, select: { id: true } })).map((a) => a.id);
  if (seedAccounts.length === 0) return;
  const seedSet = new Set(seedAccounts);
  const touching = await prisma.ledgerPosting.findMany({ where: { accountId: { in: seedAccounts } }, select: { transactionId: true }, distinct: ["transactionId"] });
  const txIds = touching.map((t) => t.transactionId);
  for (let i = 0; i < txIds.length; i += 500) {
    const part = txIds.slice(i, i + 500);
    const others = (await prisma.ledgerPosting.findMany({ where: { transactionId: { in: part } }, select: { accountId: true, amount: true } })).filter((p) => !seedSet.has(p.accountId));
    const delta = new Map<string, number>();
    for (const p of others) delta.set(p.accountId, (delta.get(p.accountId) ?? 0) + p.amount);
    for (const [accountId, amount] of delta) await prisma.ledgerAccount.update({ where: { id: accountId }, data: { cachedBalance: { decrement: amount } } });
    const ptIds = (await prisma.ledgerTransaction.findMany({ where: { id: { in: part }, paymentTransactionId: { not: null } }, select: { paymentTransactionId: true } })).map((t) => t.paymentTransactionId!);
    if (ptIds.length) {
      await prisma.tip.deleteMany({ where: { paymentTransactionId: { in: ptIds } } });
      await prisma.paymentTransaction.deleteMany({ where: { id: { in: ptIds } } });
    }
    await prisma.ledgerPosting.deleteMany({ where: { transactionId: { in: part } } });
    await prisma.ledgerTransaction.deleteMany({ where: { id: { in: part } } });
  }
  await prisma.ledgerAccount.deleteMany({ where: { id: { in: seedAccounts } } });
}

// Card-payment rows (PaymentTransaction) reference their purchase/tip/donation/conversion rows with
// Restrict, and a payer is only SetNull on delete, so payments between a seeded and a non-seed account
// (e.g. @dot buying a seeded creator's product) would be left dangling. Delete every payment that
// involves a seeded payer, payee or business — plus affiliate commissions credited on seeded programs —
// together with the rows that point at it.
export async function cleanupSeedMonetization(prisma: PrismaClient, opts: { cardOnly?: boolean } = {}, domain = SEED_EMAIL_DOMAIN): Promise<void> {
  const seedUser = { email: { endsWith: `@${domain}` } };
  const links = (await prisma.affiliateLink.findMany({ where: { OR: [{ affiliate: seedUser }, { program: { creator: seedUser } }] }, select: { id: true } })).map((l) => l.id);
  const ids = (
    await prisma.paymentTransaction.findMany({
      where: {
        OR: [{ payer: seedUser }, { payee: seedUser }, { payeeBusiness: { creator: seedUser } }, { relatedObjectType: "affiliate_link", relatedObjectId: { in: links } }],
        // cardOnly (used by seed-dots-monetization.ts RESET) keeps coin-wallet payments that seed-dots-wallet.ts owns
        ...(opts.cardOnly ? { processor: "stripe_connect" } : {}),
      },
      select: { id: true },
    })
  ).map((p) => p.id);
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500);
    const ref = { paymentTransactionId: { in: part } };
    await prisma.tip.deleteMany({ where: ref });
    await prisma.digitalProductPurchase.deleteMany({ where: ref });
    await prisma.offeringPurchase.deleteMany({ where: ref });
    await prisma.affiliateConversion.deleteMany({ where: ref });
    await prisma.donation.deleteMany({ where: ref });
    await prisma.courseAccessGrant.deleteMany({ where: ref });
    await prisma.ticket.deleteMany({ where: ref });
    await prisma.marketplacePurchase.deleteMany({ where: ref });
    await prisma.paymentTransaction.deleteMany({ where: { id: { in: part } } });
  }
}

// Job notifications carry no FK either: an alert-match/application/status notification for a non-seed
// account (e.g. @dot's job alert) would keep pointing at a seeded business's deleted job.
export async function cleanupSeedJobNotifications(prisma: PrismaClient, domain = SEED_EMAIL_DOMAIN): Promise<void> {
  const slugs = (await prisma.business.findMany({ where: { creator: { email: { endsWith: `@${domain}` } } }, select: { slug: true } })).map((b) => b.slug);
  for (const slug of slugs) {
    await prisma.notification.deleteMany({ where: { type: { in: ["job_alert_match", "job_application", "application_status"] }, subjectId: { startsWith: `${slug}/jobs/` } } });
  }
}

export async function cleanupBeforeSeedDelete(prisma: PrismaClient, domain = SEED_EMAIL_DOMAIN): Promise<void> {
  await cleanupSeedJobNotifications(prisma, domain);
  await cleanupSeedContentReactions(prisma, domain);
  await cleanupSeedWallet(prisma, domain);
  await cleanupSeedMonetization(prisma, {}, domain);
  const seedAuthor = { author: { email: { endsWith: `@${domain}` } } };
  const nonSeedAuthor = { author: { email: { not: { endsWith: `@${domain}` } } } };

  // Non-seed replies/quotes/reposts pointing at seeded posts (replies-to-replies first). Reply chains can
  // alternate authors (seed post <- non-seed reply <- seed reply-back), so peel leaves from both sides:
  // seed replies under non-seed posts go first (they'd be cascade-deleted anyway), then non-seed dependents.
  for (let depth = 0; depth < 8; depth++) {
    const seedLeaves = await prisma.post.deleteMany({
      where: { ...seedAuthor, replyTo: nonSeedAuthor, replies: { none: {} }, reposts: { none: {} } },
    });
    const { count } = await prisma.post.deleteMany({
      where: {
        ...nonSeedAuthor,
        OR: [{ replyTo: seedAuthor }, { repostOf: seedAuthor }],
        replies: { none: {} },
        reposts: { none: {} },
      },
    });
    if (count === 0 && seedLeaves.count === 0) break;
  }

  // Ghost notifications: a seed actor is SetNull on delete, which would leave
  // dangling "someone liked your post" rows for real accounts.
  await prisma.notification.deleteMany({
    where: {
      actor: { email: { endsWith: `@${domain}` } },
      recipient: { email: { not: { endsWith: `@${domain}` } } },
    },
  });

  // DM threads between a seeded and a non-seed account would be left with one participant.
  await prisma.conversation.deleteMany({
    where: {
      participants: { some: { user: { email: { endsWith: `@${domain}` } } } },
      AND: [{ participants: { some: { user: { email: { not: { endsWith: `@${domain}` } } } } } }],
    },
  });
}

// Denormalised counters on non-seed accounts go stale once seeded rows vanish;
// recompute them from the real rows.
export async function recountNonSeed(prisma: PrismaClient, domain = SEED_EMAIL_DOMAIN): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { not: { endsWith: `@${domain}` } }, profile: { isNot: null } },
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
