# Welcome to 0dot

**One identity. One profile. Infinite possibilities.**

0dot is your permanent home on the internet, at `0dot.in/yourname`. Not a
link-in-bio page you outgrow, not another social network competing for your
attention — an *identity layer*. One address you put everywhere, that
represents you accurately and that you actually own.

Your username, once claimed and active, is permanent — the same way an email
address or phone number is. Everything you build on 0dot attaches to that one
identity.

This guide walks through everything the platform can do. You don't need most
of it on day one — skip to **Getting started** and come back when you're
ready for more.

---

## The one idea to hold onto

**Your profile is the center. Everything else attaches to it.**

Posts, links, a portfolio, a storefront, a community you run, a course you
sell, a business page, an event — each one references the same identity, so
your reputation and audience follow you everywhere instead of being split
across a dozen accounts.

Namespaces like `/c/`, `/b/`, `/e/`, `/m/` organize *content*. Your identity
is always the bare `0dot.in/yourname`.

---

## Getting started (about 10 minutes)

1. **Claim your username.** Sign up at `0dot.in/signup`, verify your email,
   and pick your handle. Choose carefully — it's your permanent address.
2. **Set up your profile.** Add an avatar and cover image, write a short bio,
   pick a theme from the curated presets, and link your other social
   accounts.
3. **Add your links.** This is the link-in-bio surface: add the URLs you want
   people to find (portfolio, newsletter, booking link, shop), drag to
   reorder them, and — if you want — schedule a link to appear or disappear
   on a date. Every click is counted, privately.
4. **Make your first post.** Posts live right on your identity. Anyone who
   lands on your profile sees a living person, not a placeholder.
5. **Find your people.** Use search (`/search`) for users, communities,
   businesses, and posts; browse `/explore` for discovery; follow anyone
   whose updates you want in your home feed.

That's a complete 0dot presence. Everything below is optional depth.

---

## Your profile

Your public page at `0dot.in/yourname` shows, roughly in this order:

- **Header** — avatar, display name, your `0dot.in/yourname` path, follow
  button, follower count.
- **Bio** — a short description of who you are.
- **Links** — your curated link list, always near the top.
- **Posts** — your activity, newest first.
- **Portfolio sections** — projects, skills, repositories, papers,
  certificates, and awards, shown inline in an order you control (Phase 6).
- **Storefront / course / booking teasers** — lightweight links out to your
  full commerce pages if you have them.

**Editing** happens inline on your own profile — only you see the edit
controls, and every permission is enforced on the server, not just hidden in
the UI.

**Themes** are a curated set of presets built on a fixed design system.
Premium unlocks a larger menu of presets — never raw CSS/HTML/JS.

**Two different badges:**
- **Verified** (checkmark) — a manual signal of authenticity or notability.
  It cannot be bought.
- **Premium** (separate icon and color) — indicates a paid subscription. A
  profile can have both; they're never interchangeable.

**Followers & following** live at `0dot.in/yourname/followers` and
`/following`.

---

## The three feeds

These are deliberately separate, not one feed with filter tabs:

| Feed | Path | What it shows |
|---|---|---|
| **Home** | `/feed` | Reverse-chronological posts from people you follow, plus a compose box. |
| **Explore** | `/explore` | Global chronological discovery — everyone, newest first. |
| **Trending** | `/trending` | Velocity-ranked (time-decayed) — what's getting traction right now. |

There is no engagement-maximizing "For You" algorithm. The feed exists to
give your identity a pulse, not to be a time sink.

---

## Posting & social

- **Posts** support reactions and comments. Save any post to **Bookmarks**
  (`/bookmarks`).
- **Follow / unfollow** anyone. **Block** to cut someone off entirely.
- **Messages** (`/messages`) — 1:1 and group direct messages, delivered live,
  with message content encrypted at rest. Messages from people you don't
  follow land in **Requests** (`/messages/requests`) so your inbox stays
  clean.
- **Notifications** (`/notifications`) — batched sensibly (read-time
  aggregation), not designed to manufacture anxiety.

---

## Links, short links & your card

- **Link-in-bio** — the reorderable link list on your profile, with
  scheduling and private per-click analytics. Free tier shows the trailing
  30 days of analytics; Premium shows full history (the data is always
  retained, so upgrading later shows everything).
- **Short links** (`/s/yourname/short-links`) — a personal URL shortener;
  short URLs redirect through `0dot.in/l/<code>`.
- **QR codes** — generate a QR for your profile or any link.
- **Digital business card** — a shareable vCard-style card
  (`0dot.in/yourname/card`), discoverable via `.well-known`, for handing your
  identity over in person or by NFC.

---

## Portfolio — `/p/`

Proof of work, attached to your identity:

