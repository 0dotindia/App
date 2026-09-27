-- addendum-wallet-only-payments.md §4.1: every price is a coin price.
-- Prices stored in INR are converted at ₹100 = 1 coin, rounded to the
-- coin cent (₹60 → 0.6 coins, ₹1,999 → 19.99). Only Offering, TicketType
-- and Course held INR prices; historical PaymentTransaction rows keep
-- their original currency as a record of past card sales.
-- Data-only: no schema change.
UPDATE "Offering" SET "price" = ROUND("price" / 100.0, 2), "currency" = 'usd' WHERE lower("currency") = 'inr' AND "price" IS NOT NULL;
UPDATE "TicketType" SET "price" = ROUND("price" / 100.0, 2), "currency" = 'usd' WHERE lower("currency") = 'inr' AND "price" IS NOT NULL;
UPDATE "Course" SET "price" = ROUND("price" / 100.0, 2), "currency" = 'usd' WHERE lower("currency") = 'inr' AND "price" IS NOT NULL;
