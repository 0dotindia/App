import { randomUUID } from "crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { SEED_EMAIL_DOMAIN } from "./seed-dots-cleanup";

// Gives every dot a coin wallet, the same way the app does at signup, then adds extras:
//   1. Standard signup grants for @dot (the platform account) and all seeded dots:
//      1 coin "Signup bonus" + 6 coins launch promo, both in the restricted promo bucket,
//      expiring in 90 days (src/lib/wallet/grants.ts uses the same idempotency keys).
//   2. Extra spendable coins: an audited admin_adjustment per account (@dot 250, dots 5-60).
//   3. ~150 back-dated peer-to-peer transfers (with CoinTransfer rows and "coins received"
//      notifications) and ~50 coin tips (PaymentTransaction + Tip rows, 10% platform fee).
// Transfers/tips obey the app's limits (<=20 coins per transfer, <=100 coins and <=10
// recipients per sender per day, accounts >= 24h old) and never overdraw. Tips are paid
// from spendable coins only, so every account keeps its full 7 restricted coins.
//
// It writes ledger rows directly (the wallet lib is server-only), then recomputes each touched
// account's cachedBalance from its postings so balances always match the ledger.
// Run seed-dots.ts (and seed-dots-platform.ts) first.
//
// Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-wallet.ts            (idempotent for a given SEED)
//        SEED=4 PLATFORM_HANDLE=dot npx tsx scripts/seed-dots-wallet.ts   (different extras)
// Cleanup: delete-seed-users.ts / RESET=1 seed-dots.ts reverse the ledger rows that touch seeded
//          accounts. @dot's own grants and funding stay (like its announcement posts).

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const COIN = 100; // minor units per coin
const SYSTEM = {
  revenue: "00000000-0000-4000-8000-000000000001",
  promoIssuance: "00000000-0000-4000-8000-000000000002",
};
const FEE = 0.1; // PLATFORM_FEE_PERCENT
const SIGNUP_COINS = 1;
const LAUNCH_COINS = 6;
const GRANT_TTL_DAYS = 90;

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
const rand = mulberry32(Number(process.env.SEED ?? 4));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;
const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const TIP_MESSAGES = ["Loved this, keep going!", "Thanks for sharing your work 🙏", "Small thank-you for the great post.", "Coffee on me ☕", "Your tutorial saved me hours!", "Keep creating!", "", "", ""];

