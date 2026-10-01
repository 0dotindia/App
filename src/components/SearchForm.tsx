"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { Search, LoaderCircle, BadgeCheck } from "lucide-react";

const DEBOUNCE_MS = 300;

type Suggestions = {
  users: { handle: string; displayName: string; isVerified: boolean }[];
  posts: { id: string; handle: string | null; displayName: string; isVerified: boolean; snippet: string }[];
};

const EMPTY_SUGGESTIONS: Suggestions = { users: [], posts: [] };

// Shared search entry point — a real GET form (Enter submits, works without
// JS), used by NavLinks (sidebar/mobile menu) and the desktop top header,
// per NAVIGATION.md's "top search belongs in the persistent header." Was
// previously a dumb, JS-free input only (review finding, 2026-10-01: you had
// to press Enter and land on /search before seeing anything, unlike
// /search's own SearchBox, which already live-updates as you type). This
// progressively enhances the same form with a debounced preview dropdown —
// same debounce window and "show a spinner, not a silent gap" posture as
// SearchBox (see that component's comment) — while leaving the plain GET
// submission as the fallback and the actual results page unchanged.
export function SearchForm() {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY_SUGGESTIONS);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Closes the dropdown on an outside click — blur alone can't be trusted
  // here since it fires before a click on a dropdown item registers.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setSuggestions(EMPTY_SUGGESTIONS);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);
    timeoutRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      fetch(`/api/internal/search-suggestions?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? (res.json() as Promise<Suggestions>) : EMPTY_SUGGESTIONS))
        .then((data) => {
          if (requestId !== requestIdRef.current) return; // a newer keystroke's request already won
          setSuggestions(data);
          setIsLoading(false);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions(EMPTY_SUGGESTIONS);
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setIsOpen(false);
  }

  const trimmedQuery = query.trim();
  const hasResults = suggestions.users.length > 0 || suggestions.posts.length > 0;
  const showDropdown = isOpen && trimmedQuery.length > 0 && (isLoading || hasResults);

  return (
    // siteHeaderSearch lives on this div now, not the <form>, so it stays the
    // flex item .desktopTopHeaderSearchCenter's CSS expects to size/center/
    // grow-on-focus (see that rule's comment) — this wrapper used to just be
    // the form itself before the dropdown needed a positioning context an
    // inline form element can't provide.
    <div ref={containerRef} className="siteHeaderSearch" style={{ position: "relative" }}>
      <form action="/search" method="GET" role="search">
        <div className="searchFieldWrap">
          {isLoading ? (
            <LoaderCircle className="searchFieldIcon searchFieldSpinner" size={16} aria-hidden="true" />
          ) : (
            <Search className="searchFieldIcon" size={16} aria-hidden="true" />
          )}
          <input
            type="search"
            name="q"
            value={query}
            onChange={handleChange}
            onFocus={() => trimmedQuery.length > 0 && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search…"
            aria-label="Search"
            className="textInput"
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-haspopup="listbox"
          />
        </div>
      </form>

      {showDropdown && (
        <div id={listboxId} role="listbox" className="previewMenuList searchSuggestDropdown">
          {!isLoading && !hasResults && <p className="mutedText searchSuggestEmpty">No matches for &ldquo;{trimmedQuery}&rdquo;.</p>}
          {suggestions.users.map((u) => (
            <Link key={`user-${u.handle}`} href={`/${u.handle}`} role="option" className="profileLinkItem" onClick={() => setIsOpen(false)}>
              {u.displayName}
              {u.isVerified && (
                <span className="verifiedBadge" title="Verified" aria-label="Verified">
                  <BadgeCheck size={14} aria-hidden="true" />
                </span>
              )}
              <span className="mutedText" style={{ marginLeft: "0.5rem" }}>
                <span className="brandUrl">0dot.in</span>/{u.handle}
              </span>
            </Link>
          ))}
          {suggestions.posts.map((post) =>
            post.handle ? (
              <Link
                key={`post-${post.id}`}
                href={`/${post.handle}#post-${post.id}`}
                role="option"
                className="profileLinkItem"
                style={{ flexDirection: "column", alignItems: "stretch", gap: "0.2rem" }}
                onClick={() => setIsOpen(false)}
              >
                <span className="mutedText" style={{ fontSize: "0.85rem" }}>
                  {post.displayName}
                  {post.isVerified && (
                    <span className="verifiedBadge" title="Verified" aria-label="Verified">
                      <BadgeCheck size={14} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span>{post.snippet}</span>
              </Link>
            ) : null
          )}
          {hasResults && (
            <Link href={`/search?q=${encodeURIComponent(trimmedQuery)}`} className="previewMenuFooter" onClick={() => setIsOpen(false)}>
              See all results for &ldquo;{trimmedQuery}&rdquo;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
