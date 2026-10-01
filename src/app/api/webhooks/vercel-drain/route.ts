import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

// Vercel's own log drain → us (Project Settings > Log Drains, or created via
// the REST API). Vercel signs every delivery with HMAC-SHA1 over the raw
// request body in `x-vercel-signature`, using the secret given at drain
// creation (stored here as DRAIN_SECRET) — verifying it is the only thing
// standing between this route and anyone who finds the URL. No destination
// service was chosen when this was wired up, so delivered batches are only
// verified and counted for now; add real storage/forwarding here once
// there's somewhere for the parsed events to go.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.DRAIN_SECRET;
  if (!secret) {
    logger.error("vercel-drain: DRAIN_SECRET is not set — refusing delivery");
    return new Response("drain not configured", { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-vercel-signature");
  if (!signature || !verifySignature(rawBody, signature, secret)) {
    logger.error("vercel-drain: signature verification failed");
    return new Response("invalid signature", { status: 401 });
  }

  const lineCount = rawBody.split("\n").filter(Boolean).length;
  logger.info("vercel-drain: received batch", undefined, { lines: lineCount });

  return new Response("OK", { status: 200 });
}

// Verifies against the raw body text, not a parsed/re-serialized version —
// JSON.stringify(JSON.parse(x)) can reorder keys or change whitespace,
// which would break the signature even for a genuine delivery.
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha1", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