- **Projects** with their own pages at `/p/<project>`
- **Skills**, **resume**, **linked git repositories**
- **Credentials / certificates** and **awards**
- A **layout** you control (`/s/yourname/portfolio/layout`) for the order
  sections appear on your profile

---

## Publishing — Articles, Books, Wiki, Files

Long-form content, all with reactions, comments, and search integration:

- **Articles** — `0dot.in/yourname/articles`
- **Books** — multi-chapter, `0dot.in/yourname/books/<slug>/<chapter>`
- **Personal wiki** — `0dot.in/yourname/wiki`
- **Files** — downloadable published files, `0dot.in/yourname/files`

Manage all of it from `/s/yourname/content/*`.

---

## Communities — `/c/`

Spaces that aren't tied to one person. Browse at `/c`, create at `/c/new`.

- **Visibility** — public, restricted, or private.
- **Collaborative wiki** with full revision history and a history view.
- **Live chat** per community, plus **walkie-talkie-style voice rooms**.
- **Polls and Q&A**, post **flair**, discovery **tags**, community **rules**.
- **Moderation** — ban, mute, promote, transfer ownership; a shared action
  log.
- **Staff analytics** for people who run the space.

Manage a community at `/c/<slug>/manage`.

---

## Business pages — `/b/`

A shared identity for a company or product. Browse at `/b`, create at
`/b/new`.

- **Claim / verification** — automatic approval when you can prove a domain
  match, otherwise a platform-admin review queue.
- **Team roles** — multiple people manage one business.
- **Catalog & storefront** — list products and services with a public
  storefront view.
- **Reviews** — attributed to real 0dot identities.
- **Jobs board** — post openings and receive applications
  (`/b/<slug>/jobs`). There's also a platform-wide board at `/jobs` with
  saved **alerts**.
- **Appointments** — MVP booking with transactional double-booking
  prevention (`/b/<slug>/appointments`).
- **Document library** and a lightweight **CRM** (contacts and activity
  history) under `/b/<slug>/manage/crm`.

---

## Events — `/e/`

Hosted by a business *or* a community (never both). Browse at `/e`, create at
`/e/new`. Supports **RSVP** and **ticketing**.

---

## Marketplace & Services — `/m/`

- **Freelance services** — sell your own services at
  `0dot.in/yourname/services`, with the same booking model as business
  appointments.
- **Marketplace listings** (`/m`) — a browse/search surface for apps,
  themes, templates, and digital products.

---

## Making money (creators)

0dot has a full payments backbone (live Stripe Connect under the hood, behind
a swappable interface). Once you connect a payout account
(`/s/yourname/monetization/payouts`), you can offer:

- **Tips** on your profile and posts
- **Membership tiers** with gated content
- **Digital downloads** and **online courses**
- A **podcast** (with a real RSS feed) and a **newsletter**
- **Affiliate links** (redirect through `0dot.in/aff/<code>`)
- **Livestreams** — real video when the platform has LiveKit configured,
  otherwise scheduling + chat

Every transaction goes through an auditable ledger. Premium subscribers pay a
**reduced platform fee** on their creator earnings.

---

## Coins & Wallet — `/wallet`

0dot has a closed-loop internal currency:

- **1 coin = 1 USD**, fixed. Not a rate that moves, not crypto, not a
  speculation asset.
- **Signup grant** — new accounts get a small starter grant (currently 1
  coin), marked *restricted*: non-transferable and it expires after 90 days.
- **Referral rewards** — invite someone with your referral link (from the
  Wallet page); once they verify their email and take a real action, **you
  and they each get 3 coins** (promo bucket, 90-day expiry, with an
  anti-farming cap).
- **Earning**, not buying — coins come from the signup grant, referrals,
  creator earnings, refunds, and promos. There's no bank top-up yet.
- **Spending** — today, coins buy a **Premium Profile** subscription.
- **Transfers** — you can send transferable coins to another user, subject to
  account-age and verification checks that keep the system from being farmed.

Every wallet movement is a double-entry ledger transaction you can see in
your activity list.

---

## Premium Profile

A personal paid subscription for your `Profile`. Perks:

- **A custom domain slot included** (see below)
- **Full link-analytics history** instead of the trailing 30 days
- **A higher link cap** and a **larger curated theme library**
- **A Premium badge** (distinct from, and never a substitute for,
  verification)
- **A reduced creator platform fee** if you earn through monetization

You can pay for Premium with **coins** or a card, from `/wallet` or
`/s/yourname/billing/premium`. Cancelling keeps your perks until the end of
the period you already paid for — no instant clawback.

---

## Custom domains

