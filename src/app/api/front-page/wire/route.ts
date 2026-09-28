import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getWirePage, parseWireCursor } from "@/lib/front-page";
import { logger } from "@/lib/logger";

// Next page of the landing page's endless Wire (src/components/frontpage/
// WireStream.tsx). Anonymous and public by design — it only ever returns
// what getWirePage's anonymous-viewer rules allow — so no auth, just a
// per-IP ceiling against scraping loops. Pages are Redis-cached for 60s
// (getWirePage), so a burst of visitors scrolling costs one query per
// cursor, not one per visitor.
export async function GET(request: Request) {
  if (!checkRateLimit(`front-page:wire:${await getClientIp()}`, { max: 60, windowMs: 60_000 })) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const cursor = new URL(request.url).searchParams.get("cursor");
  if (!parseWireCursor(cursor)) {
    return Response.json({ error: "Invalid cursor." }, { status: 400 });
  }

  try {
    const page = await getWirePage(cursor!);
    return Response.json(page, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (err) {
    logger.error("front page: wire page failed", err, { cursor });
    return Response.json({ error: "The wire is unavailable right now." }, { status: 503 });
  }
}
