import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createUser, createSessionForUser, fundWallet } from "@/test/factories";
import { setSessionCookie } from "@/test/next-test-state";
import { purchaseOffering } from "@/app/actions/offerings";
import { purchaseMarketplaceListing } from "@/app/actions/marketplace";
import { donate } from "@/app/actions/donations";
import { purchaseTicket } from "@/app/actions/events";
import { chargeWallet } from "@/lib/wallet/charge";
import { getWalletBalance, WalletError } from "@/lib/wallet/ledger";

const DAY = 24 * 60 * 60 * 1000;

async function loginAs(userId: string) {
  setSessionCookie(await createSessionForUser(userId));
}
function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

// A user holding only restricted (promo) coins, signed in.
async function promoOnlyUser() {
  const user = await createUser();
  await fundWallet(user.id, 10, "promo");
  await loginAs(user.id);
  return user;
}

const PROMO_ONLY = { spendable: 0, restricted: 10 };

// Paying yourself would turn restricted grant coins into spendable,
// transferable ones — every coin purchase path must refuse it.
describe("no paying yourself", () => {
  it("refuses a donation to your own campaign", async () => {
    const me = await promoOnlyUser();
    const campaign = await db.fundraisingCampaign.create({
      data: { organizerType: "user", organizerUserId: me.id, title: "Mine", currency: "usd" },
    });
    const result = await donate(undefined, fd({ campaignId: campaign.id, amount: "10" }));
    expect(result?.error).toBeDefined();
    expect(await getWalletBalance(me.id)).toMatchObject(PROMO_ONLY);
  });

  it("refuses a paid ticket to your own event", async () => {
    const me = await promoOnlyUser();
    const event = await db.event.create({
      data: {
        slug: `self-${Date.now().toString(36)}`,
        createdBy: me.id,
        hostedByUserId: me.id,
        title: "Mine",
        format: "virtual",
        startsAt: new Date(Date.now() + DAY),
        timezone: "UTC",
        status: "published",
      },
    });
    const tt = await db.ticketType.create({ data: { eventId: event.id, name: "GA", price: 10, currency: "usd" } });
    const result = await purchaseTicket(undefined, fd({ ticketTypeId: tt.id }));
    expect(result?.error).toBeDefined();
    expect(await getWalletBalance(me.id)).toMatchObject(PROMO_ONLY);
  });

  it("refuses buying your own offering", async () => {
    const me = await promoOnlyUser();
    const offering = await db.offering.create({
      data: { sellerUserId: me.id, kind: "service", name: "Mine", price: 10, currency: "usd", status: "active" },
    });
    const result = await purchaseOffering(undefined, fd({ offeringId: offering.id }));
    expect(result?.error).toBeDefined();
    expect(await getWalletBalance(me.id)).toMatchObject(PROMO_ONLY);
  });

  it("is enforced in chargeWallet itself, for any future caller", async () => {
    const me = await createUser();
    await fundWallet(me.id, 10, "promo");
    await expect(
      db.$transaction((tx) =>
        chargeWallet(tx, {
          payerId: me.id,
          payeeUserId: me.id,
          amountUsd: 5,
          currency: "usd",
          kind: "tip",
          idempotencyKey: `self:${crypto.randomUUID()}`,
        }),
      ),
    ).rejects.toBeInstanceOf(WalletError);
    expect(await getWalletBalance(me.id)).toMatchObject(PROMO_ONLY);
  });
});

// Rows priced below one coin cent (0, or legacy values like 0.001) used to
// crash the purchase with an unhandled WalletError.
describe("sub-cent prices", () => {
  it("returns an error instead of throwing for a legacy zero-price offering", async () => {
    const seller = await createUser();
    const buyer = await createUser();
    await fundWallet(buyer.id, 10);
    await loginAs(buyer.id);
    const offering = await db.offering.create({
      data: { sellerUserId: seller.id, kind: "service", name: "Free?", price: 0, currency: "usd", status: "active" },
    });
    const result = await purchaseOffering(undefined, fd({ offeringId: offering.id }));
    expect(result?.error).toBeDefined();
    expect((await getWalletBalance(buyer.id)).spendable).toBe(10);
  });

  it("returns an error instead of throwing for a legacy 0.001-price listing", async () => {
    const seller = await createUser();
    const buyer = await createUser();
    await fundWallet(buyer.id, 10);
    await loginAs(buyer.id);
    const listing = await db.marketplaceListing.create({
      data: { sellerType: "user", sellerUserId: seller.id, category: "theme", title: "t", price: 0.001, currency: "usd", status: "active", payload: "{}" },
    });
    const result = await purchaseMarketplaceListing(undefined, fd({ listingId: listing.id }));
    expect(result?.error).toBeDefined();
  });
});