Point your own domain at your identity: `yourname.com/*` mirrors
`0dot.in/yourname/*` in full — every public page under your identity, not
just a landing page. One slot is included with Premium; additional domains
are priced separately. Manage at `/s/yourname/billing/domains`.

---

## Sign in with 0dot (for developers)

Your identity is meant to be built on:

- **"Sign in with 0dot"** — standard OAuth2 with PKCE, scoped consent.
- **Public REST API** (`/api`) — bearer-authed, rate-limited.
- **Signed webhooks** — HMAC-signed, with retry and backoff.

Register an app at `/s/yourname/developer`. As a user, review and revoke
everything you've authorized at `/s/yourname/authorized-apps`.

0dot's own mobile and web apps use exactly this public API — there's no
privileged internal back door.

---

## Organizations & Enterprise — `/org/`

An **Organization** is distinct from a Business — it's for internal team
identity:

- Team management, an employee directory, an audit log
- **Single sign-on** — SAML2 / OIDC, with just-in-time provisioning
- Internal, organization-only communities

Create at `/org/new`, manage at `/org/<id>/manage`.

---

## Trust, safety & your rights

- **Report center** (`/trust-safety`) — report content or accounts on any
  surface.
- **Appeals** — every moderation action against you is explainable and
  appealable. There's a public transparency report.
- **DMCA** (`/dmca`) — a full takedown and counter-notice workflow.
- **Your content stays yours** — version history on posts and articles,
  ownership records, copyright declarations, optional watermarking.
- **Privacy by default** — new fields and features start at the most private
  reasonable setting. Visibility is something you opt *into*.
- **Your data is yours to take** — identity data you own is exportable.
- **Leaving is as easy as joining** — account deletion is a real, simple
  flow, not a maze.

---

## Mobile & offline

- **iOS and Android apps** — real OAuth clients of the public API.
- **Install as an app** — 0dot is a PWA; add it to your home screen from any
  modern browser.
- **Push notifications** — a third delivery channel alongside in-app and
  email.

---

## Account & settings — `/s/yourname/...`

Your whole account dashboard lives under one route tree:

| Area | Path |
|---|---|
| Profile, links, card | `/s/yourname`, `/s/yourname/links`, `/s/yourname/card` |
| Security — password | `/s/yourname/security` |
| Security — 2FA (TOTP) | `/s/yourname/two-factor` |
| Security — active sessions | `/s/yourname/security/sessions` |
| Security — email / phone change | `/s/yourname/security/contact` |
| Privacy | `/s/yourname/privacy` |
| Preferences | `/s/yourname/preferences` |
| Notification settings | `/s/yourname/notifications` |
| Blocked accounts | `/s/yourname/blocked` |
| Authorized apps | `/s/yourname/authorized-apps` |
| Billing — Premium | `/s/yourname/billing/premium` |
| Billing — domains | `/s/yourname/billing/domains` |
| Developer apps | `/s/yourname/developer` |
| Content (articles, books, wiki, courses, podcast, newsletter…) | `/s/yourname/content/*` |
| Monetization (memberships, products, services, payouts, affiliate) | `/s/yourname/monetization/*` |
| Portfolio (projects, skills, resume, repositories, credentials, layout) | `/s/yourname/portfolio/*` |
| Calendar, forms, cross-post | `/s/yourname/calendar`, `/s/yourname/forms`, `/s/yourname/cross-post` |

---

## Why it works this way

A few principles the whole platform is built against:

- **User-first.** When a feature would help our growth metrics at your
  expense — dark patterns, friction to leaving, anxiety-driven notifications
  — you win.
- **Private by default.** You opt into visibility, not out of it.
- **Yours to take.** Your identity data is exportable and, over time,
  programmable by you. Not locked in.
- **Permanent addresses.** A claimed, active username is a permanent address.
- **Boring and reliable beats flashy and fragile.** Premium means polish and
  trustworthiness — fast, consistent, no broken states.

**What 0dot deliberately won't build:** an attention-maximizing social
network, an ad-first or data-selling business, a crypto/NFT speculation
platform, or dark-pattern growth mechanics.

---

## Quick reference — where things live

| You want to… | Go to |
|---|---|
| See your public identity | `0dot.in/yourname` |
| Edit your account | `0dot.in/s/yourname` |
| Your home feed | `/feed` |
| Discover people | `/explore`, `/trending`, `/search` |
| Messages | `/messages` |
| Notifications | `/notifications` |
| Communities | `/c` |
| Businesses | `/b` |
| Events | `/e` |
| Marketplace | `/m` |
| Jobs | `/jobs` |
| Wallet & coins | `/wallet` |
| Report something | `/trust-safety` |
| Get the mobile app | `0dot.in/download` |

---

*Your username is permanent. Setup takes about a minute. Free forever, no
card required.*
