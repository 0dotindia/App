#!/usr/bin/env node
// `prisma migrate deploy` cannot run against this app's production
// DATABASE_URL: Prisma's migrate engine only understands `file:` SQLite
// URLs, and production is a remote libsql/Turso URL (P1013: "the scheme is
// not recognized"). db.ts already talks to that same URL at runtime via
// @prisma/adapter-libsql/@libsql/client, so this applies pending
// prisma/migrations/*/migration.sql files the same way, over the libsql
// wire protocol, recording them in a Prisma-shaped _prisma_migrations table
// so `prisma migrate status` (run against a local file: copy) stays legible.
//
// Usage: DATABASE_URL=libsql://... node scripts/migrate-deploy.mjs
// Local file: DATABASE_URLs are refused — use `prisma migrate deploy` for
// those instead, which handles them natively.
import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma/migrations");

export function splitStatements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Extracted so scripts/__tests__/migrate-deploy.test.mjs can exercise this
// dispatch directly against a scratch DB — this is the exact logic behind
// the 2026-08-31 cascade-delete incident (see the comment on the
// executeMultiple branch), so it's worth a regression test of its own
// rather than only being reachable through the full directory-scanning
// main() below.
export async function applyMigrationSql(client, sql) {
  if (/PRAGMA\s+(defer_)?foreign_keys/i.test(sql)) {
    // A table-rebuild migration (Prisma's "RedefineTables"): it drops and
    // recreates a table, guarding the drop with `PRAGMA foreign_keys=OFF`
    // so the implicit row-delete inside DROP TABLE doesn't cascade to
    // child tables. That PRAGMA is a silent NO-OP inside a transaction —
    // so client.batch (which wraps everything in one) leaves foreign keys
    // ON and `DROP TABLE "User"` cascade-deletes every Session/Username/
    // Profile/LedgerAccount row (production incident 2026-08-31).
    // executeMultiple runs the script with NO implicit transaction — the
    // way `prisma migrate deploy` applies it — so the PRAGMA takes effect.
    // Trade-off: no atomicity, a mid-migration failure leaves it partly
    // applied (fix-forward), same as native prisma migrate deploy.
    await client.executeMultiple(sql);
  } else {
    // client.batch runs all statements in one transaction — a mid-migration
    // failure (e.g. the payment-idempotency migration's unique index
    // rejecting pre-existing duplicate rows) leaves nothing partially
    // applied.
    await client.batch(splitStatements(sql), "write");
  }
}

// Only a production build (or a manual run with no VERCEL_ENV) migrates.
// Preview builds used to migrate too, on the assumption that Preview had
// its own isolated Turso database — but under the Vercel Turso integration
// the build-time DATABASE_URL is production's (dot-0-database), so every
// preview build of an unmerged PR applied its migrations to live data
// (drop_stripe hit production 49 minutes before its PR merged). Previews
// that add migrations now run against the pre-migration schema until
// merge; that is the safe failure.
export function shouldMigrate(vercelEnv) {
  return vercelEnv === undefined || vercelEnv === "" || vercelEnv === "production";
}

async function main() {
  if (!shouldMigrate(process.env.VERCEL_ENV)) {
    console.log(`Skipping migrations: VERCEL_ENV=${process.env.VERCEL_ENV} (only production builds migrate).`);
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL is a local file: URL — use `prisma migrate deploy` for that, not this script (which is only for remote libsql/Turso URLs)."
    );
  }

  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id                    TEXT PRIMARY KEY NOT NULL,
      checksum              TEXT NOT NULL,
      finished_at           DATETIME,
      migration_name        TEXT NOT NULL,
      logs                  TEXT,
      rolled_back_at        DATETIME,
      started_at            DATETIME NOT NULL DEFAULT current_timestamp,
      applied_steps_count   INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `);

  const { rows } = await client.execute(
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL"
  );
  const applied = new Set(rows.map((r) => r.migration_name));

  const pending = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .filter((name) => !applied.has(name));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const name of pending) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
    const statements = splitStatements(sql);

    console.log(`Applying ${name} (${statements.length} statement(s))...`);

    await applyMigrationSql(client, sql);

    await client.execute({
      sql: `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
            VALUES (?, 'applied-via-migrate-deploy.mjs', datetime('now'), ?, datetime('now'), ?)`,
      args: [randomUUID(), name, statements.length],
    });
    console.log(`  done.`);
  }

  console.log(`Applied ${pending.length} migration(s).`);
}

// Only auto-run when executed directly (`node scripts/migrate-deploy.mjs`) —
// scripts/__tests__/migrate-deploy.test.mjs imports splitStatements/
// applyMigrationSql from this same module, and must not trigger a real
// DATABASE_URL connection attempt as a side effect of that import.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
