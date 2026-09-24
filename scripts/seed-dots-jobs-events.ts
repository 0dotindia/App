import { randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { validateEventSlugFormat } from "../src/lib/reserved-event-slugs";
import { PALETTES, coverSvg } from "./seed-dots-art";
import { SEED_EMAIL_DOMAIN } from "./seed-dots-cleanup";
import { PEOPLE, type RoleKey } from "./seed-dots-data";
import { BUSINESSES } from "./seed-dots-orgs-data";
import { COVER_NOTES, EVENTS, EVENT_CITY_COORDS, JOBS, VENUES, type EventT } from "./seed-dots-jobs-events-data";

// Jobs and Events for the seeded dots (seed-dots.ts) and the platform account (@dot):
//   Jobs   - 3-4 openings per seeded business (+2 for @dot's business), applications from dots
//            (submitted/reviewed/rejected/hired, with notifications both ways), job alerts and
//            "job alert match" notifications, salaries fixed to USD scale (the board shows "$").
//   Events - ~36 events hosted by seeded communities, businesses, dots and @dot: in-person/virtual/hybrid,
//            past and upcoming (+ a draft and a cancellation), map coordinates, ticket types, free and paid
//            tickets (paid = stripe_connect ticket_purchase payments, INR), check-ins, RSVPs.
//   Also puts seeded businesses on the map (BusinessLocation latitude/longitude).
// @dot applies to jobs, has a job alert, hosts two events + a community event, RSVPs and buys tickets.
// Run seed-dots.ts, seed-dots-orgs.ts and (for @dot's community) seed-dots-platform-orgs.ts first.
//
// Everything belonging to seeded accounts is removed by delete-seed-users.ts (cascades + the existing
// payment cleanup). Local only (refuses non-file: DATABASE_URL unless ALLOW_REMOTE=1).
// Usage: npx tsx scripts/seed-dots-jobs-events.ts          (skips jobs/events that already exist)
//        RESET=1 npx tsx scripts/seed-dots-jobs-events.ts   (delete these jobs/events/alerts first, then reseed)
//        SEED=2 PLATFORM_HANDLE=dot npx tsx scripts/seed-dots-jobs-events.ts

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const IST = 330 * MIN;

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
const rand = mulberry32(Number(process.env.SEED ?? 2));
const int = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + int(hi - lo + 1);
const pick = <T,>(arr: readonly T[]): T => arr[int(arr.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T,>(arr: readonly T[]): T[] => [...arr].sort(() => rand() - 0.5);
const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const round2 = (n: number) => Math.round(n * 100) / 100;

// Jobs from seed-dots-orgs.ts were written with rupee-scale salaries; the board shows "$".
const SALARY_FIX: Record<string, [number, number]> = { "Barista (Part-time)": [1500, 2000], "Keyboard Instructor": [2400, 3400], "Backend Engineer": [16000, 26000], "Front Desk Coordinator": [2600, 3400] };
const DOT_JOBS = [
  { title: "Community Moderator", type: "part_time", description: "Help keep 0dot communities friendly and welcoming. Evenings and weekends, fully remote.", remote: true, min: 1800, max: 2600, fit: /Writer|Teacher|Student|Marketing/i },
  { title: "Product Designer (Contract)", type: "contract", description: "Shape new 0dot features for creators and businesses. Strong systems thinking and accessibility skills.", remote: true, min: 9000, max: 16000, fit: /Designer|Design|UX|Illustrator/i },
];
const DOT_ALERT = { keywords: "designer", remote: true }; // marker for RESET

type Dot = { id: string; handle: string; createdAt: number; role: RoleKey; bio: string; city: string; profileId: string };

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  const handle = (process.env.PLATFORM_HANDLE ?? "dot").toLowerCase();
  console.log(`Seeding jobs & events at: ${url}`);
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  const now = Date.now();
  const seedUser = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };

  try {
    const platformName = await prisma.username.findUnique({ where: { handle }, select: { userId: true, user: { select: { createdAt: true } } } });
    if (!platformName) throw new Error(`No account with handle @${handle}.`);
    const P = platformName.userId;
    const eventSlugs = EVENTS.map((e) => e.slug);
    const jobTitles = [...Object.values(JOBS).flat().map((j) => j.title), ...DOT_JOBS.map((j) => j.title)];

    // ---------- RESET ----------
    if (process.env.RESET === "1") {
      const ptIds = (await prisma.ticket.findMany({ where: { ticketType: { event: { slug: { in: eventSlugs } } }, paymentTransactionId: { not: null } }, select: { paymentTransactionId: true } })).map((t) => t.paymentTransactionId!);
      await prisma.event.deleteMany({ where: { slug: { in: eventSlugs } } });
      for (const part of chunk(ptIds, 500)) await prisma.paymentTransaction.deleteMany({ where: { id: { in: part } } });
      await prisma.job.deleteMany({ where: { title: { in: jobTitles }, OR: [{ business: { creator: seedUser } }, { business: { slug: "dot" } }] } });
      await prisma.jobAlert.deleteMany({ where: { OR: [{ user: seedUser }, { userId: P, filterCriteria: { contains: `"keywords":"${DOT_ALERT.keywords}"` } }] } });
      await prisma.notification.deleteMany({ where: { type: { in: ["job_alert_match", "job_application", "application_status"] }, subjectId: { contains: "/jobs/" }, OR: [{ recipient: seedUser }, { actor: seedUser }, { recipientId: P }] } });
      console.log("RESET: removed seeded jobs, alerts and events.");
    }

    // ---------- people ----------
    const roleByName = new Map(PEOPLE.map(([first, last, , , role]) => [`${first} ${last}`, role]));
    const seededRows = await prisma.user.findMany({
      where: seedUser,
      select: { id: true, createdAt: true, username: { select: { handle: true } }, profile: { select: { id: true, displayName: true, bio: true } } },
    });
    if (seededRows.length === 0) throw new Error("No seeded dots found. Run scripts/seed-dots.ts first.");
    const dots: Dot[] = seededRows.map((u) => {
      const bio = u.profile?.bio ?? "";
      return { id: u.id, handle: u.username!.handle, createdAt: u.createdAt.getTime(), role: roleByName.get(u.profile!.displayName)!, bio, city: /📍 ([^.·]+)/.exec(bio)?.[1]?.trim() ?? "Bengaluru", profileId: u.profile!.id };
    });
    const dotUser: Dot = { id: P, handle, createdAt: platformName.user.createdAt.getTime(), role: "founder", bio: "", city: "Bengaluru", profileId: "" };
    const byId = new Map([...dots, dotUser].map((d) => [d.id, d]));
    const seedBusinesses = await prisma.business.findMany({
      where: { creator: seedUser, status: "active" },
      select: { id: true, slug: true, createdBy: true, createdAt: true, members: { select: { userId: true, role: true } } },
    });
    const dotBusiness = await prisma.business.findUnique({ where: { slug: "dot" }, select: { id: true, slug: true, createdBy: true, createdAt: true, members: { select: { userId: true, role: true } } } });
    const cityBySlug = new Map(BUSINESSES.map((b) => [b.slug, b.city]));
    const communities = await prisma.community.findMany({ where: { OR: [{ creator: seedUser }, { slug: "welcome_hall" }] }, select: { id: true, slug: true, createdBy: true, createdAt: true } });
    // Time helper: after every party exists (an account made an hour ago only has very recent activity).
    const after = (parties: (number | undefined)[], from: number, to: number) => {
      const lo = Math.max(from, ...parties.map((p) => (p ?? 0) + 10 * MIN));
      const hi = Math.max(lo + MIN, Math.min(to, now - 5 * MIN));
      return new Date(lo + rand() * (hi - lo));
    };
    type NotifRow = { recipientId: string; actorId: string | null; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null };
    const notifs: NotifRow[] = [];
    const notify = (recipientId: string, actorId: string | null, type: string, subjectId: string, at: Date) =>
      notifs.push({ recipientId, actorId, type, subjectType: "business", subjectId, createdAt: at, readAt: chance(0.5) ? new Date(at.getTime() + between(2, 900) * MIN) : null });
    const totals: Record<string, number> = {};
    const tally = (k: string, n = 1) => (totals[k] = (totals[k] ?? 0) + n);

    // ---------- fix salary scale on jobs created earlier ----------
    for (const [title, [min, max]] of Object.entries(SALARY_FIX)) await prisma.job.updateMany({ where: { title, business: { creator: seedUser }, salaryMin: { gt: max } }, data: { salaryMin: min, salaryMax: max } });

    // ================= Jobs =================
    type NewJob = { id: string; businessId: string; slug: string; title: string; type: string; remote: boolean; location: string | null; description: string; postedAt: Date; status: string; fit: RegExp; teamIds: Set<string>; notifyIds: string[] };
    const newJobs: NewJob[] = [];
    const jobRows: Record<string, unknown>[] = [];
    const existingTitles = new Set((await prisma.job.findMany({ select: { businessId: true, title: true } })).map((j) => `${j.businessId}:${j.title}`));
    const addJobs = (biz: { id: string; slug: string; createdBy: string; createdAt: Date; members: { userId: string; role: string }[] }, list: { title: string; type: string; description: string; remote: boolean; min: number; max: number; fit: RegExp; open?: boolean }[], city: string | null) => {
      for (const j of list) {
        if (existingTitles.has(`${biz.id}:${j.title}`)) continue;
        const postedAt = after([biz.createdAt.getTime()], now - 40 * DAY, now - 2 * DAY);
        const closed = j.open === false || chance(0.15);
        const id = randomUUID();
        const status = closed ? "closed" : "open";
        jobRows.push({ id, businessId: biz.id, title: j.title, description: j.description, location: j.remote ? null : city, isRemote: j.remote, employmentType: j.type, salaryMin: j.min, salaryMax: j.max, status, postedAt, closesAt: closed ? new Date(postedAt.getTime() + between(10, 25) * DAY) : chance(0.5) ? new Date(now + between(10, 45) * DAY) : null });
        const staff = biz.members.filter((m) => ["owner", "admin"].includes(m.role)).map((m) => m.userId);
        newJobs.push({ id, businessId: biz.id, slug: biz.slug, title: j.title, type: j.type, remote: j.remote, location: j.remote ? null : city, description: j.description, postedAt, status, fit: j.fit, teamIds: new Set(biz.members.map((m) => m.userId).concat(biz.createdBy)), notifyIds: [...new Set([biz.createdBy, ...staff])] });
      }
    };
    for (const b of seedBusinesses) if (JOBS[b.slug]) addJobs(b, JOBS[b.slug], cityBySlug.get(b.slug) ?? null);
    if (dotBusiness) addJobs(dotBusiness, DOT_JOBS.map((j) => ({ ...j, open: true })), null);
    if (jobRows.length) await prisma.job.createMany({ data: jobRows as never });
    tally("jobs", jobRows.length);

    // Applications.
    const appRows: Record<string, unknown>[] = [];
    const appliedPairs = new Set<string>((await prisma.jobApplication.findMany({ select: { jobId: true, applicantId: true } })).map((a) => `${a.jobId}:${a.applicantId}`));
    for (const j of newJobs) {
      const pool = shuffle(dots.filter((d) => !j.teamIds.has(d.id)));
      const fits = pool.filter((d) => j.fit.test(d.bio));
      const applicants = [...fits.slice(0, between(2, 7)), ...pool.filter((d) => !fits.includes(d)).slice(0, between(0, 3))];
      for (const a of applicants) {
        if (appliedPairs.has(`${j.id}:${a.id}`)) continue;
        appliedPairs.add(`${j.id}:${a.id}`);
        const createdAt = after([a.createdAt], j.postedAt.getTime(), now);
        const r = rand();
        const status = j.status === "closed" && r < 0.12 ? "hired" : r < 0.5 ? "submitted" : r < 0.78 ? "reviewed" : "rejected";
        appRows.push({ jobId: j.id, applicantId: a.id, coverNote: pick(COVER_NOTES), resumeUrl: `/${a.handle}/resume`, status, createdAt });
        for (const staffId of j.notifyIds) notify(staffId, a.id, "job_application", `${j.slug}/jobs/${j.id}`, createdAt);
        if (status !== "submitted") notify(a.id, j.notifyIds[0], "application_status", `${j.slug}/jobs/${j.id}`, after([createdAt.getTime()], createdAt.getTime(), createdAt.getTime() + 6 * DAY));
      }
    }
    // @dot applies to four open jobs at seeded businesses.
    for (const j of shuffle(newJobs.filter((x) => x.status === "open" && x.slug !== "dot")).slice(0, 4)) {
      const createdAt = after([dotUser.createdAt], now - 60 * MIN, now);
      appRows.push({ jobId: j.id, applicantId: P, coverNote: "Hello! I'd love to contribute. Happy to share more about my background.", resumeUrl: `/${handle}/resume`, status: "submitted", createdAt });
      for (const staffId of j.notifyIds) notify(staffId, P, "job_application", `${j.slug}/jobs/${j.id}`, createdAt);
    }
    for (const part of chunk(appRows, 400)) await prisma.jobApplication.createMany({ data: part as never });
    tally("applications", appRows.length);

    // Job alerts + matches.
    const KEYWORDS: Partial<Record<RoleKey, string>> = { swe: "engineer", data: "engineer", design: "designer", pm: "manager", teacher: "teacher", finance: "accounts", photo: "photographer", film: "editor", fitness: "instructor", music: "teacher", doctor: "practitioner", student: "intern", marketing: "content", writer: "editor", food: "kitchen", art: "illustrator" };
    const haveAlert = new Set((await prisma.jobAlert.findMany({ select: { userId: true } })).map((a) => a.userId));
    const alertRows: { id: string; userId: string; criteria: { location?: string; remote?: boolean; employmentType?: string; keywords?: string }; createdAt: Date }[] = [];
    const seededAlertsExist = (await prisma.jobAlert.count({ where: { user: seedUser } })) > 0;
    for (const d of seededAlertsExist ? [] : shuffle(dots).slice(0, 36)) {
      if (haveAlert.has(d.id)) continue;
      const kw = KEYWORDS[d.role];
      if (!kw) continue;
      const criteria = { keywords: kw, ...(chance(0.4) ? { remote: true } : { location: d.city }), ...(chance(0.25) ? { employmentType: d.role === "student" ? "internship" : "full_time" } : {}) };
      alertRows.push({ id: randomUUID(), userId: d.id, criteria, createdAt: after([d.createdAt], now - 40 * DAY, now - 3 * DAY) });
    }
    if (!haveAlert.has(P)) alertRows.push({ id: randomUUID(), userId: P, criteria: DOT_ALERT, createdAt: after([dotUser.createdAt], now - 50 * MIN, now) });
    if (alertRows.length) await prisma.jobAlert.createMany({ data: alertRows.map((a) => ({ id: a.id, userId: a.userId, filterCriteria: JSON.stringify(a.criteria), createdAt: a.createdAt })) });
    tally("jobAlerts", alertRows.length);
    let matches = 0;
    for (const a of alertRows) {
      const u = byId.get(a.userId)!;
      for (const j of newJobs) {
        if (j.status !== "open" || j.postedAt.getTime() < Math.max(a.createdAt.getTime(), now - 30 * DAY)) continue;
        if (j.teamIds.has(a.userId)) continue;
        const c = a.criteria;
        if (c.remote && !j.remote) continue;
        if (c.employmentType && c.employmentType !== j.type) continue;
        if (c.location && !(j.location ?? "").toLowerCase().includes(c.location.toLowerCase())) continue;
        if (c.keywords && !`${j.title} ${j.description}`.toLowerCase().includes(c.keywords.toLowerCase())) continue;
        notify(a.userId, null, "job_alert_match", `${j.slug}/jobs/${j.id}`, new Date(Math.max(j.postedAt.getTime() + 5 * MIN, a.createdAt.getTime() + 5 * MIN, u.createdAt + MIN)));
        matches++;
      }
    }
    tally("jobAlertMatches", matches);

    // ================= Business locations on the map =================
    let located = 0;
    for (const b of seedBusinesses) {
      const city = cityBySlug.get(b.slug);
      const c = city ? EVENT_CITY_COORDS[city] : undefined;
      if (!c) continue;
      const { count } = await prisma.businessLocation.updateMany({ where: { businessId: b.id, latitude: null }, data: { latitude: c[0] + (rand() - 0.5) * 0.04, longitude: c[1] + (rand() - 0.5) * 0.04 } });
      located += count;
    }
    tally("businessLocationsMapped", located);

    // ================= Events =================
    const premium = new Set((await prisma.platformSubscription.findMany({ where: { plan: "profile_premium", status: "active" }, select: { subscriberProfile: { select: { userId: true } } } })).map((s) => s.subscriberProfile?.userId).filter(Boolean) as string[]);
    const existingEventSlugs = new Set((await prisma.event.findMany({ select: { slug: true } })).map((e) => e.slug));
    const usedHosts = new Set<string>();
    mkdirSync("public/uploads", { recursive: true });
    type EvRow = Record<string, unknown>;
    const eventRows: EvRow[] = [];
    const ticketTypeRows: Record<string, unknown>[] = [];
    const rsvpRows: { eventId: string; userId: string; status: string; createdAt: Date }[] = [];
    type TicketRow = { id: string; ticketTypeId: string; ownerId: string; ptId: string | null; status: string; qr: string; checkedInAt: Date | null; createdAt: Date };
    const ticketRows: TicketRow[] = [];
    type PT = { id: string; payerId: string; payeeId: string | null; payeeBusinessId: string | null; amount: number; platformFee: number; ref: string; status: string; ticketId: string; createdAt: Date };
    const ptRows: PT[] = [];
    const payees = new Set<string>();
    const payeeBusinesses = new Set<string>();
    const eventMeta: { id: string; creatorId: string; virtual: boolean; upcoming: boolean; status: string; paid: boolean; typeIds: { id: string; price: number | null; total: number | null; sold: number }[] }[] = [];
    const dotRsvpTarget = 8;
    let dotRsvps = 0;
    let dotTickets = 0;

    for (const e of EVENTS as EventT[]) {
      if (existingEventSlugs.has(e.slug)) continue;
      if (validateEventSlugFormat(e.slug) !== null) throw new Error(`Bad event slug: ${e.slug}`);
      // ---- host ----
      let creator: Dot | undefined;
      let hostBusinessId: string | null = null;
      let hostCommunityId: string | null = null;
      let hostUserId: string | null = null;
      let city = "Bengaluru";
      let businessPayeeId: string | null = null;
      if (e.host.kind === "community") {
        const c = communities.find((x) => x.slug === e.host.key);
        if (!c) continue;
        hostCommunityId = c.id;
        creator = byId.get(c.createdBy);
        city = creator?.city ?? city;
      } else if (e.host.kind === "business") {
        const b = seedBusinesses.find((x) => x.slug === e.host.key);
        if (!b) continue;
        hostBusinessId = b.id;
        businessPayeeId = b.id;
        creator = byId.get(b.createdBy);
        city = cityBySlug.get(b.slug) ?? city;
      } else if (e.host.kind === "user") {
        creator = shuffle(dots.filter((d) => d.role === (e.host.key as RoleKey) && !usedHosts.has(d.id)))[0];
        if (!creator) continue;
        hostUserId = creator.id;
        city = creator.city;
      } else {
        creator = dotUser;
        if (e.host.key === "welcome_hall") {
          const c = communities.find((x) => x.slug === "welcome_hall");
          if (!c) continue;
          hostCommunityId = c.id;
        } else hostUserId = P;
      }
      if (!creator) continue;
      usedHosts.add(creator.id);
      const inPerson = e.format !== "virtual";
      const coords = EVENT_CITY_COORDS[city] ?? EVENT_CITY_COORDS.Bengaluru;
      // ---- times (IST wall clock) ----
      const local = new Date(now + e.day * DAY + IST);
      const startsAt = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), e.hour, 0) - IST);
      const endsAt = new Date(startsAt.getTime() + e.hours * 60 * MIN);
      const status = e.status ?? "published";
      const createdAt = after([creator.createdAt], Math.min(startsAt.getTime() - 40 * DAY, now - DAY), Math.min(startsAt.getTime() - 3 * DAY, now - 30 * MIN));
      const id = randomUUID();
      const upcoming = startsAt.getTime() > now;
      writeFileSync(`public/uploads/event-${e.slug}.svg`, coverSvg(PALETTES[int(PALETTES.length)], int(3)));
      eventRows.push({
        id, slug: e.slug, hostedByUserId: hostUserId, hostedByBusinessId: hostBusinessId, hostedByCommunityId: hostCommunityId, createdBy: creator.id, title: e.title, description: e.description,
        coverImageUrl: `/uploads/event-${e.slug}.svg`, format: e.format, location: inPerson ? `${pick(VENUES)}, ${city}` : null, latitude: inPerson ? coords[0] + (rand() - 0.5) * 0.06 : null, longitude: inPerson ? coords[1] + (rand() - 0.5) * 0.06 : null,
        virtualJoinUrl: e.format === "in_person" ? null : `https://meet.example/${e.slug}`, startsAt, endsAt, timezone: "Asia/Kolkata", status, capacity: e.capacity,
        attendeeListVisibility: e.visibility ?? (chance(0.7) ? "public" : "attendees_only"), createdAt, updatedAt: createdAt,
      });
      // ---- ticket types ----
      const typeIds = e.tickets.map(([name, price, total]) => {
        const tid = randomUUID();
        ticketTypeRows.push({ id: tid, eventId: id, name, price, currency: price === null ? null : "INR", quantityTotal: total, quantitySold: 0, salesStartAt: createdAt, salesEndAt: startsAt, createdAt });
        return { id: tid, price, total, sold: 0 };
      });
      const paid = typeIds.some((t) => t.price !== null);
      if (paid) { if (businessPayeeId) payeeBusinesses.add(businessPayeeId); else payees.add(creator.id); }
      eventMeta.push({ id, creatorId: creator.id, virtual: e.format !== "in_person", upcoming, status, paid, typeIds });

      if (status === "draft") continue;
      // ---- RSVPs and tickets ----
      const going = new Set<string>();
      const pool = shuffle(dots.filter((d) => d.id !== creator!.id));
      const fit = pool.filter((d) => e.fit.test(d.bio));
      const want = between(e.size[0], e.size[1]);
      const chosen = [...fit.slice(0, Math.ceil(want * 0.75)), ...pool.filter((d) => !fit.includes(d)).slice(0, want)].slice(0, want);
      const forDot = e.host.kind === "platform" || (upcoming && status === "published" && dotRsvps < dotRsvpTarget && chance(0.3));
      if (e.host.kind !== "platform" && creator.id !== P && forDot && !chosen.some((c) => c.id === P)) { chosen.push(dotUser); dotRsvps++; }
      const capLeft = { n: e.capacity ?? Infinity };
      for (const a of chosen) {
        const r = rand();
        let st = a.id === P ? "going" : status === "cancelled" ? (r < 0.6 ? "going" : "interested") : r < 0.65 ? "going" : r < 0.93 ? "interested" : "not_going";
        if (st === "going" && capLeft.n <= 0) st = "interested";
        if (st === "going") { capLeft.n--; going.add(a.id); }
        rsvpRows.push({ eventId: id, userId: a.id, status: st, createdAt: after([a.createdAt, creator!.createdAt], createdAt.getTime(), Math.min(startsAt.getTime(), now)) });
      }
      if (typeIds.length && e.host.kind !== "platform") {
        for (const a of chosen) {
          if (!going.has(a.id) || capLeft.n < 0) continue;
          if (!chance(a.id === P ? 1 : 0.7)) continue;
          if (a.id === P && !(upcoming && paid && dotTickets < 2)) continue;
          const t = pick(typeIds.filter((x) => x.total === null || x.sold < x.total)) ?? null;
          if (!t) continue;
          t.sold++;
          const tId = randomUUID();
          const bought = after([a.createdAt, creator!.createdAt], createdAt.getTime(), Math.min(startsAt.getTime() - MIN, now));
          const cancelledEvent = status === "cancelled";
          const past = !upcoming;
          let ptId: string | null = null;
          if (t.price !== null) {
            ptId = randomUUID();
            const rate = premium.has(creator!.id) && !businessPayeeId ? 0.07 : 0.1;
            ptRows.push({ id: ptId, payerId: a.id, payeeId: businessPayeeId ? null : creator!.id, payeeBusinessId: businessPayeeId, amount: t.price, platformFee: round2(t.price * rate), ref: `pi_seed_${randomBytes(10).toString("hex")}`, status: cancelledEvent ? "refunded" : "succeeded", ticketId: tId, createdAt: bought });
            if (a.id === P) dotTickets++;
          }
          ticketRows.push({ id: tId, ticketTypeId: t.id, ownerId: a.id, ptId, status: cancelledEvent ? "cancelled" : past && chance(0.75) ? "checked_in" : "valid", qr: randomBytes(24).toString("hex"), checkedInAt: past && !cancelledEvent ? new Date(startsAt.getTime() + between(0, 40) * MIN) : null, createdAt: bought });
          if (cancelledEvent) t.sold--; // cancelled tickets don't count as sold
        }
      }
    }
    tally("events", eventRows.length);

    // Payout accounts for hosts that sell tickets.
    const havePayout = new Set((await prisma.creatorPayoutAccount.findMany({ select: { userId: true, businessId: true } })).flatMap((r) => [r.userId, r.businessId]).filter(Boolean) as string[]);
    const payoutRows = [
      ...[...payees].filter((id) => !havePayout.has(id)).map((userId) => ({ userId, processor: "stub", processorAccountId: `acct_seed_${randomBytes(6).toString("hex")}`, country: "IN", status: "active" })),
      ...[...payeeBusinesses].filter((id) => !havePayout.has(id)).map((businessId) => ({ businessId, processor: "stub", processorAccountId: `acct_seed_${randomBytes(6).toString("hex")}`, country: "IN", status: "active" })),
    ];

    // ---------- write ----------
    if (payoutRows.length) await prisma.creatorPayoutAccount.createMany({ data: payoutRows as never });
    if (eventRows.length) await prisma.event.createMany({ data: eventRows as never });
    for (const m of eventMeta) for (const t of m.typeIds) { const row = ticketTypeRows.find((r) => r.id === t.id)!; row.quantitySold = t.sold; }
    if (ticketTypeRows.length) await prisma.ticketType.createMany({ data: ticketTypeRows as never });
    for (const part of chunk(rsvpRows, 500)) await prisma.eventRSVP.createMany({ data: part });
    for (const part of chunk(ptRows, 400)) {
      await prisma.paymentTransaction.createMany({
        data: part.map((p) => ({ id: p.id, kind: "ticket_purchase", payerId: p.payerId, payeeId: p.payeeId, payeeBusinessId: p.payeeBusinessId, amount: p.amount, currency: "inr", platformFee: p.platformFee, processor: "stripe_connect", processorReference: p.ref, status: p.status, relatedObjectType: "ticket", relatedObjectId: p.ticketId, createdAt: p.createdAt })),
      });
    }
    for (const part of chunk(ticketRows, 400)) await prisma.ticket.createMany({ data: part.map((t) => ({ id: t.id, ticketTypeId: t.ticketTypeId, ownerId: t.ownerId, paymentTransactionId: t.ptId, status: t.status, qrCodeToken: t.qr, checkedInAt: t.checkedInAt, createdAt: t.createdAt })) });
    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });
    tally("rsvps", rsvpRows.length);
    tally("tickets", ticketRows.length);
    tally("paidTickets", ptRows.length);

    // Attach a few existing upcoming livestreams to virtual events by the same creator.
    let attached = 0;
    for (const m of eventMeta.filter((x) => x.virtual && x.upcoming && x.status === "published")) {
      const ls = await prisma.livestream.findFirst({ where: { creatorId: m.creatorId, status: "scheduled", eventId: null }, select: { id: true } });
      if (ls && attached < 6) { await prisma.livestream.update({ where: { id: ls.id }, data: { eventId: m.id } }); attached++; }
    }
    tally("livestreamsLinked", attached);

    console.log("Done: " + (Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing new") + `; ${payoutRows.length} new payout accounts. Notifications: ${notifs.length}.`);
    console.log(`@${handle}: ${appRows.filter((a) => a.applicantId === P).length} job applications, ${rsvpRows.filter((r) => r.userId === P).length} RSVPs, ${ticketRows.filter((t) => t.ownerId === P).length} tickets. Cleanup: RESET=1 npx tsx scripts/seed-dots-jobs-events.ts (or delete-seed-users.ts)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
