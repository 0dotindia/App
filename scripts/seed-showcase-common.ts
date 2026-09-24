import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PEOPLE, type RoleKey } from "./seed-dots-data";

// Shared plumbing for the showcase scripts (seed-showcase-*.ts): one flagship "world-class" example
// profile, @ira, whose work runs from the smallest dot (a seed) to the largest things that matter to
// live (the planet). The account uses its own email domain, NOT the seed domain, so the per-role
// seed scripts never mistake it for one of the 99 dots; cleanup uses the same helpers as @dot's
// (cleanup helpers take a domain).

export const SHOWCASE_DOMAIN = "showcase.0dot.local";
export const SHOWCASE_HANDLE = (process.env.SHOWCASE_HANDLE ?? "ira").toLowerCase();
export const SHOWCASE_EMAIL = `${SHOWCASE_HANDLE}@${SHOWCASE_DOMAIN}`;
export const SHOWCASE_PASSWORD = "SeedUser!2026";
export const SEED_DOMAIN = "seed.0dot.local";

export const DAY = 24 * 60 * 60 * 1000;
export const HOUR = 60 * 60 * 1000;
export const MIN = 60 * 1000;

export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    rand: next,
    int,
    between: (lo: number, hi: number) => lo + int(hi - lo + 1),
    pick: <T,>(arr: readonly T[]): T => arr[int(arr.length)],
    chance: (p: number) => next() < p,
    shuffle: <T,>(arr: readonly T[]): T[] => [...arr].sort(() => next() - 0.5),
  };
}

export const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
export const snake = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
export const round2 = (n: number) => Math.round(n * 100) / 100;

export async function openDb() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") && process.env.ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed non-local database (${url.split("@").pop()}). Set ALLOW_REMOTE=1 to override.`);
  }
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // no .env.local
  }
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? url, authToken: process.env.DATABASE_AUTH_TOKEN }) });
  // The dev server keeps this SQLite file open; wait for its writes instead of failing with SQLITE_BUSY.
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 120000");
  return { url, prisma };
}

export type Dot = { id: string; handle: string; createdAt: number; role: RoleKey; bio: string; city: string; profileId: string; name: string; first: string; pop: number };

export async function loadDots(prisma: PrismaClient): Promise<Dot[]> {
  const roleByName = new Map(PEOPLE.map(([first, last, , , role]) => [`${first} ${last}`, role]));
  const rows = await prisma.user.findMany({
    where: { email: { endsWith: `@${SEED_DOMAIN}` } },
    select: { id: true, createdAt: true, username: { select: { handle: true } }, profile: { select: { id: true, displayName: true, bio: true, followerCount: true } } },
  });
  if (rows.length === 0) throw new Error("No seeded dots found. Run scripts/seed-dots.ts first.");
  return rows.map((u) => {
    const bio = u.profile?.bio ?? "";
    const name = u.profile!.displayName;
    return { id: u.id, handle: u.username!.handle, createdAt: u.createdAt.getTime(), role: roleByName.get(name)!, bio, city: /📍 ([^.·]+)/.exec(bio)?.[1]?.trim() ?? "Bengaluru", profileId: u.profile!.id, name, first: name.split(" ")[0], pop: (u.profile?.followerCount ?? 0) + 1 };
  });
}

export type Showcase = { id: string; handle: string; profileId: string; createdAt: number; name: string; email: string };

export async function loadShowcase(prisma: PrismaClient): Promise<Showcase> {
  const u = await prisma.user.findUnique({ where: { email: SHOWCASE_EMAIL }, select: { id: true, createdAt: true, email: true, username: { select: { handle: true } }, profile: { select: { id: true, displayName: true } } } });
  if (!u?.profile) throw new Error(`Showcase account ${SHOWCASE_EMAIL} not found. Run scripts/seed-showcase-profile.ts first.`);
  return { id: u.id, handle: u.username!.handle, profileId: u.profile.id, createdAt: u.createdAt.getTime(), name: u.profile.displayName, email: u.email };
}

// A believable timestamp after every listed party exists and inside [from, to] (capped at "now").
export function makeAfter(now: number, rand: () => number) {
  return (parties: (number | undefined)[], from: number, to: number) => {
    const lo = Math.max(from, ...parties.map((p) => (p ?? 0) + 10 * MIN));
    const hi = Math.max(lo + MIN, Math.min(to, now - 5 * MIN));
    return new Date(lo + rand() * (hi - lo));
  };
}

export type NotifRow = { recipientId: string; actorId: string | null; type: string; subjectType: string; subjectId: string; createdAt: Date; readAt: Date | null };

// ---------- generated art (SVG under public/uploads) ----------
export const SCALE_COLORS = ["#7a4b1e", "#c2255c", "#e8590c", "#f59f00", "#2f9e44", "#1971c2", "#5f3dc4"] as const;

/** A wide cover made of concentric "scale" rings around a single dot. */
export function ringsCoverSvg(labels: readonly string[], w = 1500, h = 500): string {
  const cx = w * 0.72;
  const cy = h * 0.5;
  const rings = labels.map((label, i) => {
    const r = 18 + i * 34;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-opacity="${0.75 - i * 0.07}" stroke-width="2"/><text x="${cx + r * 0.72}" y="${cy - r * 0.72}" font-family="Inter, 'Segoe UI', sans-serif" font-size="13" fill="#fff" fill-opacity="0.85">${label}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d2e"/><stop offset="0.55" stop-color="#0f7a5c"/><stop offset="1" stop-color="#1a9c93"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>${rings.join("")}<circle cx="${cx}" cy="${cy}" r="7" fill="#fff"/>
<text x="60" y="${h - 60}" font-family="Inter, 'Segoe UI', sans-serif" font-size="40" font-weight="600" fill="#fff">From one dot to the whole planet</text>
<text x="60" y="${h - 22}" font-family="Inter, 'Segoe UI', sans-serif" font-size="18" fill="#fff" fill-opacity="0.85">Things that matter to live, at every scale</text>
</svg>`;
}

/** A square: a dot, ringed, with optional initials/label. */
export function dotSquareSvg(text: string, rings: number, color = "#0f7a5c", size = 512, sub = ""): string {
  const c = size / 2;
  const circles = Array.from({ length: rings }, (_, i) => `<circle cx="${c}" cy="${c}" r="${(i + 1) * (size / 2 - 30) / (rings + 0.5)}" fill="none" stroke="#fff" stroke-opacity="${0.8 - i * 0.09}" stroke-width="3"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0b3d2e"/></linearGradient></defs>
<rect width="${size}" height="${size}" fill="url(#g)"/>${circles}<circle cx="${c}" cy="${c}" r="${size * 0.03}" fill="#fff"/>
<text x="${c}" y="${size - 44}" text-anchor="middle" font-family="Inter, 'Segoe UI', sans-serif" font-size="${size * 0.07}" font-weight="600" fill="#fff">${text}</text>${sub ? `<text x="${c}" y="${size - 16}" text-anchor="middle" font-family="Inter, 'Segoe UI', sans-serif" font-size="${size * 0.04}" fill="#fff" fill-opacity="0.85">${sub}</text>` : ""}
</svg>`;
}
