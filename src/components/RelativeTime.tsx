"use client";

import { useEffect, useState } from "react";

// Renders "2m ago" / "3h ago" / "5d ago", falling back to a real date past
// a week — computed client-side so it's always viewer-local, never the
// server's timezone/locale. Consolidates 4 duplicate, near-identical
// relativeTime() functions (PostCard.tsx, c/[slug]/manage/page.tsx,
// b/[slug]/manage/contact/page.tsx, notifications/page.tsx) that computed
// this during render in a Server Component — a hydration-text mismatch
// waiting to happen (server ICU vs the viewer's own locale/timezone), the
// same class of bug MessageBubble's MessageTimestamp and PollBlock's
// closesLabel avoid by rendering nothing until after mount. That
// empty-then-fill approach already keeps the hydration pass matching (both
// render "" for the <time> text); suppressHydrationWarning is just a
// belt-and-braces guard on top of it.
// A future date (appointment/renewal/scheduled-post timestamps reuse this
// same component for the hydration-safe deferred-render pattern, not just
// genuinely past createdAt-style ones) has no sensible "Xh ago" reading —
// falls straight through to the absolute fallback instead of a nonsensical
// negative duration.
function formatRelative(date: Date, withTime: boolean): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const absolute = () => (withTime ? date.toLocaleString() : date.toLocaleDateString());
  if (seconds < 0) return absolute();
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return absolute();
}

export function RelativeTime({
  date,
  className,
  // Past a week — or for any future date, which never gets "ago" phrasing
  // — the fallback is an absolute date/time. withTime includes the time of
  // day in that fallback (a call site that used to render the full
  // `.toLocaleString()`, not just `.toLocaleDateString()`).
  withTime = false,
}: {
  date: Date | string;
  className?: string;
  withTime?: boolean;
}) {
  const iso = typeof date === "string" ? date : date.toISOString();
  const [text, setText] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: defers the locale/timezone-dependent value until after mount, same as MessageTimestamp/closesLabel.
    setText(formatRelative(new Date(iso), withTime));
  }, [iso, withTime]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
