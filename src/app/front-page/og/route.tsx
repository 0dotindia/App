import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getOfficialDesk } from "@/lib/front-page";
import { FRONT_PAGE, issueNumber, toHeadline } from "@/lib/landing-content";

// Link-preview image for "/" only (src/app/page.tsx's generateMetadata
// points og:image here): the newspaper front page — masthead, nameplate
// and the latest dispatch as the headline — so a shared 0dot.in link looks
// like today's edition. Every other route keeps the site-wide default card
// (src/app/opengraph-image.tsx); "/" is the root segment, so it can't get
// its own opengraph-image file without overriding that default for all.
//
// Static .woff (satori, behind ImageResponse, can't read woff2), vendored
// from @fontsource/newsreader, OFL — see src/app/fonts/Newsreader-OFL.txt.
const fonts = Promise.all([
  readFile(join(process.cwd(), "src/app/fonts/og/Newsreader-800.woff")),
  readFile(join(process.cwd(), "src/app/fonts/og/Newsreader-400-Italic.woff")),
]);

const INK = "#171717";
const PAPER = "#f5f4f1";
const MUTED = "#6b6b6b";

// Newsreader's zero reads as a capital O, and satori can't turn on a font
// feature to swap it — so the nameplate's zero gets a drawn slash.
function SlashedZero({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", position: "relative" }}>
      0
      <div
        style={{
          position: "absolute",
          left: size * 0.12,
          top: size * 0.5,
          width: size * 0.5,
          height: size * 0.07,
          background: INK,
          transform: "rotate(-60deg)",
        }}
      />
    </div>
  );
}

export async function GET() {
  const [bold, italic] = await fonts;
  const desk = await getOfficialDesk().catch(() => null);
  const latest = desk?.dispatches[0];
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const [before, after] = FRONT_PAGE.nameplate.split("0");
  const nameplateSize = 118;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "48px 64px",
          background: PAPER,
          color: INK,
          fontFamily: "Newsreader",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 0",
            borderTop: `2px solid ${INK}`,
            borderBottom: `1px solid ${INK}`,
            fontSize: 24,
            fontStyle: "italic",
            color: MUTED,
          }}
        >
          <span>{date}</span>
          <span>{FRONT_PAGE.edition}</span>
          <span>
            Vol. I · No. {issueNumber(now)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 26,
            fontSize: nameplateSize,
            fontWeight: 800,
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          {/* satori drops whitespace at the edge of a text node, so the
              space around the split-out zero is an explicit spacer. */}
          {before.trimEnd()}
          {before.endsWith(" ") && <div style={{ width: nameplateSize * 0.26 }} />}
          <SlashedZero size={nameplateSize} />
          {after.startsWith(" ") && <div style={{ width: nameplateSize * 0.26 }} />}
          {after.trimStart()}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14, fontSize: 30, fontStyle: "italic", color: MUTED }}>
          {FRONT_PAGE.tagline}
        </div>

        <div style={{ display: "flex", marginTop: 28, borderTop: `4px solid ${INK}` }} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
          <span style={{ fontSize: 22, fontStyle: "italic", color: "#c5221f" }}>
            {latest ? "Latest dispatch" : "Cover story"}
          </span>
          <span style={{ marginTop: 6, fontSize: 50, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>
            {latest ? toHeadline(latest.body, 80).headline : "Your permanent home on the internet"}
          </span>
        </div>
        <div style={{ display: "flex", marginTop: "auto", justifyContent: "flex-end", fontSize: 26, fontStyle: "italic", color: MUTED }}>
          0dot.in
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Newsreader", data: bold, weight: 800, style: "normal" },
        { name: "Newsreader", data: italic, weight: 400, style: "italic" },
      ],
      // Link scrapers re-fetch rarely; a short CDN cache keeps the headline
      // fresh-ish without regenerating the PNG for every preview request.
      headers: { "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=3600" },
    }
  );
}
