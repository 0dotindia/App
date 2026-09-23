import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { subscribeToVoiceRoom, type VoiceRoomEvent } from "@/lib/voice-room-events";

export const dynamic = "force-dynamic";
// Missing previously — fell back to the platform's much shorter default
// function timeout instead of the 300s every sibling SSE route in this app
// uses, disconnecting listeners within seconds of joining.
export const maxDuration = 300;

const HEARTBEAT_MS = 20_000; // keeps the connection alive through idle proxies/load balancers
// Proactively recycle before Vercel's maxDuration ceiling kills the
// function mid-stream — the client's own reconnect logic picks the stream
// back up, so this is a clean close rather than a hard timeout in the logs.
const STREAM_RECYCLE_MS = 280_000;

// Per-room SSE stream carrying only `{type:"room-updated"}` (Phase D moved
// the audio + signaling to LiveKit). Still participant-gated — a listener
// on the "Join room" screen isn't subscribed yet, and only actual
// participants need the live room-state pings — though it no longer carries
// anything network-sensitive.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; roomId: string }> }
) {
  const { roomId } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const participant = await db.voiceRoomParticipant.findUnique({
    where: { voiceRoomId_userId: { voiceRoomId: roomId, userId: user.id } },
  });
  if (!participant) return new Response("Unauthorized", { status: 401 });

  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const startedAt = Date.now();
      const send = (event: VoiceRoomEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      unsubscribe = subscribeToVoiceRoom(roomId, send);
      heartbeat = setInterval(() => {
        if (Date.now() - startedAt >= STREAM_RECYCLE_MS) {
          unsubscribe?.();
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, HEARTBEAT_MS);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
