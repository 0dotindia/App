"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getEffectiveTheme, persistTheme } from "@/lib/browser-tab";
import { useBrowserTab } from "@/components/BrowserTabProvider";

export function ThemeToggleLogo({
  size = 32,
  priority = true,
  interactive = true,
  href,
  className,
}: {
  size?: number;
  priority?: boolean;
  interactive?: boolean;
  // MarketingNav/FrontPageNav want the logo to both go home and toggle the
  // theme. Nesting a <button> inside their own <Link href="/"> is invalid
  // HTML (Lighthouse/axe flag it as a broken touch target — the anchor's
  // clickable box collapses to a few stray px around the button), so
  // instead pass href here: renders a single <Link>, with the theme toggle
  // wired to the same click, and takes precedence over `interactive`.
  href?: string;
  className?: string;
}) {
  const { setTheme } = useBrowserTab();
  const pathname = usePathname();

  const handleClick = (e: React.MouseEvent) => {
    const next = getEffectiveTheme() === "light" ? "dark" : "light";
    // Always safe synchronously: a plain attribute write on <html>/
    // localStorage, outside anything React or the Next router manages.
    // This alone flips the page's whole visual theme (CSS keys off
    // data-theme) — setTheme below is secondary, favicon-only state.
    persistTheme(next);

    if (href && pathname !== href) {
      // Cross-route click (e.g. MarketingNav's logo on /about): calling
      // setTheme here raced the Link's in-flight App Router transition and
      // crashed React's committer (verified live — "Cannot read properties
      // of null (reading 'removeChild')" — even with the call deferred a
      // macrotask, since the RSC fetch can outlast one). BrowserTabProvider
      // resyncs its own theme state from the DOM once pathname actually
      // changes, so skip it here rather than guess a delay.
      return;
    }
    // Same-page (href === pathname, or no href at all): no pending
    // navigation to race, so update the favicon-driving state immediately.
    setTheme(next);
    if (href) {
      // Already home — Link soft-navigating to the current route is a
      // pure no-op (same RSC tree), just costs an unnecessary fetch.
      e.preventDefault();
    }
  };

  const images = (
    <>
      <Image
        src="/1dot.png"
        alt="0dot"
        width={size}
        height={size}
        className="themeLogoLight"
        priority={priority}
      />
      <Image
        src="/0dot.png"
        alt="0dot"
        width={size}
        height={size}
        className="themeLogoDark"
        priority={priority}
      />
    </>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false} onClick={handleClick} className={className} aria-label="0dot home">
        {images}
      </Link>
    );
  }

  if (!interactive) {
    return <span style={{ display: "inline-flex", alignItems: "center" }}>{images}</span>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Toggle dark/light theme"
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {images}
    </button>
  );
}
