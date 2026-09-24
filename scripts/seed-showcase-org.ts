import { randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import {
  DAY, HOUR, MIN, SHOWCASE_HANDLE, SCALE_COLORS, chunk, dotSquareSvg, loadDots, loadShowcase, makeAfter, makeRng, openDb, ringsCoverSvg, round2, type NotifRow,
} from "./seed-showcase-common";
import { SCALES } from "./seed-showcase-data";
import { APPLICATION_NOTES, BUSINESS, BUSINESS_FORM, CAMPAIGNS, COMMUNITY, DOC_FILES, EVENTS, JOBS, TEAM_TITLES } from "./seed-showcase-org-data";
import { ARTICLE_COMMENTS } from "./seed-dots-content-data";
import { REPLIES } from "./seed-dots-data";
import { EVENT_CITY_COORDS, VENUES } from "./seed-dots-jobs-events-data";

// The organisation around the showcase profile:
//   ZERO DOT (/b/dot, the platform's business page): verified, with a team, two mapped locations with hours,
//     contact info, links, offerings, documents, 12 reviews with responses, 12 business-authored posts, 5 jobs with
//     applications, a volunteer sign-up form with responses, 3 fundraising campaigns with donations, and a business
//     subscription.
//   Scale Ladder (/c/scale_ladder): a community with ~80 members, 4 moderators, rules, scale flairs, 15 posts with
//     replies/likes (one pinned), a wiki, chat and voice rooms.
//   Events: 8 events (flagship hybrid summit with 4 ticket types, workshops, book launch, panel, past field day)
//     with RSVPs, free and paid tickets (INR card payments), check-ins, map coordinates and a linked livestream.
// Run seed-showcase-profile.ts and seed-showcase-content.ts first. Local only.
// Usage: npx tsx scripts/seed-showcase-org.ts     (refuses if it already exists; no undo, restore a DB backup)

async function main() {
  const { url, prisma } = await openDb();
  const { rand, int, between, pick, chance, shuffle } = makeRng(Number(process.env.SEED ?? 14));
  const now = Date.now();
  const after = makeAfter(now, rand);
  console.log(`Seeding showcase organisation at: ${url}`);

  try {
    const me = await loadShowcase(prisma);
    const dots = await loadDots(prisma);
    const existing = await prisma.business.findUnique({ where: { slug: BUSINESS.slug }, select: { id: true, createdBy: true } });
    if (!existing || existing.createdBy !== me.id) throw new Error(`Business /b/${BUSINESS.slug} owned by @${me.handle} not found.`);
    if ((await prisma.fundraisingCampaign.count({ where: { organizerBusinessId: existing.id, title: CAMPAIGNS[0].title } })) > 0) {
      console.log("Showcase organisation already exists (restore a DB backup to redo it).");
      return;
    }
    mkdirSync("public/uploads", { recursive: true });

    const notifs: NotifRow[] = [];
    const markRead = (at: Date) => (chance(0.55) ? new Date(at.getTime() + between(5, 600) * MIN) : null);
    const totals: Record<string, number> = {};
    const tally = (k: string, n = 1) => (totals[k] = (totals[k] ?? 0) + n);
    const spread = (i: number, n: number, daysBack: number) => new Date(now - daysBack * DAY + ((i + rand() * 0.7) / n) * (daysBack * DAY - 2 * DAY));
    type PtRow = { id: string; kind: string; payerId: string; payeeId: string | null; payeeBusinessId: string | null; amount: number; currency: string; platformFee: number; ref: string; status: string; related: [string, string]; at: Date };
    const pts: PtRow[] = [];
    const pay = (o: Omit<PtRow, "id" | "platformFee" | "ref" | "status"> & { status?: string }) => { const row: PtRow = { ...o, id: randomUUID(), platformFee: round2(o.amount * 0.1), ref: `pi_seed_${randomBytes(10).toString("hex")}`, status: o.status ?? "succeeded" }; pts.push(row); return row; };
    const orgStart = me.createdAt + 5 * DAY;

    // ================= Business =================
    writeFileSync("public/uploads/showcase-bindu-logo.svg", dotSquareSvg("Bindu", 5, "#0f7a5c", 512, "Foundation"));
    writeFileSync("public/uploads/showcase-bindu-cover.svg", ringsCoverSvg(SCALES.map((s) => s.name)));
    const teamPool = shuffle(dots).slice(0, 6);
    await prisma.business.update({
      where: { id: existing.id },
      data: { tagline: BUSINESS.tagline, description: BUSINESS.description, foundedYear: BUSINESS.foundedYear, sizeRange: BUSINESS.sizeRange, isVerified: true, status: "active", logoUrl: "/uploads/showcase-bindu-logo.svg", coverUrl: "/uploads/showcase-bindu-cover.svg" },
    });
    await prisma.businessMember.createMany({ data: teamPool.map((d, i) => ({ businessId: existing.id, userId: d.id, role: i < 2 ? "admin" : i < 4 ? "editor" : "member", title: TEAM_TITLES[i], isPublic: true, joinedAt: after([d.createdAt], Math.max(orgStart, d.createdAt), now - 5 * DAY) })) });
    await prisma.businessMember.updateMany({ where: { businessId: existing.id, userId: me.id }, data: { title: "0dot Platform", isPublic: true } });
    await prisma.contactInfo.upsert({ where: { businessId: existing.id }, create: { businessId: existing.id, ...BUSINESS.contact }, update: BUSINESS.contact });
    await prisma.businessLocation.createMany({ data: BUSINESS.locations.map((l) => ({ businessId: existing.id, label: l.label, address: l.address, latitude: l.lat, longitude: l.lng, hoursJson: JSON.stringify(Object.fromEntries(l.hours[2].map((d) => [d, [{ opens: l.hours[0], closes: l.hours[1] }]]))) })) });
    await prisma.offering.createMany({ data: BUSINESS.offerings.map((o, i) => ({ businessId: existing.id, kind: o.kind, name: o.name, description: o.description, price: o.price, currency: o.price === null ? null : "INR", status: "active", sku: o.kind === "product" ? `ZDT-${String(i + 1).padStart(3, "0")}` : null, stockStatus: o.kind === "product" ? o.stock : null, isBookable: o.kind === "service" ? false : null, createdAt: new Date(orgStart + DAY) })) });
    const business = { id: existing.id, offerings: await prisma.offering.findMany({ where: { businessId: existing.id, status: "active" }, select: { id: true, price: true, kind: true } }) };
    for (const [i, [label, u]] of BUSINESS.links.entries()) await prisma.link.create({ data: { businessId: business.id, label, url: u, position: i, isFeatured: i === 0, clickCount: between(50, 700) } });
    for (const f of DOC_FILES) {
      writeFileSync(`public/uploads/showcase-bindu-${f.filename}`, f.content);
      await prisma.businessDocument.create({ data: { businessId: business.id, title: f.title, fileUrl: `/uploads/showcase-bindu-${f.filename}`, visibility: f.visibility, uploadedBy: me.id, createdAt: spread(pick([0, 1, 2]), 3, 100) } });
    }
    if (!(await prisma.creatorPayoutAccount.findUnique({ where: { businessId: business.id } }))) await prisma.creatorPayoutAccount.create({ data: { businessId: business.id, processor: "stub", processorAccountId: `acct_seed_${randomBytes(6).toString("hex")}`, country: "IN", status: "active", createdAt: new Date(orgStart + 2 * DAY) } });
    if (!(await prisma.creatorPayoutAccount.findUnique({ where: { userId: me.id } }))) await prisma.creatorPayoutAccount.create({ data: { userId: me.id, processor: "stub", processorAccountId: `acct_seed_${randomBytes(6).toString("hex")}`, country: "IN", status: "active", createdAt: new Date(me.createdAt + 3 * DAY) } });
    const subAt = new Date(now - 50 * DAY);
    if ((await prisma.platformSubscription.count({ where: { subscriberBusinessId: business.id } })) === 0) await prisma.platformSubscription.create({ data: { subscriberType: "business", subscriberBusinessId: business.id, plan: "business_subscription", status: "active", billingInterval: "yearly", processorSubscriptionId: `sub_seed_${randomBytes(8).toString("hex")}`, currentPeriodEnd: new Date(subAt.getTime() + 365 * DAY), createdAt: subAt } });
    if ((await prisma.platformSubscription.count({ where: { subscriberBusinessId: business.id } })) === 1 && !(await prisma.paymentTransaction.findFirst({ where: { relatedObjectType: "platform_subscription", relatedObjectId: business.id } }))) await prisma.paymentTransaction.create({ data: { kind: "platform_subscription_charge", payerId: me.id, amount: 200, currency: "usd", platformFee: 200, processor: "stripe_connect", processorReference: `in_seed_${randomBytes(8).toString("hex")}`, status: "succeeded", relatedObjectType: "platform_subscription", relatedObjectId: business.id, createdAt: subAt } });
    tally("business");

    // Reviews (+ responses), business posts, sales.
    const reviewers = shuffle(dots.filter((d) => !teamPool.some((t) => t.id === d.id)));
    const reviewRows = BUSINESS.reviews.map(([rating, body], i) => ({ id: randomUUID(), businessId: business.id, authorId: reviewers[i].id, rating, body, createdAt: after([reviewers[i].createdAt], Math.max(reviewers[i].createdAt, now - 100 * DAY), now - DAY) }));
    await prisma.review.createMany({ data: reviewRows });
    await prisma.reviewResponse.createMany({ data: reviewRows.filter(() => chance(0.5)).map((r) => ({ reviewId: r.id, responderId: me.id, body: pick(BUSINESS.responses), createdAt: after([], r.createdAt.getTime(), r.createdAt.getTime() + 3 * DAY) })) });
    await prisma.business.update({ where: { id: business.id }, data: { reviewCount: reviewRows.length, averageRating: round2(reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length) } });
    reviewRows.slice(0, 5).forEach((r) => notifs.push({ recipientId: me.id, actorId: r.authorId, type: "business_review", subjectType: "business", subjectId: BUSINESS.slug, createdAt: r.createdAt, readAt: markRead(r.createdAt) }));
    tally("reviews", reviewRows.length);

    type BPost = { id: string; authorId: string; businessAuthorId: string; body: string; createdAt: Date; likeCount: number; replyCount: number; replyToId: string | null };
    const bPosts: BPost[] = [];
    const bLikes: { postId: string; userId: string; createdAt: Date }[] = [];
    BUSINESS.posts.forEach((body, i) => {
      const createdAt = spread(i, BUSINESS.posts.length, 110);
      const likers = shuffle(dots).slice(0, between(20, 80));
      const p: BPost = { id: randomUUID(), authorId: me.id, businessAuthorId: business.id, body, createdAt, likeCount: likers.length, replyCount: 0, replyToId: null };
      bPosts.push(p);
      likers.forEach((d) => bLikes.push({ postId: p.id, userId: d.id, createdAt: after([d.createdAt], Math.max(createdAt.getTime(), d.createdAt), now) }));
      for (const d of shuffle(dots).slice(0, between(1, 5))) {
        bPosts.push({ id: randomUUID(), authorId: d.id, businessAuthorId: undefined as never, body: pick(REPLIES), createdAt: after([d.createdAt], Math.max(createdAt.getTime(), d.createdAt), now), likeCount: 0, replyCount: 0, replyToId: p.id });
        p.replyCount++;
      }
    });
    await prisma.post.createMany({ data: bPosts.map((p) => ({ id: p.id, authorId: p.authorId, businessAuthorId: p.businessAuthorId ?? null, body: p.body, createdAt: p.createdAt, likeCount: p.likeCount, replyCount: p.replyCount, replyToId: p.replyToId })) });
    for (const part of chunk(bLikes, 800)) await prisma.postLike.createMany({ data: part });
    tally("businessPosts", BUSINESS.posts.length);

    // Sales from the shop (card payments, INR).
    let sales = 0;
    for (const o of business.offerings.filter((x) => x.price !== null)) {
      for (const buyer of shuffle(reviewers).slice(0, between(3, 12))) {
        const at = after([buyer.createdAt], Math.max(buyer.createdAt, orgStart + 5 * DAY), now - HOUR);
        const qty = o.kind === "product" ? between(1, 3) : 1;
        const pt = pay({ kind: "business_purchase", payerId: buyer.id, payeeId: null, payeeBusinessId: business.id, amount: (o.price ?? 0) * qty, currency: "inr", related: ["offering", o.id], at });
        await prisma.paymentTransaction.create({ data: { id: pt.id, kind: pt.kind, payerId: pt.payerId, payeeBusinessId: business.id, amount: pt.amount, currency: "inr", platformFee: pt.platformFee, processor: "stripe_connect", processorReference: pt.ref, status: "succeeded", relatedObjectType: "offering", relatedObjectId: o.id, createdAt: at } });
        await prisma.offeringPurchase.create({ data: { offeringId: o.id, buyerId: buyer.id, paymentTransactionId: pt.id, quantity: qty, status: chance(0.85) ? "fulfilled" : "pending", createdAt: at } });
        sales++;
      }
    }
    pts.length = 0; // already written above
    tally("shopSales", sales);

    // ================= Jobs =================
    let apps = 0;
    for (const j of JOBS) {
      const postedAt = spread(pick([0, 1, 2, 3]), 4, 40);
      const job = await prisma.job.create({ data: { businessId: business.id, title: j.title, description: j.description, location: j.remote ? null : j.city, isRemote: j.remote, employmentType: j.type, salaryMin: j.min, salaryMax: j.max, status: "open", postedAt, closesAt: new Date(now + between(14, 50) * DAY) } });
      const pool = shuffle(dots);
      const fits = pool.filter((d) => j.fit.test(d.bio));
      const applicants = [...fits.slice(0, between(4, 9)), ...pool.filter((d) => !fits.includes(d)).slice(0, between(1, 4))];
      const rows = applicants.map((a) => {
        const r = rand();
        const createdAt = after([a.createdAt], Math.max(postedAt.getTime(), a.createdAt), now);
        notifs.push({ recipientId: me.id, actorId: a.id, type: "job_application", subjectType: "business", subjectId: `${BUSINESS.slug}/jobs/${job.id}`, createdAt, readAt: markRead(createdAt) });
        if (r >= 0.5) notifs.push({ recipientId: a.id, actorId: me.id, type: "application_status", subjectType: "business", subjectId: `${BUSINESS.slug}/jobs/${job.id}`, createdAt: after([], createdAt.getTime(), createdAt.getTime() + 5 * DAY), readAt: null });
        return { jobId: job.id, applicantId: a.id, coverNote: pick(APPLICATION_NOTES), resumeUrl: `/${a.handle}/resume`, status: r < 0.5 ? "submitted" : r < 0.8 ? "reviewed" : "rejected", createdAt };
      });
      await prisma.jobApplication.createMany({ data: rows });
      apps += rows.length;
    }
    tally("jobs", JOBS.length);
    tally("applications", apps);

    // Volunteer sign-up form.
    const form = await prisma.form.create({ data: { ownerType: "business", ownerBusinessId: business.id, title: BUSINESS_FORM.title, description: BUSINESS_FORM.description, fieldsJson: JSON.stringify(BUSINESS_FORM.fields), mode: "form", status: "published", createdAt: new Date(orgStart + 10 * DAY) } });
    const volunteers = shuffle(dots).slice(0, 60);
    await prisma.formResponse.createMany({ data: volunteers.map((d) => ({ formId: form.id, respondentId: d.id, answersJson: JSON.stringify({ [BUSINESS_FORM.fields[0].label]: d.name, [BUSINESS_FORM.fields[1].label]: pick(BUSINESS_FORM.fields[1].options), [BUSINESS_FORM.fields[2].label]: between(1, 5), [BUSINESS_FORM.fields[3].label]: new Date(now + between(3, 40) * DAY).toISOString().slice(0, 10), [BUSINESS_FORM.fields[4].label]: chance(0.4) ? "Happy to help wherever needed." : "" }), submittedAt: after([d.createdAt], Math.max(d.createdAt, now - 80 * DAY), now) })) });
    tally("volunteerSignups", volunteers.length);

    // ================= Fundraising =================
    let donations = 0;
    for (const c of CAMPAIGNS) {
      const createdAt = spread(pick([1, 2, 3]), 4, 70);
      const campaign = await prisma.fundraisingCampaign.create({ data: { organizerType: "business", organizerBusinessId: business.id, title: c.title, description: c.description, goalAmount: c.goal, currency: "usd", endsAt: new Date(now + c.days * DAY), createdAt } });
      let raised = 0;
      const donors = shuffle(dots).slice(0, between(45, 85));
      for (const d of donors) {
        if (c.goal && raised >= c.goal) break;
        const amount = pick([10, 25, 25, 50, 100, 100, 250, 500]) * c.boost;
        const at = after([d.createdAt], Math.max(createdAt.getTime(), d.createdAt), now - HOUR);
        const pt = await prisma.paymentTransaction.create({ data: { kind: "donation", payerId: d.id, payeeBusinessId: business.id, amount, currency: "usd", platformFee: round2(amount * 0.1), processor: "stripe_connect", processorReference: `pi_seed_${randomBytes(10).toString("hex")}`, status: "succeeded", relatedObjectType: "fundraising_campaign", relatedObjectId: campaign.id, createdAt: at }, select: { id: true } });
        await prisma.donation.create({ data: { campaignId: campaign.id, donorId: d.id, amount, currency: "usd", message: pick(["For the seeds 🌱", "Thank you for what you do", "Proud to support this", "", "", "Keep going!"]) || null, isAnonymous: chance(0.15), paymentTransactionId: pt.id, createdAt: at } });
        raised += amount;
        donations++;
      }
      await prisma.fundraisingCampaign.update({ where: { id: campaign.id }, data: { raisedAmount: raised, status: c.goal && raised >= c.goal ? "completed" : "active" } });
    }
    tally("campaigns", CAMPAIGNS.length);
    tally("donations", donations);

    // ================= Community: Scale Ladder =================
    writeFileSync("public/uploads/showcase-scale-ladder.svg", dotSquareSvg("Scale Ladder", 7, "#5f3dc4", 512, "community"));
    writeFileSync("public/uploads/showcase-scale-ladder-cover.svg", ringsCoverSvg(SCALES.map((s) => s.name)));
    const communityAt = new Date(orgStart + 3 * DAY);
    const mods = shuffle(dots).slice(0, 4);
    const members = shuffle(dots).slice(0, 80);
    const community = await prisma.community.create({
      data: {
        slug: COMMUNITY.slug, name: COMMUNITY.name, description: COMMUNITY.description, visibility: "public", avatarUrl: "/uploads/showcase-scale-ladder.svg", coverUrl: "/uploads/showcase-scale-ladder-cover.svg", createdBy: me.id, createdAt: communityAt,
        tags: { create: COMMUNITY.tags.map((tag) => ({ tag })) },
        rules: { create: COMMUNITY.rules.map(([title, body], position) => ({ title, body, position })) },
        flairs: { create: COMMUNITY.flairs.map(([label, color]) => ({ label, color })) },
      },
      select: { id: true, flairs: { select: { id: true, label: true } } },
    });
    const activeMembers = [...new Map([...mods, ...members].map((d) => [d.id, d])).values()];
    await prisma.communityMember.createMany({ data: [{ communityId: community.id, userId: me.id, role: "owner", status: "active", joinedAt: communityAt }, ...activeMembers.map((d) => ({ communityId: community.id, userId: d.id, role: mods.some((m) => m.id === d.id) ? "moderator" : "member", status: "active", joinedAt: after([d.createdAt], Math.max(communityAt.getTime(), d.createdAt), now - DAY) }))] });
    await prisma.community.update({ where: { id: community.id }, data: { memberCount: activeMembers.length + 1 } });
    const flairId = (label: string) => community.flairs.find((f) => f.label === label)?.id ?? null;
    const cPosts: { id: string; authorId: string; body: string; createdAt: Date; communityId: string; flairId: string | null; pinnedAt: Date | null; likeCount: number; replyCount: number; replyToId: string | null }[] = [];
    const cLikes: { postId: string; userId: string; createdAt: Date }[] = [];
    const welcome = { id: randomUUID(), authorId: me.id, body: COMMUNITY.pinned, createdAt: new Date(communityAt.getTime() + HOUR), communityId: community.id, flairId: null, pinnedAt: new Date(communityAt.getTime() + HOUR), likeCount: 0, replyCount: 0, replyToId: null as string | null };
    cPosts.push(welcome);
    COMMUNITY.posts.forEach(([scale, body], i) => {
      const authorIsIra = i % 3 === 0;
      const author = authorIsIra ? { id: me.id, createdAt: me.createdAt } : pick(activeMembers);
      const createdAt = spread(i, COMMUNITY.posts.length, 100);
      const likers = shuffle(activeMembers).slice(0, between(10, 40));
      const p = { id: randomUUID(), authorId: author.id, body, createdAt, communityId: community.id, flairId: flairId(scale), pinnedAt: null as Date | null, likeCount: likers.length, replyCount: 0, replyToId: null as string | null };
      cPosts.push(p);
      likers.forEach((d) => cLikes.push({ postId: p.id, userId: d.id, createdAt: after([d.createdAt], Math.max(createdAt.getTime(), d.createdAt), now) }));
      for (const d of shuffle(activeMembers.filter((m) => m.id !== author.id)).slice(0, between(2, 6))) {
        cPosts.push({ id: randomUUID(), authorId: d.id, body: pick(ARTICLE_COMMENTS), createdAt: after([d.createdAt], Math.max(createdAt.getTime(), d.createdAt), now), communityId: community.id, flairId: null, pinnedAt: null, likeCount: 0, replyCount: 0, replyToId: p.id });
        p.replyCount++;
      }
    });
    for (const d of shuffle(activeMembers).slice(0, 25)) cLikes.push({ postId: welcome.id, userId: d.id, createdAt: after([d.createdAt], Math.max(communityAt.getTime(), d.createdAt), now) });
    welcome.likeCount = 25;
    await prisma.post.createMany({ data: [...cPosts.filter((p) => !p.replyToId), ...cPosts.filter((p) => p.replyToId)] });
    for (const part of chunk(cLikes, 800)) await prisma.postLike.createMany({ data: part });
    for (const [pos, [title, body]] of COMMUNITY.wiki.entries()) {
      const page = await prisma.wikiPage.create({ data: { communityId: community.id, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), title, kind: "wiki", position: pos, createdAt: communityAt } });
      const rev = await prisma.wikiRevision.create({ data: { wikiPageId: page.id, body: `# ${title}\n\n${body}`, editedBy: me.id, createdAt: communityAt } });
      await prisma.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: rev.id } });
    }
    await prisma.communityChatMessage.createMany({ data: Array.from({ length: 40 }, () => { const d = pick(activeMembers); return { communityId: community.id, senderId: d.id, body: pick(COMMUNITY.chat), createdAt: after([d.createdAt], Math.max(communityAt.getTime(), d.createdAt), now) }; }) });
    const voiceEnded = await prisma.voiceRoom.create({ data: { communityId: community.id, title: "Open mic: ask a systems thinker anything", status: "ended", startsAt: new Date(now - 10 * DAY), endedAt: new Date(now - 10 * DAY + 70 * MIN), createdBy: me.id, createdAt: new Date(now - 14 * DAY) } });
    await prisma.voiceRoom.create({ data: { communityId: community.id, title: "Weekly wins: live audio hangout", status: "scheduled", startsAt: new Date(now + 4 * DAY), createdBy: me.id, createdAt: new Date(now - 2 * DAY) } });
    void voiceEnded;
    tally("communityMembers", activeMembers.length + 1);
    tally("communityPosts", cPosts.length);

    // ================= Events =================
    const premiumFee = 0.1;
    const dotUser = null as { id: string } | null;
    const eventIds: Record<string, string> = {};
    let rsvpTotal = 0;
    let ticketTotal = 0;
    for (const e of EVENTS) {
      const local = new Date(now + e.day * DAY + 330 * MIN);
      const startsAt = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), e.hour, 0) - 330 * MIN);
      const inPerson = e.format !== "virtual";
      const coords = EVENT_CITY_COORDS[e.city] ?? EVENT_CITY_COORDS.Kochi ?? [9.9312, 76.2673];
      const createdAt = after([me.createdAt], Math.min(startsAt.getTime() - 45 * DAY, now - 3 * DAY), Math.min(startsAt.getTime() - 3 * DAY, now - 6 * HOUR));
      writeFileSync(`public/uploads/event-${e.slug}.svg`, ringsCoverSvg(SCALES.map((s) => s.name)));
      const upcoming = startsAt.getTime() > now;
      const event = await prisma.event.create({
        data: {
          slug: e.slug, hostedByBusinessId: e.host === "business" ? business.id : null, hostedByCommunityId: e.host === "community" ? community.id : null, hostedByUserId: e.host === "user" ? me.id : null, createdBy: me.id,
          title: e.title, description: e.description, coverImageUrl: `/uploads/event-${e.slug}.svg`, format: e.format, location: inPerson ? `${pick(VENUES)}, ${e.city || "Kochi"}` : null,
          latitude: inPerson ? coords[0] + (rand() - 0.5) * 0.05 : null, longitude: inPerson ? coords[1] + (rand() - 0.5) * 0.05 : null, virtualJoinUrl: e.format === "in_person" ? null : `https://meet.example/${e.slug}`,
          startsAt, endsAt: new Date(startsAt.getTime() + e.hours * HOUR), timezone: "Asia/Kolkata", status: "published", capacity: e.capacity, attendeeListVisibility: e.visibility, createdAt,
        },
        select: { id: true },
      });
      eventIds[e.slug] = event.id;
      const types = [] as { id: string; price: number | null; total: number | null; sold: number }[];
      for (const [name, price, total] of e.tickets) {
        const t = await prisma.ticketType.create({ data: { eventId: event.id, name, price, currency: price === null ? null : "INR", quantityTotal: total, quantitySold: 0, salesStartAt: createdAt, salesEndAt: startsAt, createdAt }, select: { id: true } });
        types.push({ id: t.id, price, total, sold: 0 });
      }
      // RSVPs (going bounded by capacity) and tickets for going attendees.
      const want = between(e.size[0], e.size[1]);
      const people = shuffle(dots).slice(0, Math.min(want, dots.length));
      let capLeft = e.capacity ?? Infinity;
      const rsvps: { eventId: string; userId: string; status: string; createdAt: Date }[] = [];
      const going: { id: string; createdAt: number }[] = [];
      for (const a of people) {
        let st = a.id === dotUser?.id ? "going" : rand() < 0.66 ? "going" : rand() < 0.9 ? "interested" : "not_going";
        if (st === "going" && capLeft <= 0) st = "interested";
        if (st === "going") { capLeft--; going.push({ id: a.id, createdAt: a.createdAt }); }
        rsvps.push({ eventId: event.id, userId: a.id, status: st, createdAt: after([a.createdAt], Math.max(createdAt.getTime(), a.createdAt), Math.min(startsAt.getTime(), now)) });
      }
      await prisma.eventRSVP.createMany({ data: rsvps });
      rsvpTotal += rsvps.length;
      const tickets: { id: string; ticketTypeId: string; ownerId: string; paymentTransactionId: string | null; status: string; qrCodeToken: string; checkedInAt: Date | null; createdAt: Date }[] = [];
      if (types.length) {
        for (const a of going) {
          if (rand() > (a.id === dotUser?.id ? 1 : 0.75)) continue;
          const t = pick(types.filter((x) => x.total === null || x.sold < x.total));
          if (!t) continue;
          t.sold++;
          const bought = after([a.createdAt], Math.max(createdAt.getTime(), a.createdAt), Math.min(startsAt.getTime() - MIN, now));
          let ptId: string | null = null;
          if (t.price !== null) {
            const payeeIsBusiness = e.host === "business";
            const pt = await prisma.paymentTransaction.create({ data: { kind: "ticket_purchase", payerId: a.id, payeeId: payeeIsBusiness ? null : me.id, payeeBusinessId: payeeIsBusiness ? business.id : null, amount: t.price, currency: "inr", platformFee: round2(t.price * premiumFee), processor: "stripe_connect", processorReference: `pi_seed_${randomBytes(10).toString("hex")}`, status: "succeeded", relatedObjectType: "ticket", relatedObjectId: "", createdAt: bought }, select: { id: true } });
            ptId = pt.id;
          }
          tickets.push({ id: randomUUID(), ticketTypeId: t.id, ownerId: a.id, paymentTransactionId: ptId, status: !upcoming && chance(0.78) ? "checked_in" : "valid", qrCodeToken: randomBytes(24).toString("hex"), checkedInAt: !upcoming ? new Date(startsAt.getTime() + between(0, 40) * MIN) : null, createdAt: bought });
        }
        if (tickets.length) await prisma.ticket.createMany({ data: tickets });
        for (const t of types) await prisma.ticketType.update({ where: { id: t.id }, data: { quantitySold: t.sold } });
        ticketTotal += tickets.length;
      }
    }
    // Link the upcoming summit-preview livestream to the summit and a voice room to the meetup.
    const preview = await prisma.livestream.findFirst({ where: { creatorId: me.id, status: "scheduled" }, select: { id: true } });
    if (preview) await prisma.livestream.update({ where: { id: preview.id }, data: { eventId: eventIds["seed_to_planet_summit"] } });
    tally("events", EVENTS.length);
    tally("rsvps", rsvpTotal);
    tally("tickets", ticketTotal);

    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });
    void SCALE_COLORS;
    void int;
    console.log("Done: " + Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ") + `. Notifications: ${notifs.length}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
