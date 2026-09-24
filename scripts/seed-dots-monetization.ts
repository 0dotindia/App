import { randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PALETTES, avatarSvg } from "./seed-dots-art";
import { SEED_EMAIL_DOMAIN, cleanupSeedMonetization } from "./seed-dots-cleanup";
import { PEOPLE, type RoleKey } from "./seed-dots-data";
import { BOOKING_NOTES, CAMPAIGNS, DONATION_MESSAGES, PLATFORM, PRODUCTS, SERVICES, TIER_NAMES, TIER_PERKS, TIP_NOTES } from "./seed-dots-monetization-data";

// Monetization for the seeded dots (seed-dots.ts) and the platform account (@dot), recorded the way
// the app records real card payments (PaymentTransaction rows, processor stripe_connect, 10% fee, 7% for
// Premium payees) with stub payout accounts:
//   payout accounts, membership tiers + subscriptions + recurring charges + members-only posts,
//   digital products + purchases, affiliate programs/links/clicks/conversions (+ commissions),
//   bookable services + availability + appointments + purchases, business sales (INR),
//   fundraising campaigns + donations, card tips, Premium subscriptions (people and businesses).
// @dot has its own tiers and products, subscribes, buys, donates, tips, books and earns an
// affiliate commission. Run seed-dots.ts, seed-dots-orgs.ts and seed-dots-content.ts first.
//
// Limits: no real payments (stub processor). Product files have placeholder protected/ keys (no
// downloads). Everything belonging to seeded accounts is reversed by cleanupSeedMonetization().
// Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-monetization.ts          (skips if seeded monetization exists)
//        RESET=1 npx tsx scripts/seed-dots-monetization.ts   (wipe seeded monetization first, then reseed)
//        SEED=6 PLATFORM_HANDLE=dot npx tsx scripts/seed-dots-monetization.ts

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const STD_FEE = 0.1;
const PREMIUM_FEE = 0.07;

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
const rand = mulberry32(Number(process.env.SEED ?? 6));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T,>(arr: readonly T[]): T[] => [...arr].sort(() => rand() - 0.5);
const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const round2 = (n: number) => Math.round(n * 100) / 100;
const hex = (n = 8) => randomBytes(n).toString("hex");

