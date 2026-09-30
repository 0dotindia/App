"use client";

import { useEffect, useState } from "react";

// For the handful of call sites that want a specific Intl.DateTimeFormat
// shape (e.g. "Jan 2020") rather than RelativeTime's "Xh ago"/"Xd ago"
// wording — same hydration-safe deferred-render pattern (empty until
// mount, so the server/client locale never has a chance to mismatch).
export function ClientFormattedDate({
  date,
  options,
  className,
  fallback = "",
}: {
  date: Date | string | null;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
  // Shown (immediately, no deferred-render needed — it's static) when
  // `date` is null, e.g. an ongoing work-experience entry's end date.
  fallback?: string;
}) {
  const iso = date === null ? null : typeof date === "string" ? date : date.toISOString();
  const [text, setText] = useState("");

  useEffect(() => {
    if (iso === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: defers the locale-dependent value until after mount, same as RelativeTime.
    setText(new Date(iso).toLocaleDateString(undefined, options));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `options` is typically a fresh object literal each render; it's read once per iso change, not worth memoizing at every call site for this.
  }, [iso]);

  if (iso === null) return <>{fallback}</>;

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
