import { randomBytes, randomUUID } from "crypto";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Fills the event gaps the earlier seeds leave (seed-dots-jobs-events.ts, seed-showcase-org.ts):
//   1. Coin-paid tickets: a small USD "Coin pass" tier on ~10 upcoming user/business-hosted events,
//      bought with coins by seeded dots (and @dot) through the same escrow path the app uses
//      (purchaseTicket → placeHold → captureHold): a `hold` ledger transaction into system_escrow
//      (promo coins drawn first), a captured LedgerHold, a `hold_capture` transaction paying the host
//      (user or business wallet) minus the 10% fee (7% for a Premium payee), a `ticket_purchase`
//      PaymentTransaction with processor "wallet", the Ticket row, and a ticket_purchased notification.
//   2. Likes and comments on events (Reaction/Comment, subjectType "event"), with like/comment
//      notifications to the event's creator — the same rows toggleReaction/createComment write.
//   3. Missing lifecycle notifications: ticket_purchased for every seeded ticket without one, and
//      event_cancelled for everyone who RSVP'd going/interested or holds a live ticket to a
//      cancelled event (Phase 8 spec §8.4).
//   4. A voice room attached to one upcoming community-hosted event (VoiceRoom.eventId).
// Ledger rows are written directly (the wallet lib is server-only), then every touched account's
// cachedBalance is recomputed from its postings and the global sum-zero invariant is checked.
//
// Run after seed-dots.ts, seed-dots-orgs.ts, seed-dots-jobs-events.ts and seed-dots-wallet.ts.
// Safe to re-run: each part skips itself if its rows already exist.
// Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-event-extras.ts
//        SEED=3 PLATFORM_HANDLE=dot npx tsx scripts/seed-dots-event-extras.ts
// Cleanup: delete-seed-users.ts removes everything owned by seeded accounts (its ledger cleanup
// reverses the coin-ticket transactions); @dot's own coin tickets stay, like its other activity.

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

const SEED_EMAIL_DOMAIN = "seed.0dot.local";
const COIN = 100; // minor units per coin
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const FEE = 0.1; // PLATFORM_FEE_PERCENT
const PREMIUM_FEE = 0.07; // PREMIUM_CREATOR_PLATFORM_FEE_PERCENT
const COIN_PASS = "Coin pass";
const SYSTEM = {
  revenue: "00000000-0000-4000-8000-000000000001",
  escrow: "00000000-0000-4000-8000-000000000003",
};

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
const shuffle = <T,>(arr: readonly T[]): T[] => [...arr].sort(() => rand() - 0.5);
const chance = (p: number) => rand() < p;

