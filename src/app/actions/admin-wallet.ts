"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePlatformRole } from "@/lib/auth-guards";
import { issuePromoGrant, adminAdjust } from "@/lib/wallet/grants";
import { coinActionKey } from "@/lib/wallet/limits";
import { refundToWallet } from "@/lib/wallet/charge";
import type { ActionState } from "@/app/actions/auth";

// addendum-coin-wallet-v2.md §13.3 — the admin grant tool. Caps + required
// reason + hard ceiling live in grants.ts (guardIssuance); this resolves
// the target and records who acted.
export async function grantCoinsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { user: admin } = await requirePlatformRole("admin");

  const mode = String(formData.get("mode") ?? "promo_grant"); // promo_grant | admin_adjustment
  const targetKind = String(formData.get("targetKind") ?? "user"); // user | business
  const targetHandle = String(formData.get("targetHandle") ?? "").trim().toLowerCase();
  const targetSlug = String(formData.get("targetSlug") ?? "").trim().toLowerCase();
  const coins = Number(formData.get("coins"));
  const reason = String(formData.get("reason") ?? "").trim();
  const expiresInDays = formData.get("expiresInDays") ? Number(formData.get("expiresInDays")) : null;

  let targetUserId: string | undefined;
  let targetBusinessId: string | undefined;
  if (targetKind === "business") {
    const business = await db.business.findUnique({ where: { slug: targetSlug }, select: { id: true } });
    if (!business) return { error: "No business with that slug." };
    targetBusinessId = business.id;
  } else {
    const username = await db.username.findUnique({ where: { handle: targetHandle }, select: { userId: true } });
    if (!username) return { error: "No user with that username." };
    targetUserId = username.userId;
  }

  // Deterministic per-submission key (review finding P0 #1): a fresh
  // randomUUID() on every call meant a double-click issued the same grant
  // twice. IdempotencyField gives a real per-submission token on the JS
  // path; coinActionKey falls back to a short time bucket otherwise, same
  // as every other coin action.
  const idempotencyKey = coinActionKey(
    mode === "admin_adjustment" ? "admin_adjustment" : "promo_grant",
    formData.get("idempotencyKey"),
    admin.id,
    targetUserId ?? targetBusinessId ?? "",
    coins
  );

  const result =
    mode === "admin_adjustment"
      ? await adminAdjust({ actorAdminId: admin.id, targetUserId, targetBusinessId, coins, reason, idempotencyKey })
      : await issuePromoGrant({ actorAdminId: admin.id, targetUserId, targetBusinessId, coins, reason, expiresInDays, idempotencyKey });

  if ("error" in result) return { error: result.error };

  revalidatePath("/admin/wallet");
  return { success: true };
}

// addendum-wallet-only-payments.md §3.6 — the admin caller for
// refundToWallet (coin-wallet v2 §18 #4: every refund is a coin refund).
// Full refunds of coin payments only; the refund is funded from
// system_refund_source, so the seller keeps their earnings (§8 #2) and the
// buyer keeps whatever the payment bought.
export async function refundPaymentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { user: admin } = await requirePlatformRole("admin");

  const paymentTransactionId = String(formData.get("paymentTransactionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "A reason is required." };

  const pt = await db.paymentTransaction.findUnique({ where: { id: paymentTransactionId } });
  if (!pt) return { error: "Unknown payment." };
  if (pt.processor !== "wallet") return { error: "Only coin payments can be refunded here." };
  if (pt.status !== "succeeded") return { error: "Only a succeeded payment can be refunded." };

  const result = await refundToWallet({ paymentTransactionId: pt.id, amountUsd: pt.amount, reason, actorUserId: admin.id });
  if ("error" in result) return { error: result.error };

  revalidatePath("/admin/payments/refunds");
  return { success: true };
}