type U = { id: string; handle: string; createdAt: number; pop: number; role: RoleKey | "platform"; profileId: string; first: string };

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  const handle = (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase();
  console.log(`Seeding monetization at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const now = Date.now();
  const seedUser = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };

  try {
    const platformName = await prisma.username.findUnique({ where: { handle }, select: { userId: true, user: { select: { createdAt: true, profile: { select: { id: true } } } } } });
    if (!platformName) throw new Error(`No account with handle @${handle}.`);
    const P = platformName.userId;

    // ---------- RESET ----------
    if (process.env.RESET === "1") {
      await cleanupSeedMonetization(prisma, { cardOnly: true });
      await prisma.post.deleteMany({ where: { author: seedUser, requiredTierId: { not: null } } });
      await Promise.all([
        prisma.appointment.deleteMany({ where: { OR: [{ seller: seedUser }, { customer: seedUser }] } }),
        prisma.fundraisingCampaign.deleteMany({ where: { OR: [{ organizerUser: seedUser }, { organizerBusiness: { creator: seedUser } }] } }),
        prisma.affiliateProgram.deleteMany({ where: { creator: seedUser } }),
        prisma.affiliateLink.deleteMany({ where: { affiliate: seedUser } }),
        prisma.platformSubscription.deleteMany({ where: { OR: [{ subscriberProfile: { user: seedUser } }, { subscriberBusiness: { creator: seedUser } }] } }),
        prisma.availabilityRule.deleteMany({ where: { seller: seedUser } }),
      ]);
      await prisma.offering.deleteMany({ where: { seller: seedUser } });
      await prisma.digitalProduct.deleteMany({ where: { creator: seedUser } });
      await prisma.membershipTier.deleteMany({ where: { creator: seedUser } });
      await prisma.creatorPayoutAccount.deleteMany({ where: { OR: [{ user: seedUser }, { business: { creator: seedUser } }] } });
      await prisma.notification.deleteMany({ where: { type: { in: ["new_subscriber", "affiliate_conversion", "appointment_request", "appointment_confirmed", "appointment_cancelled"] }, OR: [{ recipient: seedUser }, { actor: seedUser }] } });
      // @dot's own catalogue from this script (recognised by its fixed titles) goes too.
      const ownTiers = PLATFORM.tiers.map((t) => t[0]);
      const ownProducts = PLATFORM.products.map((p) => p[0]);
      await prisma.affiliateProgram.deleteMany({ where: { creatorId: P } });
      await prisma.membershipTier.deleteMany({ where: { creatorId: P, name: { in: ownTiers } } });
      await prisma.digitalProduct.deleteMany({ where: { creatorId: P, title: { in: ownProducts } } });
      await prisma.post.deleteMany({ where: { authorId: P, body: { startsWith: "Members-only:" } } });
      console.log("RESET: removed seeded monetization.");
    }
    if ((await prisma.membershipTier.count({ where: { creator: seedUser } })) > 0) {
      console.log("Seeded monetization already exists. Re-run with RESET=1 to rebuild it.");
      return;
    }

    // ---------- people ----------
    const roleByName = new Map(PEOPLE.map(([first, last, , , role]) => [`${first} ${last}`, role]));
    const seededRows = await prisma.user.findMany({
      where: seedUser,
      select: { id: true, createdAt: true, username: { select: { handle: true } }, profile: { select: { id: true, displayName: true, followerCount: true } } },
    });
    if (seededRows.length === 0) throw new Error("No seeded dots found. Run scripts/seed-dots.ts first.");
    const dots: U[] = seededRows.map((u) => ({
      id: u.id, handle: u.username!.handle, createdAt: u.createdAt.getTime(), pop: (u.profile?.followerCount ?? 0) + 1,
      role: roleByName.get(u.profile!.displayName)!, profileId: u.profile!.id, first: u.profile!.displayName.split(" ")[0],
    }));
    const dotUser: U = { id: P, handle, createdAt: platformName.user.createdAt.getTime(), pop: 120, role: "platform", profileId: platformName.user.profile!.id, first: "0dot" };
    const everyone = [dotUser, ...dots];
    const rankBy = (list: U[]) => [...list].sort((a, b) => b.pop * (0.5 + rand()) - a.pop * (0.5 + rand()));
    const byRole = (role: RoleKey) => rankBy(dots.filter((d) => d.role === role));
    const notSelf = (u: U) => everyone.filter((o) => o.id !== u.id);
    const pickPeople = (exclude: U, n: number, includeDot = false) => shuffle(includeDot ? notSelf(exclude) : dots.filter((d) => d.id !== exclude.id)).slice(0, n);
    // A believable timestamp after both parties exist (an account created an hour ago can only have recent activity).
    const when = (a: U, b: U | null, maxDaysBack = 90, latestDaysBack = 0) => {
      const lo = Math.max(a.createdAt, b?.createdAt ?? 0) + 10 * MIN;
      const hi = now - Math.max(5 * MIN, latestDaysBack * DAY);
      const from = Math.max(lo, now - maxDaysBack * DAY);
      return new Date(from >= hi ? Math.max(lo, hi - MIN) : from + rand() * (hi - from));
    };
    const seedBusinesses = await prisma.business.findMany({
      where: { creator: seedUser, status: "active" },
      select: { id: true, slug: true, createdBy: true, createdAt: true, offerings: { where: { status: "active", price: { not: null } }, select: { id: true, price: true, currency: true, kind: true } } },
    });

    // ---------- payment + notification collectors ----------
    const premiumIds = new Set<string>();
    type PTRow = { id: string; kind: string; payerId: string | null; payeeId: string | null; payeeBusinessId: string | null; amount: number; currency: string; platformFee: number; processor: string; processorReference: string; status: string; relatedObjectType: string | null; relatedObjectId: string | null; createdAt: Date };
    const pts: PTRow[] = [];
    const pay = (o: { kind: string; payer: string | null; payee?: string | null; business?: string | null; amount: number; currency?: string; related?: [string, string]; at: Date; ref?: string; status?: string }): PTRow => {
      const hasPayee = Boolean(o.payee || o.business);
      const rate = o.payee && premiumIds.has(o.payee) ? PREMIUM_FEE : STD_FEE;
      const row: PTRow = {
        id: randomUUID(), kind: o.kind, payerId: o.payer, payeeId: o.payee ?? null, payeeBusinessId: o.business ?? null,
        amount: o.amount, currency: o.currency ?? "usd", platformFee: hasPayee ? round2(o.amount * rate) : o.amount, processor: "stripe_connect",
        processorReference: o.ref ?? `pi_seed_${hex(10)}`, status: o.status ?? "succeeded", relatedObjectType: o.related?.[0] ?? null, relatedObjectId: o.related?.[1] ?? null, createdAt: o.at,
      };
      pts.push(row);
      return row;
    };
    type NotifRow = { recipientId: string; actorId: string; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null };
    const notifs: NotifRow[] = [];
    const notify = (recipientId: string, actorId: string, type: string, subjectType: string, subjectId: string, at: Date) =>
      notifs.push({ recipientId, actorId, type, subjectType, subjectId, createdAt: at, readAt: chance(0.5) ? new Date(at.getTime() + between(2, 900) * MIN) : null });
    const payees = new Set<string>([P]); // users who need a payout account
    const totals: Record<string, number> = {};
    const tally = (k: string, n = 1) => (totals[k] = (totals[k] ?? 0) + n);
    mkdirSync("public/uploads", { recursive: true });

    // ================= Premium subscriptions =================
    const premiumDots = rankBy(dots).slice(0, 16);
    premiumDots.forEach((d) => premiumIds.add(d.id));
    const platformSubs: Record<string, unknown>[] = [];
    for (const d of premiumDots) {
      const yearly = chance(0.3);
      const startedAt = when(d, null, 60, 5);
      const cycles = yearly ? 1 : Math.max(1, Math.min(3, Math.floor((now - startedAt.getTime()) / (30 * DAY)) + 1));
      platformSubs.push({ subscriberType: "profile", subscriberProfileId: d.profileId, plan: "profile_premium", status: "active", billingInterval: yearly ? "yearly" : "monthly", processorSubscriptionId: `sub_seed_${hex(8)}`, currentPeriodEnd: new Date(startedAt.getTime() + cycles * (yearly ? 365 : 30) * DAY + 30 * DAY), createdAt: startedAt });
      for (let i = 0; i < cycles; i++) pay({ kind: "platform_subscription_charge", payer: d.id, amount: yearly ? 60 : 6, related: ["platform_subscription", d.id], at: new Date(Math.min(now - MIN, startedAt.getTime() + i * 30 * DAY)) });
    }
    for (const b of shuffle(seedBusinesses).slice(0, 5)) {
      const owner = everyone.find((u) => u.id === b.createdBy)!;
      const startedAt = new Date(Math.max(b.createdAt.getTime() + DAY, now - between(20, 70) * DAY));
      const cycles = Math.max(1, Math.min(3, Math.floor((now - startedAt.getTime()) / (30 * DAY)) + 1));
      platformSubs.push({ subscriberType: "business", subscriberBusinessId: b.id, plan: "business_subscription", status: "active", billingInterval: "monthly", processorSubscriptionId: `sub_seed_${hex(8)}`, currentPeriodEnd: new Date(startedAt.getTime() + cycles * 30 * DAY + 30 * DAY), createdAt: startedAt });
      for (let i = 0; i < cycles; i++) pay({ kind: "platform_subscription_charge", payer: owner.id, amount: 20, related: ["platform_subscription", b.id], at: new Date(Math.min(now - MIN, startedAt.getTime() + i * 30 * DAY)) });
    }
    tally("premiumSubs", platformSubs.length);

    // ================= Membership tiers =================
    type Tier = { id: string; creator: U; name: string; level: number; price: number; interval: string };
    const tierCreators: U[] = [dotUser];
    for (const role of Object.keys(TIER_PERKS) as RoleKey[]) tierCreators.push(...byRole(role).slice(0, between(1, 2)));
    const tiers: Tier[] = [];
    const tierRows: Record<string, unknown>[] = [];
    for (const c of tierCreators) {
      const perks = c.role === "platform" ? null : TIER_PERKS[c.role as RoleKey]!;
      const created = new Date(Math.min(now - 30 * MIN, c.createdAt + between(1, 10) * DAY));
      const def: [string, number, string, string][] = perks
        ? (() => { const base = pick([3, 5]); const p = [base, Math.round(base * 2.5), base * 6]; const yearly3 = chance(0.3);
            return [[TIER_NAMES[0], p[0], "monthly", `Get ${perks[0]}.`], [TIER_NAMES[1], p[1], "monthly", `Everything in ${TIER_NAMES[0]}, plus ${perks[1]}.`], [TIER_NAMES[2], yearly3 ? p[2] * 10 : p[2], yearly3 ? "yearly" : "monthly", `Everything in ${TIER_NAMES[1]}, plus ${perks[2]}.`]] as [string, number, string, string][]; })()
        : PLATFORM.tiers.map(([n, p, d]) => [n, p, "monthly", d] as [string, number, string, string]);
      def.forEach(([name, price, interval, description], i) => {
        const id = randomUUID();
        tiers.push({ id, creator: c, name, level: i + 1, price, interval });
        tierRows.push({ id, creatorId: c.id, name, level: i + 1, price, currency: "usd", billingInterval: interval, description, status: "active", createdAt: created });
      });
      payees.add(c.id);
    }
    tally("tiers", tierRows.length);

    // Subscriptions + recurring charges.
    const subRows: Record<string, unknown>[] = [];
    const firstCharges: { tierCreatorId: string; tierId: string; ref: string; amount: number; at: Date; fanId: string }[] = [];
    for (const c of tierCreators) {
      const ct = tiers.filter((t) => t.creator.id === c.id);
      const nSubs = c.id === P ? 14 : Math.min(dots.length - 1, between(2, 4) + Math.floor(c.pop / 6) + int(4));
      const fans = pickPeople(c, nSubs, c.id !== P);
      for (const fan of fans) {
        if (fan.id === c.id) continue;
        const r = rand();
        const tier = ct[r < 0.6 ? 0 : r < 0.88 ? 1 : 2];
        const startedAt = when(fan, c, 120, 1);
        const status = chance(0.88) ? "active" : chance(0.65) ? "cancelled" : "past_due";
        const stepMs = (tier.interval === "yearly" ? 365 : 30) * DAY;
        const cycles = Math.max(1, Math.min(4, Math.floor((now - startedAt.getTime()) / stepMs) + 1));
        const paidCycles = status === "cancelled" ? Math.max(1, cycles - 1) : cycles;
        for (let i = 0; i < paidCycles; i++) {
          const at = new Date(Math.min(now - MIN, startedAt.getTime() + i * stepMs));
          const row = pay({ kind: "membership_charge", payer: fan.id, payee: c.id, amount: tier.price, related: ["membership_tier", tier.id], at });
          if (i === 0) firstCharges.push({ tierCreatorId: c.id, tierId: tier.id, ref: row.processorReference, amount: tier.price, at, fanId: fan.id });
        }
        const periodEnd = status === "cancelled" ? new Date(startedAt.getTime() + paidCycles * stepMs) : new Date(startedAt.getTime() + cycles * stepMs);
        subRows.push({ tierId: tier.id, fanId: fan.id, status, currentPeriodEnd: status === "active" && periodEnd.getTime() < now ? new Date(now + 5 * DAY) : periodEnd, processorSubscriptionId: `sub_seed_${hex(8)}`, createdAt: startedAt });
        notify(c.id, fan.id, "new_subscriber", "user", fan.id, startedAt);
      }
    }
    // @dot becomes a member of three seeded creators' first tier.
    for (const c of shuffle(tierCreators.filter((x) => x.id !== P)).slice(0, 3)) {
      const tier = tiers.find((t) => t.creator.id === c.id && t.level === 1)!;
      if (subRows.some((r) => r.tierId === tier.id && r.fanId === P)) continue;
      const startedAt = when(dotUser, c, 1);
      const row = pay({ kind: "membership_charge", payer: P, payee: c.id, amount: tier.price, related: ["membership_tier", tier.id], at: startedAt });
      firstCharges.push({ tierCreatorId: c.id, tierId: tier.id, ref: row.processorReference, amount: tier.price, at: startedAt, fanId: P });
      subRows.push({ tierId: tier.id, fanId: P, status: "active", currentPeriodEnd: new Date(startedAt.getTime() + (tier.interval === "yearly" ? 365 : 30) * DAY), processorSubscriptionId: `sub_seed_${hex(8)}`, createdAt: startedAt });
      notify(c.id, P, "new_subscriber", "user", P, startedAt);
    }
    tally("memberships", subRows.length);

    // ================= Digital products =================
    type Product = { id: string; creator: U; title: string; price: number };
    const productCreators: U[] = [dotUser];
    for (const role of Object.keys(PRODUCTS) as RoleKey[]) productCreators.push(...byRole(role).slice(0, between(1, 2)));
    const products: Product[] = [];
    const productRows: Record<string, unknown>[] = [];
    for (const c of productCreators) {
      const templates = c.role === "platform" ? PLATFORM.products.map(([t, d, p]) => [t, d, p] as const) : shuffle(PRODUCTS[c.role as RoleKey]!).slice(0, between(1, 2));
      for (const [title, description, price] of templates) {
        const id = randomUUID();
        writeFileSync(`public/uploads/product-${id}.svg`, avatarSvg(title.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(), PALETTES[int(PALETTES.length)], int(3)));
        const size = between(300, 6000) * 1024;
        products.push({ id, creator: c, title, price });
        productRows.push({ id, creatorId: c.id, title, description, coverImageUrl: `/uploads/product-${id}.svg`, price, currency: "usd", fileKey: `protected/${hex(16)}.pdf`, fileMimeType: "application/pdf", fileSizeBytes: size, status: "active", createdAt: new Date(Math.min(now - 30 * MIN, c.createdAt + between(2, 20) * DAY)) });
        payees.add(c.id);
      }
    }
    const purchaseRows: { productId: string; buyerId: string; ptId: string; at: Date }[] = [];
    const productSales = new Map<string, { ptRef: string; amount: number; at: Date; buyerId: string }[]>();
    for (const p of products) {
      const c = p.creator;
      const buyers = pickPeople(c, c.id === P ? 12 : between(1, 10) + Math.floor(c.pop / 8), c.id !== P);
      for (const buyer of buyers) {
        const at = when(buyer, c, 100, 0);
        const row = pay({ kind: "digital_purchase", payer: buyer.id, payee: c.id, amount: p.price, related: ["digital_product", p.id], at });
        purchaseRows.push({ productId: p.id, buyerId: buyer.id, ptId: row.id, at });
        (productSales.get(p.id) ?? productSales.set(p.id, []).get(p.id)!).push({ ptRef: row.processorReference, amount: p.price, at, buyerId: buyer.id });
      }
    }
    // @dot buys a few products from seeded creators.
    for (const p of shuffle(products.filter((x) => x.creator.id !== P)).slice(0, 3)) {
      if (purchaseRows.some((r) => r.productId === p.id && r.buyerId === P)) continue;
      const at = when(dotUser, p.creator, 1);
      const row = pay({ kind: "digital_purchase", payer: P, payee: p.creator.id, amount: p.price, related: ["digital_product", p.id], at });
      purchaseRows.push({ productId: p.id, buyerId: P, ptId: row.id, at });
      (productSales.get(p.id) ?? productSales.set(p.id, []).get(p.id)!).push({ ptRef: row.processorReference, amount: p.price, at, buyerId: P });
    }
    tally("products", productRows.length);
    tally("productPurchases", purchaseRows.length);

    // ================= Affiliate programs =================
    const affPrograms: Record<string, unknown>[] = [];
    const affLinks: { id: string; programId: string; affiliateId: string; code: string; createdAt: Date }[] = [];
    const affClicks: { affiliateLinkId: string; occurredAt: Date; referrerHost: string | null }[] = [];
    const affConversions: { affiliateLinkId: string; ptId: string; commission: number; at: Date }[] = [];
    const programCreators = shuffle(productCreators).slice(0, 14);
    if (!programCreators.includes(dotUser)) programCreators.push(dotUser);
    const usedCodes = new Set<string>();
    const convertedSales = new Set<string>();
    for (const c of programCreators) {
      const ownProducts = products.filter((p) => p.creator.id === c.id);
      const ownTiers = tiers.filter((t) => t.creator.id === c.id);
      const useTier = ownProducts.length === 0 || (ownTiers.length > 0 && chance(0.25));
      const target = useTier ? { type: "membership_tier", id: ownTiers[0]?.id } : { type: "digital_product", id: ownProducts[0].id };
      if (!target.id) continue;
      const commission = pick([10, 15, 20, 25]);
      const programId = randomUUID();
      affPrograms.push({ id: programId, creatorId: c.id, offeringType: target.type, offeringId: target.id, commissionPercent: commission, status: chance(0.9) ? "active" : "paused", createdAt: when(c, null, 60, 5) });
      const affiliates = pickPeople(c, between(2, 6), true);
      for (const a of affiliates) {
        let code = `${a.handle}${between(10, 99)}`.slice(0, 20);
        while (usedCodes.has(code)) code = `${a.handle}${between(100, 9999)}`;
        usedCodes.add(code);
        const linkId = randomUUID();
        const createdAt = when(a, c, 80, 3);
        affLinks.push({ id: linkId, programId, affiliateId: a.id, code, createdAt });
        payees.add(a.id);
        const clicks = between(8, a.id === P ? 60 : 90);
        for (let i = 0; i < clicks; i++) affClicks.push({ affiliateLinkId: linkId, occurredAt: new Date(createdAt.getTime() + rand() * (now - createdAt.getTime() - MIN)), referrerHost: pick(["twitter.com", "instagram.com", "wa.me", "youtube.com", "linkedin.com", null]) });
        // Some sales of the target get credited to this affiliate (once per sale).
        const sales = useTier
          ? firstCharges.filter((f) => f.tierId === target.id)
          : (productSales.get(target.id!) ?? []).map((s) => ({ ref: s.ptRef, amount: s.amount, at: s.at, fanId: s.buyerId }));
        for (const s of sales) {
          const ref = "ptRef" in s ? (s as { ptRef: string }).ptRef : (s as { ref: string }).ref;
          if (a.id === s.fanId || s.at.getTime() < createdAt.getTime() || convertedSales.has(ref)) continue;
          if (!chance(a.id === P ? 0.8 : 0.3)) continue;
          const commissionAmount = round2(s.amount * commission / 100);
          if (commissionAmount <= 0) continue;
          const row = pay({ kind: "affiliate_commission", payer: null, payee: a.id, amount: commissionAmount, related: ["affiliate_link", linkId], at: s.at, ref: `${ref}_aff` });
          affConversions.push({ affiliateLinkId: linkId, ptId: row.id, commission: commissionAmount, at: s.at });
          convertedSales.add(ref);
          notify(a.id, s.fanId, "affiliate_conversion", "user", s.fanId, s.at);
        }
      }
    }
    tally("affiliatePrograms", affPrograms.length);
    tally("affiliateLinks", affLinks.length);
    tally("affiliateConversions", affConversions.length);

    // ================= Services, availability, appointments =================
    type Service = { id: string; seller: U; title: string; price: number; minutes: number };
    const serviceSellers: U[] = [];
    for (const role of Object.keys(SERVICES) as RoleKey[]) serviceSellers.push(...byRole(role).slice(0, between(1, 2)));
    const services: Service[] = [];
    const offeringRows: Record<string, unknown>[] = [];
    const availRows: Record<string, unknown>[] = [];
    for (const s of serviceSellers) {
      for (const [title, description, price, minutes] of SERVICES[s.role as RoleKey]!) {
        const id = randomUUID();
        services.push({ id, seller: s, title, price, minutes });
        offeringRows.push({ id, sellerUserId: s.id, kind: "service", name: title, description, price, currency: "usd", status: "active", isBookable: true, durationMinutes: minutes, createdAt: new Date(Math.min(now - 30 * MIN, s.createdAt + between(2, 20) * DAY)) });
      }
      const days = shuffle([1, 2, 3, 4, 5, 6]).slice(0, between(3, 5));
      for (const dayOfWeek of days) availRows.push({ sellerUserId: s.id, dayOfWeek, startsAtLocal: pick(["09:00", "10:00", "11:00"]), endsAtLocal: pick(["17:00", "18:00", "19:00"]), timezone: "Asia/Kolkata" });
      payees.add(s.id);
    }
    const IST = 330 * MIN;
    const apptRows: Record<string, unknown>[] = [];
    const offeringPurchaseRows: { offeringId: string; buyerId: string; ptId: string; status: string; quantity: number; at: Date }[] = [];
    const occupied = new Set<string>();
    const rulesBySeller = new Map<string, number[]>();
    for (const r of availRows) (rulesBySeller.get(r.sellerUserId as string) ?? rulesBySeller.set(r.sellerUserId as string, []).get(r.sellerUserId as string)!).push(r.dayOfWeek as number);
    const book = (svc: Service, customer: U, forceFuture = false) => {
      const days = rulesBySeller.get(svc.seller.id)!;
      for (let attempt = 0; attempt < 25; attempt++) {
        const offset = forceFuture ? between(1, 18) : between(-35, 18);
        const hour = between(10, 16);
        const day = new Date(now + offset * DAY);
        const local = new Date(day.getTime() + IST);
        if (!days.includes(local.getUTCDay())) continue;
        const startsAt = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour, 0) - IST);
        const key = `${svc.seller.id}:${startsAt.getTime()}`;
        const created = when(customer, svc.seller, 40, 0);
        if (occupied.has(key) || startsAt.getTime() <= created.getTime()) continue;
        occupied.add(key);
        const past = startsAt.getTime() < now;
        const status = past ? (chance(0.7) ? "completed" : chance(0.5) ? "cancelled" : "no_show") : chance(0.55) ? "confirmed" : "requested";
        apptRows.push({ sellerUserId: svc.seller.id, offeringId: svc.id, customerId: customer.id, startsAt, endsAt: new Date(startsAt.getTime() + svc.minutes * MIN), status, notes: pick(BOOKING_NOTES) || null, createdAt: created });
        notify(svc.seller.id, customer.id, "appointment_request", "user", svc.seller.handle, created);
        if (status === "confirmed" || status === "completed") notify(customer.id, svc.seller.id, "appointment_confirmed", "user", svc.seller.handle, new Date(Math.min(now - MIN, created.getTime() + between(10, 600) * MIN)));
        if (status === "cancelled") notify(customer.id, svc.seller.id, "appointment_cancelled", "user", svc.seller.handle, new Date(Math.min(now - MIN, created.getTime() + between(10, 600) * MIN)));
        if ((status === "completed" || status === "confirmed") && chance(0.65)) {
          const row = pay({ kind: "freelance_purchase", payer: customer.id, payee: svc.seller.id, amount: svc.price, related: ["offering", svc.id], at: created });
          offeringPurchaseRows.push({ offeringId: svc.id, buyerId: customer.id, ptId: row.id, status: status === "completed" ? "fulfilled" : "pending", quantity: 1, at: created });
        }
        return;
      }
    };
    for (const svc of services) for (const c of pickPeople(svc.seller, between(2, 7), true)) book(svc, c);
    for (const svc of shuffle(services.filter((s) => s.seller.id !== P)).slice(0, 2)) book(svc, dotUser, true);
    tally("services", offeringRows.length);
    tally("appointments", apptRows.length);

    // ================= Business sales =================
    for (const b of seedBusinesses) {
      const owner = everyone.find((u) => u.id === b.createdBy)!;
      for (const o of b.offerings) {
        const buyers = pickPeople(owner, between(1, 7), false);
        if (chance(0.25) && b.slug !== "saarthi_cares") buyers.push(dotUser);
        for (const buyer of buyers) {
          const quantity = o.kind === "product" ? between(1, 3) : 1;
          const at = when(buyer, owner, 60, 0);
          const row = pay({ kind: "business_purchase", payer: buyer.id, business: b.id, amount: round2((o.price ?? 0) * quantity), currency: (o.currency ?? "INR").toLowerCase(), related: ["offering", o.id], at });
          offeringPurchaseRows.push({ offeringId: o.id, buyerId: buyer.id, ptId: row.id, status: chance(0.8) ? "fulfilled" : "pending", quantity, at });
        }
      }
    }
    tally("offeringPurchases", offeringPurchaseRows.length);

    // ================= Fundraising =================
    const campaignRows: Record<string, unknown>[] = [];
    const donationRows: { campaignId: string; donorId: string; amount: number; message: string | null; anon: boolean; ptId: string; at: Date }[] = [];
    const campaignRaised = new Map<string, number>();
    const usedOrganizers = new Set<string>();
    const campaignMeta: { id: string; goal: number | null; organizerUser: U | null; businessId: string | null }[] = [];
    for (const c of CAMPAIGNS) {
      let organizerUser: U | null = null;
      let businessId: string | null = null;
      if (c.owner === "business") {
        const b = seedBusinesses.find((x) => x.slug === c.match);
        if (!b) continue;
        businessId = b.id;
        organizerUser = everyone.find((u) => u.id === b.createdBy)!;
      } else {
        organizerUser = byRole(c.match as RoleKey).find((u) => !usedOrganizers.has(u.id)) ?? null;
        if (!organizerUser) continue;
        usedOrganizers.add(organizerUser.id);
        payees.add(organizerUser.id);
      }
      const id = randomUUID();
      const createdAt = when(organizerUser, null, 45, 8);
      campaignRows.push({ id, organizerType: businessId ? "business" : "user", organizerUserId: businessId ? null : organizerUser.id, organizerBusinessId: businessId, title: c.title, description: c.description, goalAmount: c.goal, currency: "usd", endsAt: new Date(now + c.days * DAY), createdAt });
      campaignMeta.push({ id, goal: c.goal, organizerUser: businessId ? null : organizerUser, businessId });
      let raised = 0;
      const wantFull = c.title === "Classroom Library Project";
      for (const donor of shuffle(dots.filter((d) => d.id !== organizerUser!.id)).slice(0, wantFull ? 60 : between(5, 20))) {
        if (wantFull && c.goal && raised >= c.goal) break;
        const amount = pick(wantFull ? [15, 20, 25, 50, 100] : [5, 10, 10, 15, 20, 25, 50]);
        const at = new Date(Math.max(createdAt.getTime() + MIN, when(donor, organizerUser, 44, 0).getTime()));
        const row = pay({ kind: "donation", payer: donor.id, payee: businessId ? null : organizerUser.id, business: businessId, amount, related: ["fundraising_campaign", id], at });
        donationRows.push({ campaignId: id, donorId: donor.id, amount, message: pick(DONATION_MESSAGES) || null, anon: chance(0.15), ptId: row.id, at });
        raised += amount;
      }
      campaignRaised.set(id, raised);
    }
    // @dot donates to two campaigns.
    for (const cm of shuffle(campaignMeta).slice(0, 2)) {
      const organizerId = cm.organizerUser?.id;
      const at = when(dotUser, cm.organizerUser, 1);
      const amount = pick([10, 25]);
      const row = pay({ kind: "donation", payer: P, payee: cm.businessId ? null : organizerId, business: cm.businessId, amount, related: ["fundraising_campaign", cm.id], at });
      donationRows.push({ campaignId: cm.id, donorId: P, amount, message: "Happy to support this 🙏", anon: false, ptId: row.id, at });
      campaignRaised.set(cm.id, (campaignRaised.get(cm.id) ?? 0) + amount);
    }
    for (const r of campaignRows) {
      const raised = campaignRaised.get(r.id as string) ?? 0;
      r.raisedAmount = raised;
      r.status = r.goalAmount && raised >= (r.goalAmount as number) ? "completed" : "active";
    }
    tally("campaigns", campaignRows.length);
    tally("donations", donationRows.length);

    // ================= Card tips =================
    const tipRows: { id: string; from: string; to: string; amount: number; message: string | null; ptId: string; at: Date }[] = [];
    const tipTargets = [...new Set([...tierCreators, ...productCreators, ...serviceSellers])];
    tipTargets.forEach((t) => payees.add(t.id));
    for (let n = 0; n < 64; n++) {
      let to = pick(rankBy(tipTargets).slice(0, 25));
      let from = pick(notSelf(to));
      if (n < 4) { from = dotUser; to = pick(rankBy(tipTargets.filter((t) => t.id !== P)).slice(0, 15)); }
      else if (n < 10) { to = dotUser; from = pick(dots); }
      const amount = pick([1, 2, 3, 5, 5, 10]);
      const at = when(from, to, 70, 0);
      const tipId = randomUUID();
      const row = pay({ kind: "tip", payer: from.id, payee: to.id, amount, related: ["tip", tipId], at });
      tipRows.push({ id: tipId, from: from.id, to: to.id, amount, message: pick(TIP_NOTES) || null, ptId: row.id, at });
      notify(to.id, from.id, "tip_received", "user", from.id, at);
    }
    tally("tips", tipRows.length);

    // ================= Payout accounts =================
    const havePayout = new Set((await prisma.creatorPayoutAccount.findMany({ select: { userId: true, businessId: true } })).flatMap((r) => [r.userId, r.businessId]).filter(Boolean) as string[]);
    const payoutRows: Record<string, unknown>[] = [];
    for (const id of payees) if (!havePayout.has(id)) payoutRows.push({ userId: id, processor: "stub", processorAccountId: `acct_seed_${hex(6)}`, country: "IN", status: "active", createdAt: new Date(now - between(1, 60) * DAY) });
    for (const b of seedBusinesses) if (!havePayout.has(b.id) && b.offerings.length > 0) payoutRows.push({ businessId: b.id, processor: "stub", processorAccountId: `acct_seed_${hex(6)}`, country: "IN", status: "active", createdAt: new Date(now - between(1, 60) * DAY) });

    // ================= Write everything (parents before dependents) =================
    await prisma.membershipTier.createMany({ data: tierRows as never });
    await prisma.membershipSubscription.createMany({ data: subRows as never });
    await prisma.digitalProduct.createMany({ data: productRows as never });
    await prisma.offering.createMany({ data: offeringRows as never });
    if (availRows.length) await prisma.availabilityRule.createMany({ data: availRows as never });
    await prisma.creatorPayoutAccount.createMany({ data: payoutRows as never });
    await prisma.platformSubscription.createMany({ data: platformSubs as never });
    for (const part of chunk(pts, 400)) await prisma.paymentTransaction.createMany({ data: part });
    for (const part of chunk(purchaseRows, 400)) await prisma.digitalProductPurchase.createMany({ data: part.map((r) => ({ productId: r.productId, buyerId: r.buyerId, paymentTransactionId: r.ptId, purchasedAt: r.at })) });
    for (const part of chunk(offeringPurchaseRows, 400)) await prisma.offeringPurchase.createMany({ data: part.map((r) => ({ offeringId: r.offeringId, buyerId: r.buyerId, paymentTransactionId: r.ptId, quantity: r.quantity, status: r.status, createdAt: r.at })) });
    for (const part of chunk(apptRows, 400)) await prisma.appointment.createMany({ data: part as never });
    await prisma.affiliateProgram.createMany({ data: affPrograms as never });
    await prisma.affiliateLink.createMany({ data: affLinks.map((l) => ({ id: l.id, programId: l.programId, affiliateId: l.affiliateId, code: l.code, createdAt: l.createdAt })) });
    for (const part of chunk(affClicks, 800)) await prisma.affiliateClick.createMany({ data: part });
    if (affConversions.length) await prisma.affiliateConversion.createMany({ data: affConversions.map((c) => ({ affiliateLinkId: c.affiliateLinkId, paymentTransactionId: c.ptId, commissionAmount: c.commission, createdAt: c.at })) });
    await prisma.fundraisingCampaign.createMany({ data: campaignRows as never });
    await prisma.donation.createMany({ data: donationRows.map((d) => ({ campaignId: d.campaignId, donorId: d.donorId, amount: d.amount, currency: "usd", message: d.message, isAnonymous: d.anon, paymentTransactionId: d.ptId, createdAt: d.at })) });
    await prisma.tip.createMany({ data: tipRows.map((t) => ({ id: t.id, fromUserId: t.from, toCreatorId: t.to, amount: t.amount, currency: "usd", message: t.message, paymentTransactionId: t.ptId, createdAt: t.at })) });
    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });

    // Members-only content for creators with tiers: a gated post, and a gated newsletter issue / podcast episode where they have one.
    let gated = 0;
    for (const c of tierCreators) {
      const tier = tiers.find((t) => t.creator.id === c.id && t.level === 1)!;
      const tier2 = tiers.find((t) => t.creator.id === c.id && t.level === 2)!;
      await prisma.post.create({ data: { authorId: c.id, body: "Members-only: a longer behind-the-scenes note for supporters is up. Thank you for making this work possible 🙏", requiredTierId: tier.id, createdAt: new Date(Math.max(c.createdAt + 10 * MIN, now - between(1, 20) * DAY)) } });
      const issue = await prisma.newsletterIssue.findFirst({ where: { creatorId: c.id, status: "sent" }, orderBy: { sentAt: "desc" }, select: { id: true } });
      if (issue) await prisma.newsletterIssue.update({ where: { id: issue.id }, data: { requiredTierId: tier2.id } });
      const ep = await prisma.podcastEpisode.findFirst({ where: { podcast: { creatorId: c.id } }, orderBy: { episodeNumber: "desc" }, select: { id: true } });
      if (ep) await prisma.podcastEpisode.update({ where: { id: ep.id }, data: { requiredTierId: tier2.id } });
      gated++;
    }

    const dotPts = pts.filter((p) => (p.payerId === P || p.payeeId === P) && p.currency === "usd");
    console.log("Done: " + Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ") + `; ${gated} members-only post sets, ${payoutRows.length} payout accounts.`);
    console.log(`Payments recorded: ${pts.length} (${dotPts.length} USD payments involve @${handle}: earned $${round2(dotPts.filter((p) => p.payeeId === P).reduce((s, p) => s + p.amount, 0))}, spent $${round2(dotPts.filter((p) => p.payerId === P).reduce((s, p) => s + p.amount, 0))}). Notifications: ${notifs.length}.`);
    console.log("Cleanup: RESET=1 npx tsx scripts/seed-dots-monetization.ts (or delete-seed-users.ts)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
