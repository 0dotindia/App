import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createUser, createBusiness, createSessionForUser, fundWallet } from "@/test/factories";
import { setSessionCookie } from "@/test/next-test-state";
import { purchaseMarketplaceListing } from "@/app/actions/marketplace";
import { getWalletBalance, getBusinessWalletBalance } from "@/lib/wallet/ledger";
import { runWalletReconciliationOnce } from "@/lib/wallet/reconcile";

async function loginAs(userId: string) {
  setSessionCookie(await createSessionForUser(userId));
}
function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function createListing(seller: { sellerUserId?: string; sellerBusinessId?: string }, price = 10) {
  return db.marketplaceListing.create({
    data: {
      sellerType: seller.sellerBusinessId ? "business" : "user",
      ...seller,
      category: "theme",
      title: "Dark theme",
      price,
      currency: "usd",
      status: "active",
      payload: "{}",
    },
  });
}

// addendum-wallet-only-payments.md §3.2
describe("coin marketplace purchase", () => {
  it("grants the listing, credits the seller's wallet with no payout account, and blocks a second purchase", async () => {
    const buyer = await createUser();
    const seller = await createUser();
    await fundWallet(buyer.id, 50, "spendable");
    await loginAs(buyer.id);
    const listing = await createListing({ sellerUserId: seller.id });

    const first = await purchaseMarketplaceListing(undefined, fd({ listingId: listing.id, payWith: "coins" }));
    expect(first?.success).toBe(true);

    const purchases = await db.marketplacePurchase.findMany({ where: { listingId: listing.id } });
    expect(purchases).toHaveLength(1);
    const pt = await db.paymentTransaction.findUniqueOrThrow({ where: { id: purchases[0].paymentTransactionId! } });
    expect(pt.kind).toBe("marketplace_purchase");
    expect(pt.processor).toBe("wallet");
    expect(pt.payeeId).toBe(seller.id);
    expect((await db.marketplaceListing.findUniqueOrThrow({ where: { id: listing.id } })).purchaseCount).toBe(1);

    expect((await getWalletBalance(seller.id)).spendableUnits).toBe(900); // 10 − 10% fee
    expect((await getWalletBalance(buyer.id)).spendableUnits).toBe(4000);

    const second = await purchaseMarketplaceListing(undefined, fd({ listingId: listing.id, payWith: "coins" }));
    expect(second?.error).toMatch(/already own/i);
    expect((await getWalletBalance(buyer.id)).spendableUnits).toBe(4000);

    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("credits the business wallet for a business listing", async () => {
    const buyer = await createUser();
    const owner = await createUser();
    const business = await createBusiness({ creatorId: owner.id, status: "active" });
    await fundWallet(buyer.id, 20, "spendable");
    await loginAs(buyer.id);
    const listing = await createListing({ sellerBusinessId: business.id }, 20);

    const result = await purchaseMarketplaceListing(undefined, fd({ listingId: listing.id, payWith: "coins" }));
    expect(result?.success).toBe(true);
    expect((await getBusinessWalletBalance(business.id)).spendableUnits).toBe(1800);
    expect((await getWalletBalance(buyer.id)).spendableUnits).toBe(0);
  });

  it("rejects a purchase the buyer can't afford, creating nothing", async () => {
    const buyer = await createUser();
    const seller = await createUser();
    await fundWallet(buyer.id, 5, "spendable");
    await loginAs(buyer.id);
    const listing = await createListing({ sellerUserId: seller.id });

    const result = await purchaseMarketplaceListing(undefined, fd({ listingId: listing.id, payWith: "coins" }));
    expect(result?.error).toMatch(/enough coins/i);
    expect(await db.marketplacePurchase.findMany({ where: { listingId: listing.id } })).toHaveLength(0);
    expect((await getWalletBalance(buyer.id)).spendableUnits).toBe(500);

    // The failed attempt must not consume the deterministic idempotency key.
    await fundWallet(buyer.id, 5, "spendable");
    const retry = await purchaseMarketplaceListing(undefined, fd({ listingId: listing.id, payWith: "coins" }));
    expect(retry?.success).toBe(true);
    expect(await db.marketplacePurchase.findMany({ where: { listingId: listing.id } })).toHaveLength(1);
  });

  it("won't let a seller buy their own listing", async () => {
    const seller = await createUser();
    await fundWallet(seller.id, 50, "spendable");
    await loginAs(seller.id);
    const listing = await createListing({ sellerUserId: seller.id });

    const result = await purchaseMarketplaceListing(undefined, fd({ listingId: listing.id, payWith: "coins" }));
    expect(result?.error).toMatch(/own listing/i);
  });
});
