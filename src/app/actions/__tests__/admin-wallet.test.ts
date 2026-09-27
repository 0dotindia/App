import { describe, it, expect } from "vitest";
import { grantCoinsAction, refundPaymentAction } from "@/app/actions/admin-wallet";
import { db } from "@/lib/db";
import { createUser, createSessionForUser, fundWallet } from "@/test/factories";
import { setSessionCookie } from "@/test/next-test-state";
import { NextRedirectSignal } from "@/test/next-test-state";
import { getWalletBalance } from "@/lib/wallet/ledger";
import { sendTip } from "@/app/actions/tips";
import { runWalletReconciliationOnce } from "@/lib/wallet/reconcile";

function fd(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

async function loginAs(userId: string) {
  setSessionCookie(await createSessionForUser(userId));
}

// requirePlatformRole (auth-guards.ts) is the server-side gate here — this
// route has no separate client-side check to bypass, so a non-admin caller
// must be rejected before grantCoinsAction ever looks at its formData, not
// merely hidden from the admin UI.
describe("grantCoinsAction", () => {
  it("redirects a non-admin instead of granting coins", async () => {
    const admin = await createUser();
    const target = await createUser();

    let redirected = false;
    try {
      await loginAs(admin.id); // verified user, but no PlatformRole row
      await grantCoinsAction(
        undefined,
        fd({ mode: "admin_adjustment", targetKind: "user", targetHandle: target.username!.handle, coins: "50", reason: "test" })
      );
    } catch (err) {
      if (!(err instanceof NextRedirectSignal)) throw err;
      redirected = true;
    }

    expect(redirected).toBe(true);
    const balance = await getWalletBalance(target.id);
    expect(balance.spendable).toBe(0);
  });

  it("grants coins for a caller with the admin platform role", async () => {
    const admin = await createUser();
    await db.platformRole.create({ data: { userId: admin.id, role: "admin" } });
    const target = await createUser();
    await loginAs(admin.id);

    const result = await grantCoinsAction(
      undefined,
      fd({ mode: "admin_adjustment", targetKind: "user", targetHandle: target.username!.handle, coins: "50", reason: "test grant" })
    );

    expect(result).toEqual({ success: true });
    const balance = await getWalletBalance(target.id);
    expect(balance.spendable).toBe(50);
  });

  it("rejects an unrecognized target username without granting anything", async () => {
    const admin = await createUser();
    await db.platformRole.create({ data: { userId: admin.id, role: "admin" } });
    await loginAs(admin.id);

    const result = await grantCoinsAction(
      undefined,
      fd({ mode: "admin_adjustment", targetKind: "user", targetHandle: "no-such-user-handle", coins: "50", reason: "test" })
    );

    expect(result?.error).toBeTruthy();
  });
});

// addendum-wallet-only-payments.md §3.6
describe("refundPaymentAction", () => {
  async function coinTip() {
    const tipper = await createUser();
    const creator = await createUser();
    await fundWallet(tipper.id, 10, "spendable");
    await loginAs(tipper.id);
    await sendTip(undefined, fd({ creatorHandle: creator.username!.handle, amount: "5", message: "" }));
    const pt = await db.paymentTransaction.findFirstOrThrow({ where: { payerId: tipper.id, kind: "tip" } });
    return { tipper, creator, pt };
  }

  it("refunds a coin payment in full to the payer, once", async () => {
    const { tipper, creator, pt } = await coinTip();
    const admin = await createUser();
    await db.platformRole.create({ data: { userId: admin.id, role: "admin" } });
    await loginAs(admin.id);

    const result = await refundPaymentAction(undefined, fd({ paymentTransactionId: pt.id, reason: "buyer complaint" }));
    expect(result).toEqual({ success: true });
    expect((await getWalletBalance(tipper.id)).spendable).toBe(10);
    expect((await getWalletBalance(creator.id)).spendable).toBe(4.5); // seller keeps earnings (§8 #2)
    expect((await db.paymentTransaction.findUniqueOrThrow({ where: { id: pt.id } })).status).toBe("refunded");

    const again = await refundPaymentAction(undefined, fd({ paymentTransactionId: pt.id, reason: "buyer complaint" }));
    expect(again?.error).toMatch(/succeeded/i);
    expect((await getWalletBalance(tipper.id)).spendable).toBe(10);
    expect((await runWalletReconciliationOnce()).healthy).toBe(true);
  });

  it("requires a reason", async () => {
    const { pt } = await coinTip();
    const admin = await createUser();
    await db.platformRole.create({ data: { userId: admin.id, role: "admin" } });
    await loginAs(admin.id);

    const result = await refundPaymentAction(undefined, fd({ paymentTransactionId: pt.id, reason: "" }));
    expect(result?.error).toMatch(/reason/i);
  });

  it("redirects a non-admin", async () => {
    const { pt } = await coinTip();
    const other = await createUser();
    await loginAs(other.id);

    await expect(refundPaymentAction(undefined, fd({ paymentTransactionId: pt.id, reason: "please" }))).rejects.toBeInstanceOf(NextRedirectSignal);
    expect((await db.paymentTransaction.findUniqueOrThrow({ where: { id: pt.id } })).status).toBe("succeeded");
  });
});
