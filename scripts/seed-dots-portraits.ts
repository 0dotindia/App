import { writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PEOPLE } from "./seed-dots-data";
import { coverArtSvg, portraitSvg } from "./seed-dots-portrait-art";

// Replaces the initials-on-gradient avatars and plain covers of the 99 seeded dots (seed-dots.ts)
// with illustrated portraits (men / women, varied Indian skin tones, hair, clothing) and role-themed covers.
// Files are overwritten in place under public/uploads, so no database change is needed.
//
// Local only. Idempotent: same output every run.
// Usage: npx tsx scripts/seed-dots-portraits.ts

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) throw new Error("Refusing to run against a non-file: DATABASE_URL");
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });
  try {
    const rows = await prisma.profile.findMany({
      where: { avatarUrl: { startsWith: "/uploads/dot-" } },
      select: { displayName: true, avatarUrl: true, coverUrl: true },
    });
    let done = 0;
    for (const row of rows) {
      const idx = PEOPLE.findIndex(([first, last]) => `${first} ${last}` === row.displayName);
      if (idx < 0 || !row.avatarUrl || !row.coverUrl) continue;
      const [, , gender, , role] = PEOPLE[idx];
      writeFileSync(`public${row.avatarUrl}`, portraitSvg(gender, idx + 1));
      writeFileSync(`public${row.coverUrl}`, coverArtSvg(role, idx + 1));
      done++;
    }
    console.log(`Regenerated portraits + covers for ${done} of ${rows.length} seeded profiles (PEOPLE has ${PEOPLE.length}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