const COMMENTS = [
  "Count me in! 🙌",
  "Is there parking near the venue?",
  "Will the session be recorded?",
  "Bringing two friends along.",
  "Loved the last one, can't wait.",
  "What time do doors open?",
  "Is this beginner friendly?",
  "Great lineup this time!",
  "See you all there.",
  "Can I join online if I can't make it in person?",
];

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed a non-local database (${url}). Set ALLOW_REMOTE=1 if you really mean it.`);
  }
  const handle = (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase();
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  console.log(`Seeding event extras at: ${url}`);
  const now = Date.now();
  const totals: Record<string, number> = {};
  const tally = (k: string, n = 1) => (totals[k] = (totals[k] ?? 0) + n);

  try {
    const dots = await prisma.user.findMany({ where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` }, status: "active" }, select: { id: true } });
    if (dots.length === 0) throw new Error("No seeded dots found — run seed-dots.ts first.");
    const platform = await prisma.username.findUnique({ where: { handle }, select: { userId: true } });
    const people = platform ? [...dots.map((d) => d.id), platform.userId] : dots.map((d) => d.id);

    // ---------- 1. Coin-paid tickets ----------
    if ((await prisma.ticketType.count({ where: { name: COIN_PASS } })) > 0) {
      console.log("Coin tickets already seeded — skipping part 1.");
    } else {
      const events = shuffle(
        await prisma.event.findMany({
          where: { status: "published", startsAt: { gt: new Date(now + DAY) }, hostedByCommunityId: null },
          select: { id: true, slug: true, capacity: true, createdBy: true, hostedByUserId: true, hostedByBusinessId: true, createdAt: true },
        }),
      ).slice(0, 10);

      // Balances tracked in memory so no purchase ever overdraws a bucket.
      const accounts = await prisma.ledgerAccount.findMany({
        where: { ownerUserId: { in: people }, type: { in: ["user_wallet", "user_promo"] } },
        select: { id: true, type: true, ownerUserId: true, cachedBalance: true },
      });
      const wallet = new Map<string, { id: string; bal: number }>();
      const promo = new Map<string, { id: string; bal: number }>();
      for (const a of accounts) (a.type === "user_wallet" ? wallet : promo).set(a.ownerUserId!, { id: a.id, bal: a.cachedBalance });

      const premiumUserIds = new Set(
        (
          await prisma.platformSubscription.findMany({
            where: { plan: "profile_premium", status: "active", subscriberProfileId: { not: null } },
            select: { subscriberProfile: { select: { userId: true } } },
          })
        ).map((s) => s.subscriberProfile!.userId),
      );

      async function payeeWalletId(tx: Prisma.TransactionClient, ev: (typeof events)[number]): Promise<string> {
        if (ev.hostedByBusinessId) {
          const existing = await tx.ledgerAccount.findUnique({ where: { type_ownerBusinessId: { type: "business_wallet", ownerBusinessId: ev.hostedByBusinessId } } });
          if (existing) return existing.id;
          await tx.ledgerAccount.create({ data: { type: "business_promo", ownerBusinessId: ev.hostedByBusinessId } });
          return (await tx.ledgerAccount.create({ data: { type: "business_wallet", ownerBusinessId: ev.hostedByBusinessId } })).id;
        }
        const hostId = ev.hostedByUserId ?? ev.createdBy;
        const existing = await tx.ledgerAccount.findUnique({ where: { type_ownerUserId: { type: "user_wallet", ownerUserId: hostId } } });
        if (existing) return existing.id;
        await tx.ledgerAccount.upsert({ where: { type_ownerUserId: { type: "user_promo", ownerUserId: hostId } }, create: { type: "user_promo", ownerUserId: hostId }, update: {} });
        return (await tx.ledgerAccount.create({ data: { type: "user_wallet", ownerUserId: hostId } })).id;
      }

      for (const ev of events) {
        const price = between(2, 6);
        const units = price * COIN;
        const hostUserId = ev.hostedByBusinessId ? null : (ev.hostedByUserId ?? ev.createdBy);
        const staff = ev.hostedByBusinessId
          ? new Set((await prisma.businessMember.findMany({ where: { businessId: ev.hostedByBusinessId }, select: { userId: true } })).map((m) => m.userId))
          : new Set([hostUserId!]);
        const feeRate = hostUserId && premiumUserIds.has(hostUserId) ? PREMIUM_FEE : FEE;
        const feeUnits = Math.round(price * feeRate * 100);
        const createdAt = new Date(Math.max(ev.createdAt.getTime(), now - 20 * DAY) + DAY);
        const tier = await prisma.ticketType.create({
          data: { eventId: ev.id, name: COIN_PASS, price, currency: "usd", quantityTotal: 25, createdAt },
        });
        tally("coinTiers");

        const goingRsvps = await prisma.eventRSVP.count({ where: { eventId: ev.id, status: "going" } });
        let seatsTaken = goingRsvps + (await prisma.ticket.count({ where: { ticketType: { eventId: ev.id }, status: { in: ["valid", "checked_in"] } } }));
        const buyers = shuffle(people.filter((id) => !staff.has(id))).slice(0, between(3, 7));

        for (const buyerId of buyers) {
          if (ev.capacity !== null && seatsTaken >= ev.capacity) break;
          const w = wallet.get(buyerId);
          const p = promo.get(buyerId);
          if (!w || !p || w.bal + p.bal < units) continue;
          const fromPromo = Math.min(Math.max(p.bal, 0), units);
          const fromWallet = units - fromPromo;
          const at = new Date(Math.min(now - 5 * MIN, createdAt.getTime() + between(1, 72) * 60 * MIN));
          const qrCodeToken = randomBytes(24).toString("hex");
          const idem = `seed_events:coin_ticket:${tier.id}:${buyerId}`;

          await prisma.$transaction(async (tx) => {
            const payeeWallet = await payeeWalletId(tx, ev);
            // hold: payer buckets → escrow (promo first), exactly like placeHold.
            const holdTxn = await tx.ledgerTransaction.create({
              data: {
                kind: "hold",
                idempotencyKey: idem,
                actorUserId: buyerId,
                relatedObjectType: "ticket",
                relatedObjectId: tier.id,
                metadataJson: JSON.stringify({ fromPromo, fromWallet, expiresAt: new Date(at.getTime() + 10 * MIN).toISOString() }),
                createdAt: at,
              },
            });
            const holdPostings: [string, number][] = [[SYSTEM.escrow, units]];
            if (fromPromo > 0) holdPostings.push([p.id, -fromPromo]);
            if (fromWallet > 0) holdPostings.push([w.id, -fromWallet]);
            await tx.ledgerPosting.createMany({ data: holdPostings.map(([accountId, amount]) => ({ transactionId: holdTxn.id, accountId, amount, createdAt: at })) });
            const hold = await tx.ledgerHold.create({
              data: { transactionId: holdTxn.id, state: "captured", expiresAt: new Date(at.getTime() + 10 * MIN), relatedObjectType: "ticket", relatedObjectId: tier.id, createdAt: at },
            });

            // capture: escrow → host wallet + platform fee, exactly like captureHold.
            const captureTxn = await tx.ledgerTransaction.create({
              data: { kind: "hold_capture", idempotencyKey: `hold_capture:${hold.id}`, actorUserId: buyerId, relatedObjectType: "ledger_hold", relatedObjectId: hold.id, createdAt: at },
            });
            await tx.ledgerPosting.createMany({
              data: [
                { transactionId: captureTxn.id, accountId: SYSTEM.escrow, amount: -units, createdAt: at },
                { transactionId: captureTxn.id, accountId: SYSTEM.revenue, amount: feeUnits, createdAt: at },
                { transactionId: captureTxn.id, accountId: payeeWallet, amount: units - feeUnits, createdAt: at },
              ],
            });
            const pt = await tx.paymentTransaction.create({
              data: {
                id: randomUUID(),
                kind: "ticket_purchase",
                payerId: buyerId,
                payeeId: hostUserId,
                payeeBusinessId: ev.hostedByBusinessId,
                amount: price,
                currency: "usd",
                platformFee: feeUnits / 100,
                processor: "wallet",
                processorReference: captureTxn.id,
                status: "succeeded",
                relatedObjectType: "ticket",
                createdAt: at,
              },
            });
            await tx.ledgerTransaction.update({ where: { id: captureTxn.id }, data: { paymentTransactionId: pt.id } });
            await tx.ticket.create({ data: { ticketTypeId: tier.id, ownerId: buyerId, status: "valid", qrCodeToken, paymentTransactionId: pt.id, createdAt: at } });
            await tx.ticketType.update({ where: { id: tier.id }, data: { quantitySold: { increment: 1 } } });
            await tx.notification.create({
              data: { recipientId: buyerId, actorId: null, type: "ticket_purchased", subjectType: "event", subjectId: ev.slug, createdAt: at, readAt: chance(0.6) ? new Date(at.getTime() + between(5, 300) * MIN) : null },
            });
          });

          p.bal -= fromPromo;
          w.bal -= fromWallet;
          seatsTaken += 1;
          tally("coinTickets");
          tally("coinsSpent", price);
        }
      }
    }

    // ---------- 2. Likes and comments on events ----------
    if ((await prisma.reaction.count({ where: { subjectType: "event" } })) > 0) {
      console.log("Event likes/comments already seeded — skipping part 2.");
    } else {
      const events = await prisma.event.findMany({
        where: { status: "published" },
        select: { id: true, slug: true, createdBy: true, createdAt: true, rsvps: { where: { status: { in: ["going", "interested"] } }, select: { userId: true } } },
      });
      for (const ev of events) {
        const engaged = ev.rsvps.map((r) => r.userId);
        const pool = shuffle([...new Set([...engaged, ...shuffle(people).slice(0, 10)])]).filter((id) => id !== ev.createdBy);
        const likers = pool.slice(0, Math.min(pool.length, between(4, 18)));
        const path = `e/${ev.slug}`;
        const base = Math.max(ev.createdAt.getTime(), now - 30 * DAY);
        const when = () => new Date(Math.min(now - MIN, base + between(1, 20 * 24 * 60) * MIN));
        for (const userId of likers) {
          const at = when();
          await prisma.reaction.create({ data: { subjectType: "event", subjectId: ev.id, userId, createdAt: at } });
          await prisma.notification.create({ data: { recipientId: ev.createdBy, actorId: userId, type: "like", subjectType: "event", subjectId: path, createdAt: at, readAt: chance(0.5) ? at : null } });
          tally("eventLikes");
        }
        const commenters = shuffle(engaged.length ? engaged : pool).filter((id) => id !== ev.createdBy).slice(0, between(0, 4));
        const lines = shuffle(COMMENTS); // distinct comments within one event
        for (const [i, authorId] of commenters.entries()) {
          const at = when();
          await prisma.comment.create({ data: { subjectType: "event", subjectId: ev.id, authorId, body: lines[i], createdAt: at } });
          await prisma.notification.create({ data: { recipientId: ev.createdBy, actorId: authorId, type: "comment", subjectType: "event", subjectId: path, createdAt: at, readAt: chance(0.5) ? at : null } });
          tally("eventComments");
        }
      }
    }

    // ---------- 3. Missing lifecycle notifications ----------
    const tickets = await prisma.ticket.findMany({
      select: { ownerId: true, createdAt: true, ticketType: { select: { event: { select: { slug: true } } } } },
    });
    const haveReceipt = new Set(
      (await prisma.notification.findMany({ where: { type: "ticket_purchased" }, select: { recipientId: true, subjectId: true } })).map((n) => `${n.recipientId}:${n.subjectId}`),
    );
    const receipts: Prisma.NotificationCreateManyInput[] = [];
    for (const t of tickets) {
      const key = `${t.ownerId}:${t.ticketType.event.slug}`;
      if (haveReceipt.has(key)) continue;
      haveReceipt.add(key);
      const old = now - t.createdAt.getTime() > 3 * DAY;
      receipts.push({ recipientId: t.ownerId, actorId: null, type: "ticket_purchased", subjectType: "event", subjectId: t.ticketType.event.slug, createdAt: t.createdAt, readAt: old || chance(0.5) ? new Date(t.createdAt.getTime() + between(1, 600) * MIN) : null });
    }
    if (receipts.length) await prisma.notification.createMany({ data: receipts });
    tally("ticketReceipts", receipts.length);

    const cancelled = await prisma.event.findMany({
      where: { status: "cancelled" },
      select: {
        slug: true,
        createdBy: true,
        updatedAt: true,
        rsvps: { where: { status: { in: ["going", "interested"] } }, select: { userId: true } },
        ticketTypes: { select: { tickets: { where: { status: { not: "cancelled" } }, select: { ownerId: true } } } },
      },
    });
    for (const ev of cancelled) {
      const already = new Set(
        (await prisma.notification.findMany({ where: { type: "event_cancelled", subjectId: ev.slug }, select: { recipientId: true } })).map((n) => n.recipientId),
      );
      const recipients = new Set([...ev.rsvps.map((r) => r.userId), ...ev.ticketTypes.flatMap((tt) => tt.tickets.map((t) => t.ownerId))]);
      const at = new Date(Math.min(now - MIN, ev.updatedAt.getTime()));
      const rows = [...recipients]
        .filter((id) => id !== ev.createdBy && !already.has(id))
        .map((recipientId) => ({ recipientId, actorId: ev.createdBy, type: "event_cancelled", subjectType: "event", subjectId: ev.slug, createdAt: at, readAt: chance(0.7) ? new Date(at.getTime() + between(5, 900) * MIN) : null }));
      if (rows.length) await prisma.notification.createMany({ data: rows });
      tally("cancellationNotices", rows.length);
    }

    // ---------- 4. A voice room attached to a community event ----------
    if ((await prisma.voiceRoom.count({ where: { eventId: { not: null } } })) > 0) {
      console.log("An event voice room already exists — skipping part 4.");
    } else {
      const candidates = await prisma.event.findMany({
        where: { status: "published", hostedByCommunityId: { not: null }, startsAt: { gt: new Date(now) }, livestreams: { none: {} } },
        select: { id: true, title: true, startsAt: true, createdBy: true, hostedByCommunityId: true },
        orderBy: { startsAt: "asc" },
      });
      for (const ev of candidates) {
        const staff = await prisma.communityMember.findFirst({
          where: { communityId: ev.hostedByCommunityId!, role: { in: ["owner", "moderator"] }, status: "active" },
          select: { userId: true },
          orderBy: { role: "asc" }, // "moderator" < "owner"; prefer the event's creator below when they're staff
        });
        const creatorIsStaff = await prisma.communityMember.findFirst({
          where: { communityId: ev.hostedByCommunityId!, userId: ev.createdBy, role: { in: ["owner", "moderator"] }, status: "active" },
          select: { userId: true },
        });
        const createdBy = creatorIsStaff?.userId ?? staff?.userId;
        if (!createdBy) continue;
        await prisma.voiceRoom.create({
          data: { communityId: ev.hostedByCommunityId!, title: `${ev.title} — live audio`, status: "scheduled", startsAt: ev.startsAt, createdBy, eventId: ev.id },
        });
        tally("eventVoiceRooms");
        break;
      }
    }

    // ---------- Ledger integrity ----------
    const sums = await prisma.ledgerPosting.groupBy({ by: ["accountId"], _sum: { amount: true } });
    for (const s of sums) await prisma.ledgerAccount.update({ where: { id: s.accountId }, data: { cachedBalance: s._sum.amount ?? 0 } });
    const global = (await prisma.ledgerPosting.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0;
    const negative = await prisma.ledgerAccount.count({ where: { cachedBalance: { lt: 0 }, OR: [{ ownerUserId: { not: null } }, { ownerBusinessId: { not: null } }] } });
    if (global !== 0 || negative > 0) throw new Error(`Ledger invariant broken: global sum ${global}, negative owner balances ${negative}`);

    console.log(`Done: ${Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing new"}. Ledger balanced.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
