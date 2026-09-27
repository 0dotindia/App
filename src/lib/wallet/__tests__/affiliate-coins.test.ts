import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createUser, createSessionForUser, fundWallet } from "@/test/factories";
import { cookieJar, setSessionCookie } from "@/test/next-test-state";
import { AFFILIATE_COOKIE_NAME } from "@/lib/affiliate";
import { purchaseProduct } from "@/app/actions/digital-products";
import { purchaseCourse } from "@/app/actions/courses";
import { subscribeToTier } from "@/app/actions/memberships";
import { getWalletBalance } from "@/lib/wallet/ledger";
import { runWalletReconciliationOnce } from "@/lib/wallet/reconcile";

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

// A creator, a signed-in buyer holding 50 spendable coins, an affiliate,
// and a 20% program on the given offering with the affiliate's link in the
// buyer's cookie.
async function setup(offering: (creatorId: string) => Promise<{ type: string; id: string }>, percent = 20) {
  const creator = await createUser();
  const buyer = await createUser();
  const affiliate = await createUser();
  await fundWallet(buyer.id, 50, "spendable");
  setSessionCookie(await createSessionForUser(buyer.id));
  const { type, id } = await offering(creator.id);
  const program = await db.affiliateProgram.create({
    data: { creatorId: creator.id, offeringType: type, offeringId: id, commissionPercent: percent },
  });
  const link = await db.affiliateLink.create({
    data: { programId: program.id, affiliateId: affiliate.id, code: `aff${crypto.randomUUID().slice(0, 8)}` },
  });
  cookieJar.set(AFFILIATE_COOKIE_NAME, link.code);
  return { creator, buyer, affiliate, link, offeringId: id };
}

const product = async (creatorId: string) => {
  const p = await db.digitalProduct.create({
    data: { creatorId, title: "Pack", description: "", price: 10, currency: "usd", status: "active", fileKey: "k", fileMimeType: "application/zip", fileSizeBytes: 10 },
  });
  return { type: "digital_product", id: p.id };
};

// addendum-wallet-only-payments.md §8 #3 — affiliates are paid in coins.
describe("affiliate commissions in coins", () => {
  it("splits a product sale: affiliate commission out of the creator's share, fee unchanged", async () => {
    const { creator, buyer, affiliate, link, offeringId } = await setup(product);

    expect((await purchaseProduct(undefined, fd({ productId: offeringId })))?.success).toBe(true);

    // 10 coins: 10% platform fee (1), 20% commission (2) to the affiliate,
    // the creator keeps the remaining 7.
    expect((await getWalletBalance(buyer.id)).spendable).toBe(40);
    expect((await getWalletBalance(affiliate.id)).spendable).toBe(2);
    expect((await getWalletBalance(creator.id)).spendable).toBe(7);

    const conversion = await db.affiliateConversion.findFirstOrThrow({
      where: { affiliateLinkId: link.id },
      include: { paymentTransaction: true },
    });
    expect(conversion.commissionAmount).toBe(2);
    expect(conversion.paymentTransaction).toMatchObject({
      kind: "affiliate_commission",
      payeeId: affiliate.id,
      amount: 2,
      processor: "wallet",
      status: "succeeded",
    });
    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("caps the commission at the creator's share", async () => {
    const { creator, affiliate, offeringId } = await setup(product, 100);
    expect((await purchaseProduct(undefined, fd({ productId: offeringId })))?.success).toBe(true);
    expect((await getWalletBalance(affiliate.id)).spendable).toBe(9);
    expect((await getWalletBalance(creator.id)).spendable).toBe(0);
    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("pays nothing when the program is paused", async () => {
    const { creator, affiliate, link, offeringId } = await setup(product);
    await db.affiliateProgram.update({ where: { id: link.programId }, data: { status: "paused" } });
    expect((await purchaseProduct(undefined, fd({ productId: offeringId })))?.success).toBe(true);
    expect((await getWalletBalance(affiliate.id)).spendable).toBe(0);
    expect((await getWalletBalance(creator.id)).spendable).toBe(9);
  });

  it("pays nothing when the affiliate link is for a different offering", async () => {
    const { creator, affiliate } = await setup(product);
    const other = await product(creator.id);
    expect((await purchaseProduct(undefined, fd({ productId: other.id })))?.success).toBe(true);
    expect((await getWalletBalance(affiliate.id)).spendable).toBe(0);
  });

  it("credits course purchases", async () => {
    const { affiliate, offeringId } = await setup(async (creatorId) => {
      const c = await db.course.create({ data: { creatorId, title: "C", price: 10, currency: "usd", status: "active" } });
      return { type: "course", id: c.id };
    });
    expect((await purchaseCourse(undefined, fd({ courseId: offeringId })))?.success).toBe(true);
    expect((await getWalletBalance(affiliate.id)).spendable).toBe(2);
  });

  it("credits the first membership period", async () => {
    const { affiliate, offeringId } = await setup(async (creatorId) => {
      const t = await db.membershipTier.create({
        data: { creatorId, name: "Fan", level: 1, price: 10, currency: "usd", billingInterval: "monthly", status: "active" },
      });
      return { type: "membership_tier", id: t.id };
    });
    expect((await subscribeToTier(undefined, fd({ tierId: offeringId })))?.success).toBe(true);
    expect((await getWalletBalance(affiliate.id)).spendable).toBe(2);
    expect(await db.affiliateConversion.count({ where: { affiliateLink: { affiliateId: affiliate.id } } })).toBe(1);
  });
});
