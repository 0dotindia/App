# User Journeys

Status: Foundational document (Priority 5). Documents how different users accomplish tasks today, and the target journey for tasks not yet built. Every journey is checked against `UX_GUIDELINES.md` before it ships.

Legend: **Live** (works today, verified in Chrome), **Planned** (has a phase spec), **Future** (not yet specced).

## New user onboarding — Live

1. Visitor lands on `/` → a minimal marketing hero (`MarketingNav` + `DigitalHomeVisual`), not an embedded form. `MarketingNav`'s "Create your 0dot" (or clicking any `DigitalHomeVisual` node) is the only path onward — no signup form on this page anymore (see `INFORMATION_ARCHITECTURE.md`'s `"/"` row; `AuthTabs`/`LandingLiveShowcase` are superseded, see `COMPONENT_LIBRARY.md`).
2. On `/signup` (or the landing page's `AuthTabs`): fills name + username + password — nothing else. No email, phone, or date of birth, and **no email/OTP verification step** (removed 2026-09-26: the platform doesn't send onboarding mail or SMS). While typing the username, `UsernameField` debounces (~400ms) a call to `checkUsernameAvailability` (`auth.ts`) and shows live checking/available/taken/reserved/invalid/network-error states — a preview only, `signup()` re-validates format and availability itself regardless of what the field reported.
3. Submits → account + username + profile + wallet accounts + 10 password recovery codes created in one transaction, session created immediately, redirected to `/signup/recovery-codes`, which shows the codes once (carried there in a short-lived encrypted httpOnly cookie) and requires "I've saved my recovery codes" before continuing.
4. Continue → the user's own new profile (`/{username}`) — the "here's your new page" moment, deliberately not `/feed`. `AgeGatePrompt` then asks once for date of birth (unknown DOB = protective restrictions, phase-12 §8.2).
5. Abuse resistance without email: per-IP/per-handle signup rate limits, the honeypot field, and account-age gates (24h) on coin transfers and referral rewards (`wallet/eligibility.ts`, `wallet/referral.ts`).

## Log in — Live

