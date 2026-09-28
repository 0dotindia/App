import Link from "next/link";
import localFont from "next/font/local";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CodeXml,
  Heart,
  KeyRound,
  Link2,
  MessageCircle,
  Radio,
  Store,
  Users,
  Webhook,
} from "lucide-react";
import { Icon } from "@/components/Icon";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { DigitalHomeVisual } from "@/components/DigitalHomeVisual";
import { LiteYouTube } from "@/components/frontpage/LiteYouTube";
import { BrandIcon } from "@/components/frontpage/BrandIcon";
import { FrontPageNav } from "@/components/frontpage/FrontPageNav";
import { OAUTH_SCOPES } from "@/lib/oauth";
import type { OfficialDesk, WirePage } from "@/lib/front-page";
import { WireStream } from "@/components/frontpage/WireStream";
import {
  FRONT_PAGE,
  LEGAL_LINKS,
  formatAgo,
  SOCIAL_LABELS,
  issueNumber,
  toHeadline,
  validSocials,
  type FrontPageVideo,
} from "@/lib/landing-content";
import "./front-page.css";

// Newspaper display serif for the landing page only. Called here rather
// than in the root layout so its preload <link> ships on "/" alone — no
// other route pays for it. Self-hosted for the same Turbopack
// unicode-range reason as Geist (see src/app/layout.tsx); OFL-licensed,
// vendored from @fontsource-variable/newsreader (license alongside).
const newsreader = localFont({
  src: [
    { path: "../../app/fonts/Newsreader-Variable.woff2", style: "normal", weight: "200 800" },
    { path: "../../app/fonts/Newsreader-Italic-Variable.woff2", style: "italic", weight: "200 800" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});

const IST_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const IST_TIME = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });


const DEV_SAMPLE = `// 1. Send people to the consent screen
GET https://0dot.in/oauth/authorize
    ?response_type=code
    &client_id=YOUR_CLIENT_ID
    &redirect_uri=https://yourapp.com/callback
    &scope=profile:read posts:read
    &state=…
    &code_challenge=…&code_challenge_method=S256

// 2. Exchange the code, then call the API
const me = await fetch("https://0dot.in/api/v1/users/me", {
  headers: { Authorization: \`Bearer \${accessToken}\` },
}).then((r) => r.json());

me.username; // "dot"`;

// Newsreader's zero is an oval that reads as a capital O at display sizes
// ("The Odot Dispatch"), so every "0" in serif brand text is set in the
// app's sans instead, where it's unmistakably a zero.
function ZeroSafe({ text }: { text: string }) {
  return text.split(/(0)/).map((part, i) =>
    part === "0" ? (
      <span key={i} className="fpZero">
        0
      </span>
    ) : (
      part
    )
  );
}

