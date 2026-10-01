// Editorial config for the newspaper-style landing page ("/", see
// src/components/frontpage/). Everything a non-engineer would want to change
// on the front page lives here, so an update is a one-file edit.
//
// The "Latest dispatches" column is NOT configured here — it reads the
// official account's own public posts live (src/lib/front-page.ts), so
// posting from that account on 0dot updates the landing page with no deploy.

export const FRONT_PAGE = {
  nameplate: "The 0dot Dispatch",
  edition: "India Edition",
  tagline: "One identity. One profile. Infinite possibilities.",
  // Issue numbers count days since launch (the platform account's creation
  // date), so the masthead reads like a real daily.
  launchDate: "2026-09-23",
  // Handle of the official account whose posts fill the dispatches column
  // and ticker. If it doesn't exist yet, those sections show an empty state.
  officialHandle: "dot",
  // youtube.com/@0dotindia. The Watch section adds this channel's latest
  // uploads after the pinned VIDEOS below (src/lib/youtube-channel.ts).
  youtubeChannelId: "UC1tbu6WlF_JvqApB4Opdoow",
  // The "proof of scale" stats strip (src/lib/front-page.ts's
  // getPlatformStats, rendered in FrontPage.tsx) only shows once totalUsers
  // crosses this floor — the site launched 2026-09-23, so early real counts
  // would read as evidence of failure rather than scale on a page styled
  // like an established daily. Raise this if it still looks thin once hit.
  statsMinUsers: 500,
} as const;

// The cover story's own copy. Kept separate from the inline JSX so an
// editorial change is a one-file edit like everything else here, and so a
// future rotating lead story is a non-breaking addition (LEAD_STORY ->
// LEAD_STORIES[n]) instead of a JSX rewrite.
export type LeadStory = {
  kicker: string;
  headline: string;
  deck: string;
  byline: string;
  bodyIntro: string;
  bodyRest: string;
};
export const LEAD_STORY: LeadStory = {
  kicker: "Cover story",
  headline: "Your permanent home on the internet",
  deck: "One username that never changes, one profile that carries your work, links, posts and reputation — and an identity other apps can build on.",
  byline: "By the 0dot newsroom",
  bodyIntro:
    "Most of us are scattered across a dozen apps, each holding a sliver of who we are. 0dot gathers it into one address: a profile you own, a feed that proves you're real, and communities, storefronts and events that all hang off the same name.",
  bodyRest:
    "Claim a handle once and it's yours for good. Put it in every bio, signature and business card — it never breaks and it grows with you.",
};

// YouTube videos. The first one is the lead story's video; the rest fill
// the "Watch" section. `id` is the 11-character video id — the part after
// `v=` in youtube.com/watch?v=<id>, or after youtu.be/. Leave empty to
// hide the video areas (the lead falls back to the identity illustration).
export type FrontPageVideo = { id: string; title: string; caption?: string };
export const VIDEOS: FrontPageVideo[] = [
  {
    id: "JimIb92jriQ",
    title: "The Story of 0dot: How Humanity's Digital Identity Evolved",
    caption: "Watch: the story of 0dot — how our digital identity evolved.",
  },
];

// Official social profiles. Only entries with a url render — no dead links
// (NAVIGATION.md rule 2).
export const SOCIAL_PLATFORMS = ["youtube", "x", "instagram", "facebook", "threads", "reddit", "github"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export const SOCIALS: { platform: SocialPlatform; url: string; handle?: string }[] = [
  { platform: "youtube", url: "https://www.youtube.com/@0dotindia", handle: "@0dotindia" },
  { platform: "x", url: "https://x.com/0dotindia", handle: "@0dotindia" },
  { platform: "instagram", url: "https://www.instagram.com/0dotindia/", handle: "@0dotindia" },
  { platform: "facebook", url: "https://www.facebook.com/0dotindia", handle: "0dotindia" },
  { platform: "threads", url: "https://www.threads.com/@0dotindia", handle: "@0dotindia" },
  { platform: "reddit", url: "https://www.reddit.com/r/0dotindia/", handle: "r/0dotindia" },
  { platform: "github", url: "https://github.com/0dotindia/App", handle: "0dotindia/App" },
];

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  reddit: "Reddit",
  github: "GitHub",
};

// The footer's old job on "/": the landing page has no footer (it scrolls
// endlessly into the Wire), so these live in the masthead and the mobile
// menu instead. Terms and Privacy must stay reachable from the homepage —
// Google sign-in verification and the app stores check for them.
export const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
  { href: "/trust-safety", label: "Trust & Safety" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/download", label: "Get the app" },
] as const;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYouTubeId(id: string): boolean {
  return YOUTUBE_ID.test(id);
}

// Drops malformed ids instead of rendering a broken embed.
export function validVideos(videos: FrontPageVideo[] = VIDEOS): FrontPageVideo[] {
  return videos.filter((v) => isYouTubeId(v.id));
}

export function validSocials(socials = SOCIALS) {
  return socials.filter((s) => {
    try {
      return new URL(s.url).protocol === "https:";
    } catch {
      return false;
    }
  });
}

// Day 1 on launch day. Computed in IST so the issue rolls over at Indian
// midnight, matching the masthead's date line.
export function issueNumber(now: Date, launchDate: string = FRONT_PAGE.launchDate): number {
  const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const days = Math.round((Date.parse(istDay(now)) - Date.parse(launchDate)) / 86_400_000);
  return Math.max(1, days + 1);
}

// Splits a post body into a newspaper headline (first line / sentence,
// capped) and the remaining standfirst text.
export function toHeadline(body: string, max = 90): { headline: string; rest: string } {
  const text = body.trim();
  const firstLine = text.split("\n")[0];
  const sentence = firstLine.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? firstLine;
  let headline = sentence.length <= max ? sentence : `${sentence.slice(0, max).replace(/\s+\S*$/, "")}…`;
  if (!headline) headline = text.slice(0, max);
  const rest = text.slice(sentence.length).trim();
  return { headline, rest };
}

const IST_DAY = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Newspaper-style relative time ("3 hr ago"), falling back to the full IST
// date after a week. Shared by the server-rendered dispatches column and
// the client-rendered Wire so both read the same.
export function formatAgo(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return IST_DAY.format(date);
}
