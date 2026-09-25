"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBrowserTab } from "@/components/BrowserTabProvider";

// Mounted once in RootLayout, authenticated users only. Opens a single
// EventSource for the whole *browser* (not one per tab — see below) and, on any event,
// calls router.refresh() — this re-renders the current route's Server
// Component tree (SiteHeader's unread badge, an open /messages inbox list,
// an open conversation's message list) with authoritative data from the DB,
// rather than maintaining a second, hand-rolled copy of that state on the
// client. Simpler and less likely to drift than a bespoke context/pub-sub
// layer, at the cost of a full RSC refetch per live event — acceptable at
// chat-message frequency, not high-frequency enough to need finer-grained
// patching yet.
//
// One stream per browser, not per tab: over HTTP/1.1 (the dev server, and any
// non-HTTP/2 deployment) a browser allows 6 connections per origin, and an
// open SSE stream holds one for its whole life — so with a handful of tabs
// (or a few full page loads in a row) the pool filled up and the next page
// load hung until something closed. Tabs now elect a leader with a Web Lock;
// only the leader opens the EventSource and it relays each event to the other
// tabs over a BroadcastChannel. When the leader tab closes/crashes the lock
// is released and the next waiting tab takes over. Presence is unaffected
// ("has an open stream" is still true while any tab is open). Browsers
// without Web Locks/BroadcastChannel fall back to one stream per tab.
const REFRESH_COALESCE_MS = 300;

export function MessagingProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setUnreadCount } = useBrowserTab();

  useEffect(() => {
    if (!userId) return;

    // /api/browser-tab/unread-count runs the exact same two count queries
    // router.refresh() already triggers via SiteHeader's NotificationBell/
    // MessagesBadge (both Server Components on every refreshed route) — so
    // firing it unconditionally doubles that DB work on every single
    // realtime event, for every connected client. The tab badge only has
    // anything to say when this tab *isn't* the one on screen (that's what
    // it's for — a focused tab already shows the just-refreshed header
    // badges directly), so skip the extra round trip while focused and only
    // pay for it when the badge can actually be seen.
    const fetchUnreadCount = () => {
      fetch("/api/browser-tab/unread-count")
        .then((res) => res.json())
        .then((data: { count: number }) => setUnreadCount(data.count))
        .catch(() => {});
    };

    const handleEvent = () => {
      // Coalesce bursts (e.g. several group-chat messages landing at once)
      // into a single refresh rather than one per event.
      if (pendingRef.current) return;
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        router.refresh();
        if (document.visibilityState === "hidden" || !document.hasFocus()) {
          fetchUnreadCount();
        }
      }, REFRESH_COALESCE_MS);
    };

    let source: EventSource | null = null;
    let channel: BroadcastChannel | null = null;
    let stopped = false;
    let releaseLeadership: (() => void) | null = null;
    const abort = new AbortController();

    const openStream = () => {
      source = new EventSource("/api/messages/stream");
      source.onmessage = (event) => {
        // BroadcastChannel doesn't deliver to the sender, so the leader
        // handles its own event directly and relays it to follower tabs.
        channel?.postMessage(event.data);
        handleEvent();
      };
    };

    if (typeof navigator !== "undefined" && "locks" in navigator && typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(`messages-events:${userId}`);
      channel.onmessage = () => handleEvent();
      navigator.locks
        .request(`messages-stream:${userId}`, { signal: abort.signal }, () => {
          if (stopped) return;
          // Held (this promise pending) for as long as this tab is leader;
          // the browser also releases it if the tab closes or crashes.
          return new Promise<void>((resolve) => {
            openStream();
            releaseLeadership = () => {
              source?.close();
              source = null;
              resolve();
            };
          });
        })
        .catch(() => {});
    } else {
      openStream();
    }

    // Covers the tab-was-focused-when-the-event-landed case: the badge
    // fetch above was skipped, so catch up the moment the tab actually
    // becomes the backgrounded one instead of waiting on the next event.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") fetchUnreadCount();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      abort.abort();
      releaseLeadership?.();
      source?.close();
      channel?.close();
      if (pendingRef.current) clearTimeout(pendingRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [userId, router, setUnreadCount]);

  return <>{children}</>;
}