1. `/login` → username (or email/mobile if the account has one) + password → if the account has TOTP 2FA enabled, `/login/2fa` (6-digit code or a recovery code) before a session is issued → `createSession` → `/feed` (not back to own profile — a returning user wants to see what's new, not their own page every time).

## Manage account security — Live

`/s/{username}/security` — change password and regenerate password recovery codes; `/security/sessions` lists active sessions with revoke-one / revoke-all-others; `/security/contact` changes email or phone (verification-gated); `/two-factor` enrolls/disables TOTP and regenerates recovery codes. All mirrored under `/api/v1/account/*` for the mobile app.

## Log out — Live

Single "Log out" button in header (only visible when authenticated) → `destroySession` → `/login`.

## Create/edit a profile — Live

Profile fields (displayName, bio) editable inline via a collapsed `<details>` disclosure on the owner's own profile page, plus a full account/creator dashboard at `/s/{username}`. Avatar upload is built (`saveUploadedImage`/`@vercel/blob`, wired in `profile.ts`) — falls back to the `Logo` mark only when no avatar has been set.

## Add / reorder / remove a link — Live

Owner-only: `AddLinkForm` appends a link; each link row has up/down reorder buttons (disabled at the ends) and a delete button, all as separate Server Action forms (`moveLink`, `deleteLink`) — no drag-and-drop yet despite `docs/ROADMAP.md` Phase 1 naming "drag-and-drop ordering." Current up/down-button approach is a reasonable MVP substitute; upgrading to drag-and-drop is a Phase 1 follow-up, not a new phase.

## Publish a post — Live

Logged-in user in good standing (`requireVerifiedUser` guard — name kept, but it no longer requires a verified email). Compose box on `/feed` → `createPost` (1–500 chars) → appears at top of `/feed` and on the author's profile Posts section, `#hashtag`/`@mention` tokens styled and linked at render time.

## Like / unlike a post — Live

Toggle button on `PostCard`, `aria-pressed` reflects state, `toggleLike` Server Action flips `PostLike` + denormalized `likeCount` in a transaction, `revalidatePath("/feed")`.

## Delete a post — Live

Owner-only button on `PostCard` → soft-delete (`deletedAt` set, not a hard delete) → disappears from feed and profile.

## View a public profile as an anonymous visitor — Live

`/{username}` renders fully for logged-out visitors (bio, links, posts) with owner-only controls hidden. Header shows a "Join for free" CTA instead of the logout button, specifically only on profile pages (checked via `validateUsernameFormat` against the current path segment) — not shown on `/`, `/login`, or `/signup` themselves, which are chromeless (no `SiteHeader`, see `isChromelessPath`/`route-context.ts`) and carry their own "Create your 0dot"/"Log in" navigation instead (`MarketingNav`, `AuthTopBar`).

## Follow a user — Live (Phase 2)

Follow button on another user's profile (`followUser`/`unfollowUser`, `src/app/actions/follow.ts`; `acceptFollowRequest`/`rejectFollowRequest` for private-account follow requests), follower/following counts on the profile. `/feed` is follow-based Home, `/explore` is the separate global-chronological feed, `/trending` is a third, velocity-ranked feed — three distinct implementations, not one component with a filter (see `INFORMATION_ARCHITECTURE.md`).

## Send a direct message — Live (Phase 2)

`/messages`, `/messages/requests` — end-to-end-encrypted 1:1 and group DMs (`src/lib/messaging.ts`) with live SSE delivery, message requests for first-contact-from-a-stranger, file/voice-note attachments.

## Join a community — Live (Phase 3)

`/c/{slug}` — join/leave, moderator roles (ban/mute/promote/transfer ownership), rules, discovery tags, post flair, wiki, live chat, voice rooms, polls, Q&A.

## Create a business page — Live (Phase 4)

`/b/{slug}` — distinct ownership model from personal profiles (`BusinessMember` roles, not a single `authorId`), weak-signal claim/verification gate (auto-approve on domain match, otherwise a platform-admin review queue), products/services catalog, jobs board, appointment scheduling.

## Report abuse — Live (Phase 12)

`ReportButton` (`src/components/ReportButton.tsx`) → `fileReport` (`src/app/actions/reports.ts`) is wired into `PostCard` (posts, hidden for the post's own author) and `/{username}` profiles (hidden for the profile owner), feeding the shared `TrustSafetyCase`/`Report` queue and the `Appeal` workflow. Block/unblock (`blockUser`/`unblockUser`, `src/app/actions/block.ts`) is likewise live on the profile page. See `docs/foundations/TRUST_SAFETY.md` for the full moderation surface.

## Delete an account — Live

`src/app/actions/account-lifecycle.ts` — deactivation and "request deletion" are the **same** state transition (`User.status → deactivated`, `deletionScheduledFor` set to +30 days); a scheduled sweep (`src/lib/account-deletion.ts`) is what actually erases data after the grace period, so there's no separate "delete now" path, only stronger confirmation copy at the deletion call site. Password-confirmed, rate-limited (5 / 15 min). `getCurrentUser()` force-logs-out any non-active user on its next read, so no explicit session kill is needed. `exportAccountData()` (same file) gives a self-service JSON export of the caller's own account/profile/links/posts/articles/projects/bookmarks first. Also exposed as `DELETE /api/v1/account/lifecycle/delete`. The 30-day grace period resolves the "exact grace period is an open question" note from earlier revisions. See `docs/foundations/TRUST_SAFETY.md` and `docs/specs/addendum-account-settings-hardening.md` §7.

## Recover a forgotten password — Live

`/forgot-password`: username + one unused recovery code + new password (`recoverPassword`, `src/app/actions/auth.ts`) → `/reset-password/success`; the code is consumed and every session is revoked. Replaced the emailed reset link on 2026-09-26. If the codes are lost too, an admin issues a fresh set at `/admin/account-recovery` after verifying identity out-of-band.
