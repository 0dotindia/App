import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Read-only pre-deploy check for addendum-wallet-only-payments.md §4.1:
// every stored price is now read as a coin price with no conversion, so a
// row priced in any currency other than USD (e.g. 499 INR) would suddenly
// cost 499 coins. Lists those rows per table; exits 1 if any exist.
// Usage: npx tsx scripts/check-price-currencies.ts
//    or: DATABASE_URL="$TURSO_DATABASE_URL" DATABASE_AUTH_TOKEN="$TURSO_AUTH_TOKEN" npx tsx scripts/check-price-currencies.ts

// Tables with a user-set price and its currency. Campaign goals and
// raised totals are shown as coins too, so campaigns are included.
const PRICED_TABLES: { table: string; price: string; label: string }[] = [
  { table: "Offering", price: "price", label: "name" },
  { table: "MembershipTier", price: "price", label: "name" },
  { table: "DigitalProduct", price: "price", label: "title" },
  { table: "Course", price: "price", label: "title" },
  { table: "TicketType", price: "price", label: "name" },
  { table: "MarketplaceListing", price: "price", label: "title" },
  { table: "FundraisingCampaign", price: "goalAmount", label: "title" },
];

type Row = { id: string; label: string; price: number | null; currency: string };

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  console.log(`Checking price currencies at: ${url}\n`);

  const adapter = new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const prisma = new PrismaClient({ adapter });
  let offending = 0;
  try {
    for (const { table, price, label } of PRICED_TABLES) {
      // Identifiers come from the constant list above, never from input.
      const rows = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT id, "${label}" AS label, "${price}" AS price, currency FROM "${table}"
         WHERE currency IS NOT NULL AND lower(currency) <> 'usd'`,
      );
      if (rows.length === 0) {
        console.log(`✓ ${table}: all USD`);
        continue;
      }
      offending += rows.length;
      console.log(`✗ ${table}: ${rows.length} non-USD row(s)`);
      for (const r of rows) console.log(`    ${r.id}  ${r.currency.toUpperCase()} ${r.price ?? "—"}  ${r.label}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  if (offending > 0) {
    console.log(`\n${offending} row(s) would be re-read as coin prices. Convert or reprice them before deploying.`);
    process.exit(1);
  }
  console.log("\nNo non-USD prices — safe to read every price as coins.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