type Acct = { wallet: string; promo: string };
type LedgerTx = { id: string; kind: string; idempotencyKey: string; actorUserId: string | null; memo: string | null; relatedObjectType: string | null; relatedObjectId: string | null; expiresAt: Date | null; createdAt: Date };
type Posting = { id: string; transactionId: string; accountId: string; amount: number; createdAt: Date };

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  const handle = (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase();
  console.log(`Seeding wallets at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const now = Date.now();

  try {
    const sys = await prisma.ledgerAccount.count({ where: { id: { in: Object.values(SYSTEM) } } });
    if (sys !== 2) throw new Error("System ledger accounts missing — start the app once so they're created.");

    const platformName = await prisma.username.findUnique({ where: { handle }, select: { userId: true, user: { select: { email: true, createdAt: true } } } });
    if (!platformName) throw new Error(`No account with handle @${handle}.`);
    if (platformName.user.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) throw new Error(`@${handle} is a seeded dot, not the platform account.`);
    const P = platformName.userId;

    const seeded = await prisma.user.findMany({
      where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
      select: { id: true, createdAt: true, username: { select: { handle: true } }, profile: { select: { followerCount: true } } },
    });
    if (seeded.length === 0) throw new Error("No seeded dots found. Run scripts/seed-dots.ts first.");
    type U = { id: string; handle: string; createdAt: number; pop: number };
    const dotUser: U = { id: P, handle, createdAt: platformName.user.createdAt.getTime(), pop: 99 };
    const people: U[] = [dotUser, ...seeded.map((u) => ({ id: u.id, handle: u.username!.handle, createdAt: u.createdAt.getTime(), pop: (u.profile?.followerCount ?? 0) + 1 }))];
    const byId = new Map(people.map((u) => [u.id, u]));

    // ---------- accounts ----------
    const haveAcct = new Set((await prisma.ledgerAccount.findMany({ where: { ownerUserId: { in: people.map((u) => u.id) }, type: { in: ["user_wallet", "user_promo"] } }, select: { type: true, ownerUserId: true } })).map((a) => `${a.type}:${a.ownerUserId}`));
    const missingAccts = people.flatMap((u) => (["user_wallet", "user_promo"] as const).map((type) => ({ type, ownerUserId: u.id }))).filter((a) => !haveAcct.has(`${a.type}:${a.ownerUserId}`));
    if (missingAccts.length) await prisma.ledgerAccount.createMany({ data: missingAccts });
    const accts = new Map<string, Acct>();
    for (const a of await prisma.ledgerAccount.findMany({ where: { ownerUserId: { in: people.map((u) => u.id) }, type: { in: ["user_wallet", "user_promo"] } }, select: { id: true, type: true, ownerUserId: true } })) {
      const cur = accts.get(a.ownerUserId!) ?? { wallet: "", promo: "" };
      if (a.type === "user_wallet") cur.wallet = a.id;
      else cur.promo = a.id;
      accts.set(a.ownerUserId!, cur);
    }

    // ---------- ledger builders ----------
    const txs: LedgerTx[] = [];
    const postings: Posting[] = [];
    const touched = new Set<string>([SYSTEM.revenue, SYSTEM.promoIssuance]);
    const existingKeys = new Set((await prisma.ledgerTransaction.findMany({ where: { idempotencyKey: { startsWith: "signup_grant:" } }, select: { idempotencyKey: true } })).map((t) => t.idempotencyKey));
    for (const t of await prisma.ledgerTransaction.findMany({ where: { OR: [{ idempotencyKey: { startsWith: "launch_promo:" } }, { idempotencyKey: { startsWith: "seed_wallet:" } }] }, select: { idempotencyKey: true } })) existingKeys.add(t.idempotencyKey);
    const post = (t: Omit<LedgerTx, "id">, lines: [string, number][]): string | null => {
      if (existingKeys.has(t.idempotencyKey)) return null;
      existingKeys.add(t.idempotencyKey);
      const id = randomUUID();
      txs.push({ id, ...t });
      for (const [accountId, amount] of lines) {
        postings.push({ id: randomUUID(), transactionId: id, accountId, amount, createdAt: t.createdAt });
        touched.add(accountId);
      }
      return id;
    };
    const base = { actorUserId: null, relatedObjectType: null, relatedObjectId: null };

    // ---------- 1. standard signup grants ----------
    const expiresAt = new Date(now + GRANT_TTL_DAYS * DAY);
    let grants = 0;
    for (const u of people) {
      const a = accts.get(u.id)!;
      const when = new Date(u.createdAt + 60_000);
      const g1 = post({ ...base, kind: "signup_grant", idempotencyKey: `signup_grant:${u.id}`, memo: "Signup bonus", expiresAt, createdAt: when }, [[SYSTEM.promoIssuance, -SIGNUP_COINS * COIN], [a.promo, SIGNUP_COINS * COIN]]);
      const g2 = post({ ...base, kind: "promo_grant", idempotencyKey: `launch_promo:${u.id}`, memo: "launch", expiresAt, createdAt: new Date(when.getTime() + 1000) }, [[SYSTEM.promoIssuance, -LAUNCH_COINS * COIN], [a.promo, LAUNCH_COINS * COIN]]);
      if (g1 || g2) grants++;
    }

    // ---------- 2. extra spendable coins ----------
    const balance = new Map<string, number>(); // spendable coins, tracked while generating events
    const currentWallet = await prisma.ledgerPosting.groupBy({ by: ["accountId"], where: { accountId: { in: [...accts.values()].map((a) => a.wallet) } }, _sum: { amount: true } });
    const walletById = new Map(currentWallet.map((r) => [r.accountId, (r._sum.amount ?? 0) / COIN]));
    for (const u of people) balance.set(u.id, walletById.get(accts.get(u.id)!.wallet) ?? 0);
    let funded = 0;
    for (const u of people) {
      const coins = u.id === P ? 250 : Math.min(60, 5 + between(0, 25) + Math.floor(u.pop / 4));
      const when = new Date(Math.min(now - 10 * 60_000, Math.max(u.createdAt + 2 * DAY, now - between(30, 60) * DAY)));
      const id = post({ ...base, kind: "admin_adjustment", idempotencyKey: `seed_wallet:fund:${u.id}`, memo: "Seed: starter test funds", expiresAt: null, createdAt: when }, [[accts.get(u.id)!.wallet, coins * COIN], [SYSTEM.promoIssuance, -coins * COIN]]);
      if (id) {
        balance.set(u.id, (balance.get(u.id) ?? 0) + coins);
        funded++;
      }
    }

    // ---------- 3. transfers and tips, in chronological order ----------
    type Ev = { at: number; kind: "transfer" | "tip"; from: U; to: U; coins: number; n: number };
    const events: Ev[] = [];
    const pickWeighted = (exclude?: string): U => {
      const pool = seeded.length + 1;
      for (;;) {
        const u = people[int(pool)];
        if (u.id === exclude) continue;
        if (chance(Math.min(1, 0.25 + u.pop / 40))) return u;
      }
    };
    const runId = process.env.SEED ?? "4";
    const wanted = { transfer: 150, tip: 50 };
    for (const kind of ["transfer", "tip"] as const) {
      for (let n = 0; n < wanted[kind]; n++) {
        let from = pickWeighted();
        let to = pickWeighted(from.id);
        // @dot always takes part, within the app's rules: its account is new (transfers need a sender
        // account >= 24h old), so it only receives transfers, and it both sends and receives tips.
        if (kind === "transfer") {
          if (n < 8) { to = dotUser; from = pickWeighted(P); }
          else if (from.id === P) from = pickWeighted(P);
        } else if (n < 4) { from = dotUser; to = pickWeighted(P); }
        else if (n < 7) { to = dotUser; from = pickWeighted(P); }
        const coins = kind === "transfer" ? pick([1, 1, 2, 2, 3, 5, 5, 10, 15]) : pick([1, 1, 2, 3, 5]);
        const involvesDot = from.id === P || to.id === P;
        const earliest = Math.max(kind === "transfer" ? from.createdAt + DAY : from.createdAt, to.createdAt) + (involvesDot ? 30 * 60_000 : 2 * DAY);
        const latest = now - (involvesDot ? 20 * 60_000 : DAY);
        if (earliest >= latest) continue;
        events.push({ at: earliest + rand() * (latest - earliest), kind, from, to, coins, n });
      }
    }
    if ([...existingKeys].some((k) => k.startsWith(`seed_wallet:transfer:${runId}:`) || k.startsWith(`seed_wallet:tip:${runId}:`))) {
      console.log(`Transfers/tips for SEED=${runId} already exist; skipping them (use a different SEED for more).`);
      events.length = 0;
    }
    events.sort((a, b) => a.at - b.at);

    const dayKey = (t: number) => Math.floor(t / DAY);
    const sentToday = new Map<string, { coins: number; to: Set<string> }>();
    const notifs: { recipientId: string; actorId: string; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null }[] = [];
    const coinTransfers: { fromUserId: string; toUserId: string; amount: number; createdAt: Date }[] = [];
    const tipDefs: { ledgerId: string; from: string; to: string; amount: number; feeUsd: number; message: string; createdAt: Date }[] = [];
    let transfersMade = 0;
    let tipsMade = 0;
    for (const e of events) {
      if ((balance.get(e.from.id) ?? 0) < e.coins) continue; // never overdraw
      const at = new Date(e.at);
      const key = `${e.from.id}:${dayKey(e.at)}`;
      const day = sentToday.get(key) ?? { coins: 0, to: new Set<string>() };
      if (e.kind === "transfer") {
        if (e.coins > 20 || day.coins + e.coins > 100 || (!day.to.has(e.to.id) && day.to.size >= 10)) continue;
      }
      const a = accts.get(e.from.id)!;
      const b = accts.get(e.to.id)!;
      if (e.kind === "transfer") {
        const id = post({ ...base, kind: "transfer", idempotencyKey: `seed_wallet:transfer:${runId}:${e.n}`, actorUserId: e.from.id, relatedObjectType: "user", relatedObjectId: e.to.id, memo: null, expiresAt: null, createdAt: at }, [[a.wallet, -e.coins * COIN], [b.wallet, e.coins * COIN]]);
        if (!id) continue;
        coinTransfers.push({ fromUserId: e.from.id, toUserId: e.to.id, amount: e.coins, createdAt: at });
        notifs.push({ recipientId: e.to.id, actorId: e.from.id, type: "coins_received", subjectType: "user", subjectId: e.from.id, createdAt: at, readAt: chance(0.5) ? new Date(at.getTime() + between(1, 600) * 60_000) : null });
        day.coins += e.coins;
        day.to.add(e.to.id);
        sentToday.set(key, day);
        transfersMade++;
      } else {
        const feeUnits = Math.round(Math.round(e.coins * FEE * 100) / 100 * 100);
        const payeeUnits = e.coins * COIN - feeUnits;
        const id = post({ ...base, kind: "purchase", idempotencyKey: `seed_wallet:tip:${runId}:${e.n}`, actorUserId: e.from.id, relatedObjectType: "tip", relatedObjectId: null, memo: null, expiresAt: null, createdAt: at }, [[a.wallet, -e.coins * COIN], [SYSTEM.revenue, feeUnits], [b.wallet, payeeUnits]]);
        if (!id) continue;
        tipDefs.push({ ledgerId: id, from: e.from.id, to: e.to.id, amount: e.coins, feeUsd: Math.round(e.coins * FEE * 100) / 100, message: pick(TIP_MESSAGES), createdAt: at });
        notifs.push({ recipientId: e.to.id, actorId: e.from.id, type: "tip_received", subjectType: "user", subjectId: e.from.id, createdAt: at, readAt: chance(0.5) ? new Date(at.getTime() + between(1, 600) * 60_000) : null });
        tipsMade++;
      }
      balance.set(e.from.id, (balance.get(e.from.id) ?? 0) - e.coins);
      balance.set(e.to.id, (balance.get(e.to.id) ?? 0) + (e.kind === "transfer" ? e.coins : (e.coins * COIN - Math.round(Math.round(e.coins * FEE * 100) / 100 * 100)) / COIN));
    }

    // ---------- write ----------
    for (const part of chunk(txs, 400)) await prisma.ledgerTransaction.createMany({ data: part });
    for (const part of chunk(postings, 800)) await prisma.ledgerPosting.createMany({ data: part });
    for (const part of chunk(coinTransfers, 400)) await prisma.coinTransfer.createMany({ data: part });
    for (const t of tipDefs) {
      const pt = await prisma.paymentTransaction.create({
        data: { kind: "tip", payerId: t.from, payeeId: t.to, amount: t.amount, currency: "usd", platformFee: t.feeUsd, processor: "wallet", processorReference: t.ledgerId, status: "succeeded", relatedObjectType: "tip", createdAt: t.createdAt },
      });
      await prisma.ledgerTransaction.update({ where: { id: t.ledgerId }, data: { paymentTransactionId: pt.id } });
      await prisma.tip.create({ data: { fromUserId: t.from, toCreatorId: t.to, amount: t.amount, currency: "usd", message: t.message || null, paymentTransactionId: pt.id, createdAt: t.createdAt } });
    }
    for (const part of chunk(notifs, 400)) await prisma.notification.createMany({ data: part });

    // The ledger is the source of truth: recompute every touched account's cached balance from its postings.
    const sums = await prisma.ledgerPosting.groupBy({ by: ["accountId"], where: { accountId: { in: [...touched] } }, _sum: { amount: true } });
    for (const s of sums) await prisma.ledgerAccount.update({ where: { id: s.accountId }, data: { cachedBalance: s._sum.amount ?? 0 } });

    // ---------- report ----------
    const bal = await prisma.ledgerAccount.findMany({ where: { ownerUserId: { in: people.map((u) => u.id) }, type: { in: ["user_wallet", "user_promo"] } }, select: { type: true, cachedBalance: true, ownerUserId: true } });
    const spend = bal.filter((b) => b.type === "user_wallet" && b.ownerUserId !== P).map((b) => b.cachedBalance / COIN);
    const restricted = new Set(bal.filter((b) => b.type === "user_promo").map((b) => b.cachedBalance / COIN));
    const mine = bal.filter((b) => b.ownerUserId === P);
    console.log(`Grants: ${grants} accounts got the standard 7 coins. Funded: ${funded}. Transfers: ${transfersMade}. Tips: ${tipsMade}. Ledger rows: ${txs.length} txs, ${postings.length} postings.`);
    console.log(`@${handle}: spendable ${(mine.find((b) => b.type === "user_wallet")?.cachedBalance ?? 0) / COIN}, restricted ${(mine.find((b) => b.type === "user_promo")?.cachedBalance ?? 0) / COIN}.`);
    console.log(`Seeded dots: spendable min ${Math.min(...spend)} / avg ${(spend.reduce((s, x) => s + x, 0) / spend.length).toFixed(1)} / max ${Math.max(...spend)}; restricted values seen: ${[...restricted].join(", ")}.`);
    console.log("Cleanup: npx tsx scripts/delete-seed-users.ts (reverses ledger rows touching seeded accounts)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
