"use server";

import { db } from "@/lib/db";
import { requireOwnProfile } from "@/lib/auth-guards";
import { enforceRateLimit } from "@/lib/rate-limit";
import { askPersonalAssistant, type AssistantReply } from "@/lib/personal-assistant";

// Called as a plain async server action from AssistantChat (button-driven
// RPC, not a <form action>), same shape as ai-content.ts's suggesters.
// The transcript is never stored — the client sends its own history back
// each turn, and personal-assistant.ts re-validates it as untrusted input.
export type AssistantResult = AssistantReply | { error: string };

export async function askAssistant(history: unknown, message: string): Promise<AssistantResult> {
  const user = await requireOwnProfile();

  // Durable limiter (not the in-memory checkRateLimit the one-shot
  // suggesters use): a chat turn can run several model round-trips, so it's
  // the most expensive AI call on the platform and must hold across
  // serverless instances. spec §10.1: cost is a real, per-call control.
  const allowed = await enforceRateLimit(`ai-assistant:${user.id}`, { max: 30, windowMs: 60 * 60 * 1000 });
  if (!allowed) return { error: "You're chatting with your assistant too quickly. Try again in a bit." };

  return askPersonalAssistant({
    userId: user.id,
    displayName: user.profile!.displayName,
    handle: user.username?.handle ?? null,
    history,
    message: typeof message === "string" ? message : "",
  });
}

// spec §5.3-style feedback signal, reusing the shared audit row: was the
// answer useful. Scoped to the caller's own generations so one user can't
// flip another's row.
export async function rateAssistantReply(generationId: string, helpful: boolean): Promise<void> {
  const user = await requireOwnProfile();
  await db.aIGeneration.updateMany({
    where: { id: generationId, requestedById: user.id, feature: "personal_assistant" },
    data: { accepted: helpful },
  });
}
