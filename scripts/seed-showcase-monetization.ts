import { randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import {
  DAY, MIN, SEED_DOMAIN, SCALE_COLORS, chunk, dotSquareSvg, loadDots, loadShowcase, makeAfter, makeRng, openDb, round2, type NotifRow,
} from "./seed-showcase-common";

// Monetization and wallet for the platform showcase profile (@dot), recorded like real payments (PaymentTransaction,
// stripe_connect, 7% fee because the profile is Premium):
//   @dot's existing tiers (Supporter/Insider/Patron) topped up to ~55 members + recurring charges + members-only
//   posts/newsletter/episode, 5 digital products with purchases, 3 bookable services + availability +
//   appointments, an affiliate program on a product and a tier (12 affiliates, clicks, conversions + commissions),
//   ~90 card tips, and a coin wallet: standard 7-coin signup grant, extra spendable coins, coin tips and
//   transfers with the dots (obeying app limits, balances recomputed from postings).
// Run seed-showcase-profile.ts (and the other showcase scripts) first. Local only.
// Usage: npx tsx scripts/seed-showcase-monetization.ts     (refuses if it already exists; no undo, restore a DB backup)

const SYSTEM = { revenue: "00000000-0000-4000-8000-000000000001", promoIssuance: "00000000-0000-4000-8000-000000000002" };
const COIN = 100;

const PRODUCTS: [string, string, number][] = [
  ["Scale Ladder Workbook", "A 60-page workbook with exercises for mapping any problem across the seven scales.", 12],
  ["Seed Library Starter Kit (PDF)", "Guides, label templates, rules and a launch checklist for a neighbourhood seed library.", 9],
  ["City Air Data Notebook Pack", "Six notebooks and datasets for analysing community air-quality data.", 19],
  ["Systems Thinking Field Cards", "A printable deck of 40 prompts for seeing and shaping systems.", 14],
  ["Grant Writing Templates for Community Projects", "Templates and worked examples for multi-scale grant proposals.", 25],
];
const SERVICES: [string, string, number, number][] = [
  ["Systems Thinking Session", "One hour on your problem, mapped across the seven scales.", 60, 60],
  ["Programme Design Review", "A deep review of your community programme's design and metrics.", 90, 90],
  ["Team Q&A Session", "A 30 minute live conversation with your team about scales of living.", 40, 30],
];
const TIP_NOTES = ["Thank you for the seed library guide 🌱", "Your thread made my week.", "For the coffee ☕", "Keep publishing everything openly!", "Small thanks for a big idea.", "", "", ""];
const BOOKING_NOTES = ["I'd like to focus on our ward compost pilot.", "Please look at our metrics beforehand.", "Excited for this!", "", ""];

async function main() {
  const { url, prisma } = await openDb();
  const { rand, int, between, pick, chance, shuffle } = makeRng(Number(process.env.SEED ?? 15));
  const now = Date.now();
  const after = makeAfter(now, rand);
  console.log(`Seeding showcase monetization at: ${url}`);

  try {
    const me = await loadShowcase(prisma);
    const dots = await loadDots(prisma);

    if ((await prisma.digitalProduct.count({ where: { creatorId: me.id, title: PRODUCTS[0][0] } })) > 0) {
      console.log("Showcase monetization already exists (restore a DB backup to redo it).");
      return;
    }
    mkdirSync("public/uploads", { recursive: true });

    type PT = { id: string; kind: string; payerId: string | null; payeeId: string | null; amount: number; platformFee: number; processorReference: string; relatedObjectType: string | null; relatedObjectId: string | null; createdAt: Date };
    const pts: PT[] = [];
    const pay = (kind: string, payer: string | null, payee: string, amount: number, related: [string, string] | null, at: Date, ref?: string): PT => {
      const row: PT = { id: randomUUID(), kind, payerId: payer, payeeId: payee, amount, platformFee: round2(amount * (payee === me.id ? 0.07 : 0.1)), processorReference: ref ?? `pi_seed_${randomBytes(10).toString("hex")}`, relatedObjectType: related?.[0] ?? null, relatedObjectId: related?.[1] ?? null, createdAt: at };
      pts.push(row);
      return row;
    };
    const notifs: NotifRow[] = [];
    const notify = (recipientId: string, actorId: string, type: string, subjectType: string, subjectId: string, at: Date) => notifs.push({ recipientId, actorId, type, subjectType, subjectId, createdAt: at, readAt: chance(0.5) ? new Date(at.getTime() + between(2, 900) * MIN) : null });
    const totals: Record<string, number> = {};
    const tally = (k: string, n = 1) => (totals[k] = (totals[k] ?? 0) + n);
    const early = me.createdAt + 20 * DAY;

    // ---------- Tiers, members, charges ----------
    const tiers = (await prisma.membershipTier.findMany({ where: { creatorId: me.id, status: "active" }, orderBy: { level: "asc" }, select: { id: true, price: true, billingInterval: true } })).slice(0, 3);
    if (tiers.length < 3) throw new Error("Expected @dot's three membership tiers (seed-dots-monetization.ts).");
    const alreadyMembers = new Set((await prisma.membershipSubscription.findMany({ where: { tierId: { in: tiers.map((t) => t.id) } }, select: { fanId: true } })).map((m) => m.fanId));
    const memberSubs: Record<string, unknown>[] = [];
    const firstCharge: { tierId: string; ref: string; amount: number; at: Date; fanId: string }[] = [];
    const fans = shuffle(dots.filter((d) => !alreadyMembers.has(d.id))).slice(0, Math.max(0, 55 - alreadyMembers.size));
    for (const fan of fans) {
      const r = rand();
      const tier = tiers[r < 0.58 ? 0 : r < 0.9 ? 1 : 2];
      const startedAt = after([fan.createdAt], Math.max(early, now - 120 * DAY, fan.createdAt), now - 30 * MIN);
      const status = chance(0.9) ? "active" : "cancelled";
      const step = (tier.billingInterval === "yearly" ? 365 : 30) * DAY;
      const cycles = Math.max(1, Math.min(4, Math.floor((now - startedAt.getTime()) / step) + 1));
      const paid = status === "cancelled" ? Math.max(1, cycles - 1) : cycles;
      for (let c = 0; c < paid; c++) {
        const at = new Date(Math.min(now - MIN, startedAt.getTime() + c * step));
        const row = pay("membership_charge", fan.id, me.id, tier.price, ["membership_tier", tier.id], at);
        if (c === 0) firstCharge.push({ tierId: tier.id, ref: row.processorReference, amount: tier.price, at, fanId: fan.id });
      }
      memberSubs.push({ tierId: tier.id, fanId: fan.id, status, currentPeriodEnd: status === "cancelled" ? new Date(startedAt.getTime() + paid * step) : new Date(Math.max(now + 3 * DAY, startedAt.getTime() + cycles * step)), processorSubscriptionId: `sub_seed_${randomBytes(8).toString("hex")}`, createdAt: startedAt });
      notify(me.id, fan.id, "new_subscriber", "user", fan.id, startedAt);
    }
    await prisma.membershipSubscription.createMany({ data: memberSubs as never });
    tally("members", memberSubs.length);
    // Members-only content.
    for (const [i, body] of ["Members-only: the raw notes from this week's field visit, including the parts that didn't work.", "Members-only: a behind-the-scenes look at how we calibrate the air sensors, with the spreadsheet.", "Members-only: a first look at chapter drafts for the next book."].entries()) {
      await prisma.post.create({ data: { authorId: me.id, body, requiredTierId: tiers[i].id, createdAt: new Date(now - (i + 1) * 6 * DAY) } });
    }
    const issue = await prisma.newsletterIssue.findFirst({ where: { creatorId: me.id, status: "sent" }, orderBy: { sentAt: "desc" }, select: { id: true } });
    if (issue) await prisma.newsletterIssue.update({ where: { id: issue.id }, data: { requiredTierId: tiers[1].id } });
    const ep = await prisma.podcastEpisode.findFirst({ where: { podcast: { creatorId: me.id } }, orderBy: { episodeNumber: "desc" }, select: { id: true } });
    if (ep) await prisma.podcastEpisode.update({ where: { id: ep.id }, data: { requiredTierId: tiers[0].id } });

    // ---------- Products ----------
    const products: { id: string; title: string; price: number }[] = [];
    for (const [title, description, price] of PRODUCTS) {
      const id = randomUUID();
      writeFileSync(`public/uploads/showcase-product-${id}.svg`, dotSquareSvg(title.split(" ").slice(0, 2).join(" "), between(3, 6), pick(SCALE_COLORS), 480));
      await prisma.digitalProduct.create({ data: { id, creatorId: me.id, title, description, coverImageUrl: `/uploads/showcase-product-${id}.svg`, price, currency: "usd", fileKey: `protected/${randomBytes(16).toString("hex")}.pdf`, fileMimeType: "application/pdf", fileSizeBytes: between(500, 9000) * 1024, status: "active", createdAt: new Date(early + between(1, 30) * DAY) } });
      products.push({ id, title, price });
    }
    const productSales = new Map<string, { ref: string; amount: number; at: Date; buyerId: string }[]>();
    const purchases: { productId: string; buyerId: string; ptId: string; at: Date }[] = [];
    for (const p of products) {
      const buyers = shuffle(dots).slice(0, between(22, 70));
      for (const b of buyers) {
        const at = after([b.createdAt], Math.max(early + 5 * DAY, b.createdAt, now - 110 * DAY), now - 10 * MIN);
        const row = pay("digital_purchase", b.id, me.id, p.price, ["digital_product", p.id], at);
        purchases.push({ productId: p.id, buyerId: b.id, ptId: row.id, at });
        (productSales.get(p.id) ?? productSales.set(p.id, []).get(p.id)!).push({ ref: row.processorReference, amount: p.price, at, buyerId: b.id });
      }
    }
    tally("products", products.length);
    tally("productPurchases", purchases.length);

    // ---------- Services + appointments ----------
    const IST = 330 * MIN;
    const days = [1, 2, 3, 4, 5];
    await prisma.availabilityRule.createMany({ data: days.map((dayOfWeek) => ({ sellerUserId: me.id, dayOfWeek, startsAtLocal: "10:00", endsAtLocal: "17:00", timezone: "Asia/Kolkata" })) });
    const offerings: { id: string; price: number; minutes: number }[] = [];
    for (const [name, description, price, minutes] of SERVICES) {
      const o = await prisma.offering.create({ data: { sellerUserId: me.id, kind: "service", name, description, price, currency: "usd", status: "active", isBookable: true, durationMinutes: minutes, createdAt: new Date(early + 2 * DAY) }, select: { id: true } });
      offerings.push({ id: o.id, price, minutes });
    }
    const appts: Record<string, unknown>[] = [];
    const offeringPurchases: { offeringId: string; buyerId: string; ptId: string; status: string; at: Date }[] = [];
    const occupied = new Set<string>();
    const customers = shuffle(dots).slice(0, 26);
    for (const c of customers) {
      const o = pick(offerings);
      for (let attempt = 0; attempt < 30; attempt++) {
        const offset = between(-40, 16);
        const local = new Date(now + offset * DAY + IST);
        if (!days.includes(local.getUTCDay())) continue;
        const hour = between(10, 16);
        const startsAt = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour, 0) - IST);
        const key = `${startsAt.getTime()}`;
        const created = after([c.createdAt], Math.max(c.createdAt, now - 50 * DAY), now - 30 * MIN);
        if (occupied.has(key) || startsAt.getTime() <= created.getTime()) continue;
        occupied.add(key);
        const past = startsAt.getTime() < now;
        const status = past ? (chance(0.75) ? "completed" : chance(0.5) ? "cancelled" : "no_show") : chance(0.6) ? "confirmed" : "requested";
        appts.push({ sellerUserId: me.id, offeringId: o.id, customerId: c.id, startsAt, endsAt: new Date(startsAt.getTime() + o.minutes * MIN), status, notes: pick(BOOKING_NOTES) || null, createdAt: created });
        notify(me.id, c.id, "appointment_request", "user", me.handle, created);
        if (status === "confirmed" || status === "completed") notify(c.id, me.id, "appointment_confirmed", "user", me.handle, new Date(Math.min(now - MIN, created.getTime() + 2 * 60 * MIN)));
        if (status === "completed" || status === "confirmed") {
          const row = pay("freelance_purchase", c.id, me.id, o.price, ["offering", o.id], created);
          offeringPurchases.push({ offeringId: o.id, buyerId: c.id, ptId: row.id, status: status === "completed" ? "fulfilled" : "pending", at: created });
        }
        break;
      }
    }
    tally("appointments", appts.length);

    // ---------- Affiliates ----------
    const programs = [
      { type: "digital_product", id: products[0].id, pct: 20 },
      { type: "membership_tier", id: tiers[1].id, pct: 15 },
    ];
    const usedCodes = new Set<string>();
    const conversions: { linkId: string; ptId: string; commission: number; at: Date }[] = [];
    const converted = new Set<string>();
    let links = 0;
    for (const pr of programs) {
      const program = await prisma.affiliateProgram.create({ data: { creatorId: me.id, offeringType: pr.type, offeringId: pr.id, commissionPercent: pr.pct, status: "active", createdAt: new Date(early + 40 * DAY) }, select: { id: true } });
      const affiliates = shuffle(dots).slice(0, 12);
      for (const a of affiliates) {
        let code = `${a.handle}${between(10, 99)}`.slice(0, 20);
        while (usedCodes.has(code)) code = `${a.handle}${between(100, 9999)}`;
        usedCodes.add(code);
        const createdAt = after([a.createdAt], Math.max(a.createdAt, early + 45 * DAY), now - 2 * DAY);
        const link = await prisma.affiliateLink.create({ data: { programId: program.id, affiliateId: a.id, code, createdAt }, select: { id: true } });
        links++;
        await prisma.affiliateClick.createMany({ data: Array.from({ length: between(10, 90) }, () => ({ affiliateLinkId: link.id, occurredAt: new Date(createdAt.getTime() + rand() * (now - createdAt.getTime() - MIN)), referrerHost: pick(["twitter.com", "linkedin.com", "wa.me", "youtube.com", null]) })) });
        const sales = pr.type === "digital_product" ? productSales.get(pr.id) ?? [] : firstCharge.filter((f) => f.tierId === pr.id).map((f) => ({ ref: f.ref, amount: f.amount, at: f.at, buyerId: f.fanId }));
        for (const s of sales) {
          if (s.buyerId === a.id || s.at.getTime() < createdAt.getTime() || converted.has(s.ref) || !chance(0.25)) continue;
          const commission = round2((s.amount * pr.pct) / 100);
          if (commission <= 0) continue;
          const row = pay("affiliate_commission", null, a.id, commission, ["affiliate_link", link.id], s.at, `${s.ref}_aff`);
          converted.add(s.ref);
          conversions.push({ linkId: link.id, ptId: row.id, commission, at: s.at });
          notify(a.id, s.buyerId, "affiliate_conversion", "user", s.buyerId, s.at);
        }
      }
    }
    tally("affiliateLinks", links);
    tally("affiliateConversions", conversions.length);

    // ---------- Card tips ----------
    const tipRows: { id: string; from: string; to: string; amount: number; message: string | null; ptId: string; at: Date }[] = [];
    const tippers = [...shuffle(dots), ...shuffle(dots).slice(0, 30)];
    for (const [i, d] of tippers.entries()) {
      if (i >= 96) break;
      const amount = pick([1, 2, 3, 5, 5, 10, 20, 50]);
      const at = after([d.createdAt], Math.max(early + 10 * DAY, d.createdAt, now - 100 * DAY), now - 15 * MIN);
      const tipId = randomUUID();
      const row = pay("tip", d.id, me.id, amount, ["tip", tipId], at);
      tipRows.push({ id: tipId, from: d.id, to: me.id, amount, message: pick(TIP_NOTES) || null, ptId: row.id, at });
      notify(me.id, d.id, "tip_received", "user", d.id, at);
    }
    tally("tips", tipRows.length);

    // ---------- Write payments and dependents ----------
    for (const part of chunk(pts, 400)) await prisma.paymentTransaction.createMany({ data: part.map((p) => ({ id: p.id, kind: p.kind, payerId: p.payerId, payeeId: p.payeeId, amount: p.amount, currency: "usd", platformFee: p.platformFee, processor: "stripe_connect", processorReference: p.processorReference, status: "succeeded", relatedObjectType: p.relatedObjectType, relatedObjectId: p.relatedObjectId, createdAt: p.createdAt })) });
    for (const part of chunk(purchases, 400)) await prisma.digitalProductPurchase.createMany({ data: part.map((r) => ({ productId: r.productId, buyerId: r.buyerId, paymentTransactionId: r.ptId, purchasedAt: r.at })) });
    for (const part of chunk(offeringPurchases, 400)) await prisma.offeringPurchase.createMany({ data: part.map((r) => ({ offeringId: r.offeringId, buyerId: r.buyerId, paymentTransactionId: r.ptId, quantity: 1, status: r.status, createdAt: r.at })) });
    if (appts.length) await prisma.appointment.createMany({ data: appts as never });
    if (conversions.length) await prisma.affiliateConversion.createMany({ data: conversions.map((c) => ({ affiliateLinkId: c.linkId, paymentTransactionId: c.ptId, commissionAmount: c.commission, createdAt: c.at })) });
    await prisma.tip.createMany({ data: tipRows.map((t) => ({ id: t.id, fromUserId: t.from, toCreatorId: t.to, amount: t.amount, currency: "usd", message: t.message, paymentTransactionId: t.ptId, createdAt: t.at })) });

    // ---------- Coin wallet ----------
    const people = [{ id: me.id, createdAt: me.createdAt }, ...dots.map((d) => ({ id: d.id, createdAt: d.createdAt }))];
    const have = new Set((await prisma.ledgerAccount.findMany({ where: { ownerUserId: { in: people.map((p) => p.id) }, type: { in: ["user_wallet", "user_promo"] } }, select: { type: true, ownerUserId: true } })).map((a) => `${a.type}:${a.ownerUserId}`));
    const missing = people.flatMap((p) => (["user_wallet", "user_promo"] as const).map((type) => ({ type, ownerUserId: p.id }))).filter((a) => !have.has(`${a.type}:${a.ownerUserId}`));
    if (missing.length) await prisma.ledgerAccount.createMany({ data: missing });
    const acct = new Map<string, { wallet: string; promo: string }>();
    for (const a of await prisma.ledgerAccount.findMany({ where: { ownerUserId: { in: people.map((p) => p.id) }, type: { in: ["user_wallet", "user_promo"] } }, select: { id: true, type: true, ownerUserId: true } })) {
      const cur = acct.get(a.ownerUserId!) ?? { wallet: "", promo: "" };
      if (a.type === "user_wallet") cur.wallet = a.id; else cur.promo = a.id;
      acct.set(a.ownerUserId!, cur);
    }
    const spendable = new Map((await prisma.ledgerAccount.findMany({ where: { id: { in: [...acct.values()].map((a) => a.wallet) } }, select: { id: true, cachedBalance: true } })).map((a) => [a.id, a.cachedBalance / COIN]));
    const myAcct = acct.get(me.id)!;
    const ledger: { id: string; kind: string; key: string; actor: string | null; memo: string | null; relType: string | null; relId: string | null; expiresAt: Date | null; createdAt: Date; lines: [string, number][] }[] = [];
    const touched = new Set<string>([SYSTEM.revenue, SYSTEM.promoIssuance]);
    const post = (t: Omit<(typeof ledger)[number], "id">) => { ledger.push({ id: randomUUID(), ...t }); t.lines.forEach(([a]) => touched.add(a)); };
    const grantAt = new Date(me.createdAt + MIN);
    const exp = new Date(now + 90 * DAY);
    post({ kind: "signup_grant", key: `signup_grant:${me.id}`, actor: null, memo: "Signup bonus", relType: null, relId: null, expiresAt: exp, createdAt: grantAt, lines: [[SYSTEM.promoIssuance, -1 * COIN], [myAcct.promo, 1 * COIN]] });
    post({ kind: "promo_grant", key: `launch_promo:${me.id}`, actor: null, memo: "launch", relType: null, relId: null, expiresAt: exp, createdAt: new Date(grantAt.getTime() + 1000), lines: [[SYSTEM.promoIssuance, -6 * COIN], [myAcct.promo, 6 * COIN]] });
    post({ kind: "admin_adjustment", key: `seed_wallet:fund:${me.id}`, actor: null, memo: "Seed: starter test funds", relType: null, relId: null, expiresAt: null, createdAt: new Date(me.createdAt + 3 * DAY), lines: [[myAcct.wallet, 800 * COIN], [SYSTEM.promoIssuance, -800 * COIN]] });
    const coinTips: { ledgerId: string; from: string; amount: number; at: Date }[] = [];
    const coinTransfers: { from: string; to: string; amount: number; at: Date }[] = [];
    let coinN = 0;
    for (const d of shuffle(dots)) {
      const a = acct.get(d.id)!;
      const bal = spendable.get(a.wallet) ?? 0;
      if (bal < 1 || coinN >= 40) continue;
      const amount = Math.min(Math.floor(bal), pick([1, 2, 3, 5]));
      const at = after([d.createdAt], Math.max(d.createdAt + 2 * DAY, now - 60 * DAY), now - 2 * 60 * MIN);
      if (chance(0.7)) {
        const fee = Math.round(round2(amount * 0.07) * COIN);
        const id = randomUUID();
        post({ kind: "purchase", key: `seed_wallet:showcase_tip:${d.id}:${coinN}`, actor: d.id, memo: null, relType: "tip", relId: null, expiresAt: null, createdAt: at, lines: [[a.wallet, -amount * COIN], [SYSTEM.revenue, fee], [myAcct.wallet, amount * COIN - fee]] });
        coinTips.push({ ledgerId: ledger[ledger.length - 1].id, from: d.id, amount, at });
        void id;
      } else {
        post({ kind: "transfer", key: `seed_wallet:showcase_transfer:${d.id}:${coinN}`, actor: d.id, memo: null, relType: "user", relId: me.id, expiresAt: null, createdAt: at, lines: [[a.wallet, -amount * COIN], [myAcct.wallet, amount * COIN]] });
        coinTransfers.push({ from: d.id, to: me.id, amount, at });
      }
      spendable.set(a.wallet, bal - amount);
      coinN++;
    }
    // Ira sends a few thank-you transfers back (sender balance is large, recipients are old enough).
    for (const d of shuffle(dots).slice(0, 8)) {
      const amount = pick([2, 5, 10]);
      const at = after([d.createdAt], Math.max(d.createdAt + 2 * DAY, now - 20 * DAY), now - 3 * 60 * MIN);
      post({ kind: "transfer", key: `seed_wallet:showcase_thanks:${d.id}`, actor: me.id, memo: null, relType: "user", relId: d.id, expiresAt: null, createdAt: at, lines: [[myAcct.wallet, -amount * COIN], [acct.get(d.id)!.wallet, amount * COIN]] });
      coinTransfers.push({ from: me.id, to: d.id, amount, at });
      notify(d.id, me.id, "coins_received", "user", me.id, at);
    }
    const existingKeys = new Set((await prisma.ledgerTransaction.findMany({ where: { idempotencyKey: { in: ledger.map((l) => l.key) } }, select: { idempotencyKey: true } })).map((t) => t.idempotencyKey));
    const fresh = ledger.filter((l) => !existingKeys.has(l.key));
    for (const part of chunk(fresh, 300)) await prisma.ledgerTransaction.createMany({ data: part.map((l) => ({ id: l.id, kind: l.kind, idempotencyKey: l.key, actorUserId: l.actor, memo: l.memo, relatedObjectType: l.relType, relatedObjectId: l.relId, expiresAt: l.expiresAt, createdAt: l.createdAt })) });
    for (const part of chunk(fresh.flatMap((l) => l.lines.map(([accountId, amount]) => ({ id: randomUUID(), transactionId: l.id, accountId, amount, createdAt: l.createdAt }))), 800)) await prisma.ledgerPosting.createMany({ data: part });
    await prisma.coinTransfer.createMany({ data: coinTransfers.map((t) => ({ fromUserId: t.from, toUserId: t.to, amount: t.amount, createdAt: t.at })) });
    for (const t of coinTips) {
      const pt = await prisma.paymentTransaction.create({ data: { kind: "tip", payerId: t.from, payeeId: me.id, amount: t.amount, currency: "usd", platformFee: round2(t.amount * 0.07), processor: "wallet", processorReference: t.ledgerId, status: "succeeded", relatedObjectType: "tip", createdAt: t.at }, select: { id: true } });
      await prisma.ledgerTransaction.update({ where: { id: t.ledgerId }, data: { paymentTransactionId: pt.id } });
      await prisma.tip.create({ data: { fromUserId: t.from, toCreatorId: me.id, amount: t.amount, currency: "usd", message: pick(TIP_NOTES) || null, paymentTransactionId: pt.id, createdAt: t.at } });
      notify(me.id, t.from, "tip_received", "user", t.from, t.at);
    }
    for (const t of coinTransfers.filter((x) => x.to === me.id)) notify(me.id, t.from, "coins_received", "user", t.from, t.at);
    const sums = await prisma.ledgerPosting.groupBy({ by: ["accountId"], where: { accountId: { in: [...touched] } }, _sum: { amount: true } });
    for (const s of sums) await prisma.ledgerAccount.update({ where: { id: s.accountId }, data: { cachedBalance: s._sum.amount ?? 0 } });
    tally("coinTips", coinTips.length);
    tally("coinTransfers", coinTransfers.length);

    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });
    const earned = round2(pts.filter((p) => p.payeeId === me.id).reduce((s, p) => s + p.amount, 0));
    const myBal = await prisma.ledgerAccount.findMany({ where: { ownerUserId: me.id }, select: { type: true, cachedBalance: true } });
    console.log("Done: " + Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ") + `. Card payments recorded: ${pts.length} (gross $${earned} to @${me.handle}). Notifications: ${notifs.length}.`);
    console.log(`Wallet @${me.handle}: spendable ${(myBal.find((b) => b.type === "user_wallet")?.cachedBalance ?? 0) / COIN}, restricted ${(myBal.find((b) => b.type === "user_promo")?.cachedBalance ?? 0) / COIN}.`);
    void SEED_DOMAIN;
    void int;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
