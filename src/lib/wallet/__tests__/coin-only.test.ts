import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createUser, createSessionForUser, fundWallet } from "@/test/factories";
import { setSessionCookie } from "@/test/next-test-state";
import { sendTip } from "@/app/actions/tips";
import { purchaseProduct } from "@/app/actions/digital-products";
import { subscribeToTier } from "@/app/actions/memberships";
import { getWalletBalance } from "@/lib/wallet/ledger";

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

// addendum-wallet-only-payments.md §3.1 — with no payWith field (which
// used to default to "card" and redirect to Stripe Checkout, requiring the
// payee to have a payout account), every purchase settles in coins.
describe("purchases are coin-only", () => {
  it("pays tips, products and memberships in coins with no rail choice and no payout account", async () => {
    const buyer = await createUser();
    const creator = await createUser();
    await fundWallet(buyer.id, 30, "spendable");
    setSessionCookie(await createSessionForUser(buyer.id));

    expect((await sendTip(undefined, fd({ creatorHandle: creator.username!.handle, amount: "5", message: "" })))?.success).toBe(true);

    const product = await db.digitalProduct.create({
      data: { creatorId: creator.id, title: "Pack", description: "", price: 10, currency: "usd", status: "active", fileKey: "k", fileMimeType: "application/zip", fileSizeBytes: 10 },
    });
    expect((await purchaseProduct(undefined, fd({ productId: product.id })))?.success).toBe(true);

    const tier = await db.membershipTier.create({
      data: { creatorId: creator.id, name: "Fan", level: 1, price: 6, currency: "usd", billingInterval: "monthly", status: "active" },
    });
    expect((await subscribeToTier(undefined, fd({ tierId: tier.id })))?.success).toBe(true);

    expect((await getWalletBalance(buyer.id)).spendable).toBe(9);
    const processors = await db.paymentTransaction.findMany({ where: { payerId: buyer.id }, select: { processor: true } });
    expect(processors.map((p) => p.processor)).toEqual(["wallet", "wallet", "wallet"]);
    expect(await db.creatorPayoutAccount.count({ where: { userId: creator.id } })).toBe(0);
  });
});