// The logged-out landing page ("/"), laid out as a daily newspaper front
// page: masthead, lead story (with video), a live dispatches column fed by
// the official account's posts, then Watch / features / developers /
// follow sections. Server component — only LiteYouTube and TrackedLink
// hydrate. Editorial knobs live in src/lib/landing-content.ts.
export function FrontPage({
  desk,
  wire,
  videos,
  notice,
}: {
  desk: OfficialDesk | null;
  wire: WirePage;
  // Pinned videos then channel uploads (page.tsx); [0] is the lead.
  videos: FrontPageVideo[];
  notice?: React.ReactNode;
}) {
  const now = new Date();
  const [leadVideo, ...moreVideos] = videos;
  const socials = validSocials();
  const dispatches = desk?.dispatches ?? [];
  const scopes = OAUTH_SCOPES.slice(0, 8);
  const sections = [
    { href: "#front", label: "Front page" },
    ...(moreVideos.length > 0 ? [{ href: "#watch", label: "Watch" }] : []),
    { href: "#inside", label: "Inside" },
    { href: "#developers", label: "Developers" },
    { href: "#follow", label: "Follow" },
    { href: "#wire", label: "The Wire" },
  ];

  // Rotating full-width blocks the Wire drops between batches (WireStream).
  // Server-rendered here and handed down as nodes, so they cost the client
  // bundle nothing.
  const wireFeatures: React.ReactNode[] = [
    <div key="join" className="fpClosing">
      <h2>Claim your corner of the internet.</h2>
      <p>Your username is permanent. Setup takes about a minute.</p>
      <TrackedLink href="/signup" prefetch={false} className="button" event="front_page_cta_click" eventData={{ where: "wire" }}>
        Create your 0dot <Icon as={ArrowRight} size="sm" />
      </TrackedLink>
    </div>,
    ...(socials.length > 0
      ? [
          <div key="follow" className="fpWirePromo">
            <span className="fpKicker">Follow the dispatch</span>
            <p>0dot news, launches and behind-the-scenes, wherever you already are.</p>
            <ul className="fpWirePromoSocials">
              {socials.map((s) => (
                <li key={s.platform}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer me">
                    <BrandIcon platform={s.platform} size={20} /> {SOCIAL_LABELS[s.platform]}
                  </a>
                </li>
              ))}
            </ul>
          </div>,
        ]
      : []),
    // Newest channel uploads first (the lead already sits at the top of the
    // page), then the lead again once there's nothing newer to show.
    ...[...moreVideos.slice(0, 3), ...(leadVideo ? [leadVideo] : [])].slice(0, 3).map((v) => (
      <div key={`video-${v.id}`} className="fpWireVideo">
        <LiteYouTube id={v.id} title={v.title} />
        <div>
          <span className="fpKicker">Watch</span>
          <h3>{v.title}</h3>
          {v.caption && <p>{v.caption}</p>}
        </div>
      </div>
    )),
    <div key="dev" className="fpWirePromo">
      <span className="fpKicker">
        <Icon as={CodeXml} size="sm" /> For developers
      </span>
      <p>Sign in with 0dot, a public REST API and signed webhooks — build on the identity layer.</p>
      <a href="#developers" className="fpTextLink">
        Visit the developers desk <Icon as={ArrowRight} size="sm" />
      </a>
    </div>,
  ];

  return (
    <div id="top" className={newsreader.variable}>
      <FrontPageNav
        nameplate={<ZeroSafe text={FRONT_PAGE.nameplate} />}
        sections={sections}
        socials={socials.map((s) => ({ platform: s.platform, url: s.url, label: `0dot on ${SOCIAL_LABELS[s.platform]}` }))}
      />
      {notice}
    <div className="frontPage">
      {/* ── Masthead ─────────────────────────────────────────────── */}
      <header className="fpMasthead">
        <div className="fpMastheadMeta">
          <span>{IST_DATE.format(now)}</span>
          <span className="fpMastheadEdition">{FRONT_PAGE.edition}</span>
          <span>
            Vol. I · No. {issueNumber(now)} · <strong>Free forever</strong>
          </span>
        </div>
        <h1 id="fp-nameplate" className="fpNameplate">
          <ZeroSafe text={FRONT_PAGE.nameplate} />
        </h1>
        <p className="fpMotto">{FRONT_PAGE.tagline}</p>
        <nav className="fpSections" aria-label="Sections">
          {sections.map((sec) => (
            <a key={sec.href} href={sec.href}>
              {sec.label}
            </a>
          ))}
        </nav>
        <nav className="fpColophon" aria-label="About 0dot">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} prefetch={false}>
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* ── Ticker: latest dispatch headlines ────────────────────── */}
      {dispatches.length > 0 && (
        <div className="fpTicker" role="region" aria-label="Latest headlines">
          <span className="fpTickerLabel">
            <Icon as={Radio} size="sm" /> Latest
          </span>
          <div className="fpTickerTrack">
            {/* Rendered twice so the CSS marquee loops seamlessly; the copy
                is hidden from assistive tech. */}
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1 || undefined}>
                {dispatches.map((d) => (
                  <li key={d.id}>{toHeadline(d.body, 70).headline}</li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}

      {/* ── Front page: lead story + dispatches column ───────────── */}
      <section id="front" className="fpFront">
        <article className="fpLead">
          <span className="fpKicker">Cover story</span>
          <h2 className="fpLeadHeadline">Your permanent home on the internet</h2>
          <p className="fpDeck">
            One username that never changes, one profile that carries your work, links, posts and
            reputation — and an identity other apps can build on.
          </p>
          <p className="fpByline">
            By the 0dot newsroom · {IST_TIME.format(now)} IST
          </p>

          <figure className="fpLeadFigure">
            {leadVideo ? (
              <LiteYouTube id={leadVideo.id} title={leadVideo.title} priority />
            ) : (
              <div className="fpLeadVisual">
                <DigitalHomeVisual />
              </div>
            )}
            <figcaption>{leadVideo?.caption ?? leadVideo?.title ?? "One identity, connected to everything you do."}</figcaption>
          </figure>

          <div className="fpLeadBody">
            <p className="fpDropCap">
              Most of us are scattered across a dozen apps, each holding a sliver of who we are. <ZeroSafe text="0dot" />{" "}
              gathers it into one address: a profile you own, a feed that proves you&apos;re real,
              and communities, storefronts and events that all hang off the same name.
            </p>
            <p>
              Claim a handle once and it&apos;s yours for good. Put it in every bio, signature and
              business card — it never breaks and it grows with you.
            </p>
          </div>

          <div className="fpActions">
            <TrackedLink href="/signup" prefetch={false} className="button" event="front_page_cta_click" eventData={{ where: "lead" }}>
              Create your 0dot <Icon as={ArrowRight} size="sm" />
            </TrackedLink>
            <Link href="/login" prefetch={false} className="button buttonSecondary">
              Log in
            </Link>
            <Link href="/explore" prefetch={false} className="fpTextLink">
              Read today&apos;s public feed <Icon as={ArrowUpRight} size="sm" />
            </Link>
          </div>
        </article>

        <aside className="fpDispatches" aria-labelledby="fp-dispatches-heading">
          <h2 id="fp-dispatches-heading" className="fpColumnHead">
            Latest dispatches
          </h2>
          {desk && (
            <Link href={`/${desk.handle}`} prefetch={false} className="fpDesk">
              <span className="fpDeskName">
                {desk.displayName} <Icon as={BadgeCheck} size="sm" />
              </span>
              <span className="fpDeskHandle">@{desk.handle}</span>
            </Link>
          )}
          {dispatches.length > 0 ? (
            <ol className="fpDispatchList">
              {dispatches.map((d, i) => {
                const { headline, rest } = toHeadline(d.body);
                return (
                  <li key={d.id} className={i === 0 ? "fpDispatch fpDispatchTop" : "fpDispatch"}>
                    <Link href={`/${desk!.handle}/status/${d.id}`} prefetch={false}>
                      {i === 0 && d.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="fpDispatchImage" src={d.imageUrl} alt="" loading="lazy" decoding="async" />
                      )}
                      <time dateTime={d.createdAt.toISOString()}>{formatAgo(d.createdAt, now)}</time>
                      <h3>{headline}</h3>
                      {i === 0 && rest && <p>{rest}</p>}
                      <span className="fpDispatchStats">
                        <Icon as={Heart} size="sm" /> {d.likeCount}
                        <Icon as={MessageCircle} size="sm" /> {d.replyCount}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="fpEmpty">
              The newsroom is warming up. The first dispatch lands here the moment it&apos;s posted.
            </p>
          )}
        </aside>
      </section>

      {/* ── Watch ────────────────────────────────────────────────── */}
      {moreVideos.length > 0 && (
        <section id="watch" className="fpSection">
          <h2 className="fpSectionHead">Watch</h2>
          <div className="fpVideoGrid">
            {moreVideos.map((v) => (
              <figure key={v.id} className="fpVideoCard">
                <LiteYouTube id={v.id} title={v.title} />
                <figcaption>
                  <strong>{v.title}</strong>
                  {v.caption && <span>{v.caption}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ── Inside this edition: product features as columns ─────── */}
      <section id="inside" className="fpSection">
        <h2 className="fpSectionHead">Inside this edition</h2>
        <div className="fpColumns">
          {[
            {
              icon: Link2,
              kicker: "Identity",
              title: "One link that holds everything you are",
              body: "Portfolio, writing, bookings and newsletter behind a single address that never breaks and is never sold.",
            },
            {
              icon: BadgeCheck,
              kicker: "Feed",
              title: "Proof you're real — not just a bio",
              body: "Post updates, work and thoughts right on your identity, so every visitor meets a living person.",
            },
            {
              icon: Users,
              kicker: "Communities",
              title: "The rooms where your people already are",
              body: "Run a community, host events and go live with voice rooms — your reputation follows you in.",
            },
            {
              icon: Store,
              kicker: "Business",
              title: "Open shop on the same name",
              body: "Storefronts, services, jobs and a marketplace, paid in coins from one wallet.",
            },
          ].map((c) => (
            <article key={c.kicker} className="fpColumn">
              <span className="fpKicker">
                <Icon as={c.icon} size="sm" /> {c.kicker}
              </span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Developers desk ──────────────────────────────────────── */}
      <section id="developers" className="fpSection fpDevelopers">
        <h2 className="fpSectionHead">The developers desk</h2>
        <div className="fpDevGrid">
          <div className="fpDevCopy">
            <span className="fpKicker">
              <Icon as={CodeXml} size="sm" /> Build on 0dot
            </span>
            <h3 className="fpDevHeadline">An identity layer other apps can build on</h3>
            <p>
              Add <strong>Sign in with <ZeroSafe text="0dot" /></strong>, read and publish through a public REST API, and
              react to activity with signed webhooks. People approve exactly what your app can do on a
              consent screen — and can revoke it any time.
            </p>
            <ul className="fpDevFacts">
              <li>
                <Icon as={KeyRound} size="sm" /> OAuth 2.0 with PKCE required on every sign-in
              </li>
              <li>
                <Icon as={CodeXml} size="sm" /> REST API at <code>/api/v1</code>, rate-limited per app
              </li>
              <li>
                <Icon as={Webhook} size="sm" /> Signed webhooks for likes, mentions, new followers, payments and bookings
              </li>
            </ul>
            <div className="fpScopes" aria-label="Available permission scopes">
              {scopes.map((s) => (
                <code key={s.key} title={s.description}>
                  {s.key}
                </code>
              ))}
            </div>
            <TrackedLink href="/signup" prefetch={false} className="button" event="front_page_cta_click" eventData={{ where: "developers" }}>
              Register your app <Icon as={ArrowRight} size="sm" />
            </TrackedLink>
          </div>
          <pre className="fpCode" aria-label="Example: signing in with 0dot and calling the API">
            <code>{DEV_SAMPLE}</code>
          </pre>
        </div>
      </section>

      {/* ── Follow ───────────────────────────────────────────────── */}
      <section id="follow" className="fpSection fpFollow">
        <h2 className="fpSectionHead">Follow the dispatch</h2>
        <ul className="fpSocials">
          {desk && (
            <li>
              <Link href={`/${desk.handle}`} prefetch={false}>
                <span>0dot</span>
                <strong>@{desk.handle}</strong>
              </Link>
            </li>
          )}
          {socials.map((s) => (
            <li key={s.platform}>
              <a href={s.url} target="_blank" rel="noopener noreferrer me">
                <BrandIcon platform={s.platform} size={28} />
                <span>{SOCIAL_LABELS[s.platform]}</span>
                <strong>{s.handle ?? new URL(s.url).hostname.replace(/^www\./, "")}</strong>
                <Icon as={ArrowUpRight} size="sm" />
              </a>
            </li>
          ))}
          <li>
            <Link href="/download" prefetch={false}>
              <span>Mobile</span>
              <strong>Get the app</strong>
            </Link>
          </li>
        </ul>
      </section>

      {/* ── The Wire: endless stream, no footer ─────────────────── */}
      <section id="wire" className="fpSection fpWireSection" aria-labelledby="fp-wire-heading">
        <h2 id="fp-wire-heading" className="fpSectionHead">
          The Wire
        </h2>
        <p className="fpWireDeck">Everything new on 0dot, as it&apos;s posted — keep scrolling.</p>
        <WireStream
          initialItems={wire.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
          initialNext={wire.next}
          features={wireFeatures}
        />
      </section>
    </div>
    </div>
  );
}
