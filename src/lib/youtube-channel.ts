import "server-only";
import { logger } from "@/lib/logger";
import { isYouTubeId, type FrontPageVideo } from "@/lib/landing-content";

// Latest uploads from the official YouTube channel, for the landing page's
// Watch section, so a new upload shows up without a code change. Two
// sources, tried in order:
//   1. YouTube Data API v3 (playlistItems on the channel's "UU…" uploads
//      playlist) — the supported, reliable path; used when YOUTUBE_API_KEY
//      is set. Costs 1 quota unit per call, and calls are cached 30 min.
//   2. The channel's public Atom feed (no key) — convenient but YouTube
//      has had multi-day outages of it (404/500 for every channel), which
//      is why it's the fallback and not the only path.
// Any failure returns [] and the page falls back to the pinned VIDEOS in
// landing-content.ts. Every request is time-boxed so a slow YouTube can
// never hold up "/".

const REVALIDATE_SECONDS = 30 * 60;
const TIMEOUT_MS = 2500;
const MAX_VIDEOS = 12;

export async function getChannelVideos(channelId: string): Promise<FrontPageVideo[]> {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) return [];
  const apiKey = process.env.YOUTUBE_API_KEY;
  try {
    return apiKey ? await fromDataApi(channelId, apiKey) : await fromFeed(channelId);
  } catch (err) {
    logger.warn("youtube-channel: couldn't load channel uploads", err);
    return [];
  }
}

async function fromDataApi(channelId: string, apiKey: string): Promise<FrontPageVideo[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.set("part", "snippet,status");
  url.searchParams.set("maxResults", String(MAX_VIDEOS));
  url.searchParams.set("playlistId", `UU${channelId.slice(2)}`);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`YouTube Data API ${res.status}`);
  const data: {
    items?: { snippet?: { title?: string; resourceId?: { videoId?: string } }; status?: { privacyStatus?: string } }[];
  } = await res.json();
  return (data.items ?? [])
    .filter((i) => i.status?.privacyStatus === "public")
    .map((i) => ({ id: i.snippet?.resourceId?.videoId ?? "", title: i.snippet?.title ?? "" }))
    .filter((v) => isYouTubeId(v.id) && v.title);
}

async function fromFeed(channelId: string): Promise<FrontPageVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`YouTube feed ${res.status}`);
  return parseChannelFeed(await res.text()).slice(0, MAX_VIDEOS);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

// The feed is a small, fixed Atom shape; pulling two fields per <entry>
// with a regex avoids an XML-parser dependency for it.
export function parseChannelFeed(xml: string): FrontPageVideo[] {
  const videos: FrontPageVideo[] = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim() ?? "";
    const title = decodeXml(entry.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? "");
    if (isYouTubeId(id) && title) videos.push({ id, title });
  }
  return videos;
}

// Pinned videos first (the lead is always VIDEOS[0]), then channel uploads
// not already pinned, newest first.
export function mergeVideos(pinned: FrontPageVideo[], channel: FrontPageVideo[]): FrontPageVideo[] {
  const seen = new Set(pinned.map((v) => v.id));
  return [...pinned, ...channel.filter((v) => !seen.has(v.id) && seen.add(v.id))];
}
