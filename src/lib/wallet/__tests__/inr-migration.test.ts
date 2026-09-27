import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { createUser } from "@/test/factories";
import { splitStatements } from "../../../../scripts/migrate-deploy.mjs";

const MIGRATION = path.resolve(__dirname, "../../../../prisma/migrations/20260927180000_convert_inr_prices_to_coins/migration.sql");

// Runs the migration's statements the way scripts/migrate-deploy.mjs does
// in production (the test DB already applied it once, while empty).
async function runMigration() {
  for (const statement of splitStatements(readFileSync(MIGRATION, "utf8"))) await db.$executeRawUnsafe(statement);
}

// addendum-wallet-only-payments.md §4.1 — INR prices become coin prices
// at ₹100 = 1 coin.
describe("convert_inr_prices_to_coins migration", () => {
  it("converts INR offerings, courses and tickets and leaves other rows alone", async () => {
    const seller = await createUser();
    const inrOffering = await db.offering.create({
      data: { sellerUserId: seller.id, kind: "service", name: "Chai", price: 60, currency: "INR", status: "active" },
    });
    const usdOffering = await db.offering.create({
      data: { sellerUserId: seller.id, kind: "service", name: "Coin", price: 60, currency: "usd", status: "active" },
    });
    const unpriced = await db.offering.create({
      data: { sellerUserId: seller.id, kind: "service", name: "Ask", price: null, currency: null, status: "active" },
    });
    const course = await db.course.create({ data: { creatorId: seller.id, title: "C", price: 1999, currency: "inr", status: "active" } });
    const event = await db.event.create({
      data: { slug: `inr-${Date.now().toString(36)}`, createdBy: seller.id, title: "E", format: "virtual", startsAt: new Date(), timezone: "UTC" },
    });
    const ticket = await db.ticketType.create({ data: { eventId: event.id, name: "GA", price: 450000, currency: "INR" } });

    await runMigration();

    expect(await db.offering.findUniqueOrThrow({ where: { id: inrOffering.id } })).toMatchObject({ price: 0.6, currency: "usd" });
    expect(await db.offering.findUniqueOrThrow({ where: { id: usdOffering.id } })).toMatchObject({ price: 60, currency: "usd" });
    expect(await db.offering.findUniqueOrThrow({ where: { id: unpriced.id } })).toMatchObject({ price: null, currency: null });
    expect(await db.course.findUniqueOrThrow({ where: { id: course.id } })).toMatchObject({ price: 19.99, currency: "usd" });
    expect(await db.ticketType.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ price: 4500, currency: "usd" });

    // Idempotent: a converted row is no longer INR, so a rerun is a no-op.
    await runMigration();
    expect((await db.offering.findUniqueOrThrow({ where: { id: inrOffering.id } })).price).toBe(0.6);
  });
});
