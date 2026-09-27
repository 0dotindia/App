"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth-guards";
import { settleCoinPurchase, type FeatureSettlement } from "@/lib/wallet/charge";
import { coinActionKey } from "@/lib/wallet/limits";
import { notifyTipReceived } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/app/actions/auth";

const MIN_TIP_AMOUNT = 1;
const MAX_TIP_AMOUNT = 500; // sane per-tip ceiling — not a spec requirement, just abuse-resistance
const MAX_MESSAGE_LENGTH = 280;

function checkTipRateLimit(userId: string): boolean {
  return checkRateLimit(`tip:${userId}`, { max: 10, windowMs: 15 * 60 * 1000 });
}

// spec §6.1/§6.2: the smallest feature exercising the payments backbone
// end-to-end. Paid in coins (addendum-wallet-only-payments.md §3.1): the
// Tip row is created by createTipRow in the same transaction as the coin
// charge and its PaymentTransaction, so the two can never drift apart
// (§6.2's literal acceptance criterion).
export async function sendTip(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const creatorHandle = String(formData.get("creatorHandle") ?? "").trim().toLowerCase();
  const message = String(formData.get("message") ?? "").trim();

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
  }

  const rawAmount = Number(formData.get("amount"));
  // Two-decimal (cents) precision only — rejects e.g. 5.005, not just
  // negative/NaN.
  const amount = Math.round(rawAmount * 100) / 100;
  if (!Number.isFinite(amount) || amount < MIN_TIP_AMOUNT || amount > MAX_TIP_AMOUNT) {
    return { error: `Tip amount must be between ${MIN_TIP_AMOUNT} and ${MAX_TIP_AMOUNT} coins.` };
  }

  const creatorUsername = await db.username.findUnique({
    where: { handle: creatorHandle },
    select: { userId: true },
  });
  if (!creatorUsername) return { error: "Creator not found." };
  if (creatorUsername.userId === user.id) return { error: "You can't tip yourself." };

  if (!checkTipRateLimit(user.id)) {
    return { error: "You're sending tips too fast. Please slow down." };
  }

  // addendum-coin-wallet-v2.md §6.3/§6.4: coins settle synchronously and
  // need no payout account on the payee (the coins just land in their
  // wallet).
  const result = await settleCoinPurchase({
    kind: "tip",
    payerId: user.id,
    payeeUserId: creatorUsername.userId,
    amountUsd: amount,
    currency: "usd",
    relatedObjectType: "tip",
    idempotencyKey: coinActionKey("tip:coin", formData.get("idempotencyKey"), user.id, creatorUsername.userId, amount),
    metadata: { message },
    createRows: createTipRow,
  });
  if ("error" in result) return { error: result.error };
  if (!result.alreadySettled) {
    await notifyTipReceived({ recipientId: creatorUsername.userId, actorId: user.id });
    revalidatePath(`/${creatorHandle}`);
  }
  return { success: true };
}

// The Tip row itself — the one place it's created, with the coin charge by
// settleCoinPurchase (addendum-coin-wallet-v2.md §6.2).
export async function createTipRow(tx: Prisma.TransactionClient, s: FeatureSettlement): Promise<void> {
  const message = s.metadata.message ?? "";
  await tx.tip.create({
    data: {
      fromUserId: s.payerId,
      toCreatorId: s.payeeId!,
      amount: s.amount,
      currency: s.currency,
      message: message.length > 0 ? message : null,
      paymentTransactionId: s.paymentTransactionId,
    },
  });
}

