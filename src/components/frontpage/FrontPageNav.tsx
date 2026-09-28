"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { ThemeToggleLogo } from "@/components/ThemeToggleLogo";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { BrandIcon } from "@/components/frontpage/BrandIcon";
import { LEGAL_LINKS, type SocialPlatform } from "@/lib/landing-content";

export type NavSection = { href: string; label: string };
export type NavSocial = { platform: SocialPlatform; url: string; label: string };

// The landing page's own sticky header (MarketingNav stays on /login and
// /signup). At the top of the page it's just logo + Log in / Create, like
// MarketingNav; once the big masthead nameplate (#fp-nameplate) scrolls out
// of view it condenses into a newspaper running head — small serif
// nameplate, section links and the official social icons. An
// IntersectionObserver drives that, not a scroll listener, so nothing runs
// per scroll frame. prefetch={false} throughout, same connection-burst
// reason as MarketingNav.
export function FrontPageNav({
  nameplate,
  sections,
  socials,
}: {
  nameplate: React.ReactNode;
  sections: NavSection[];
  socials: NavSocial[];
}) {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const target = document.getElementById("fp-nameplate");
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setCondensed(!entry.isIntersecting), {
      rootMargin: "-64px 0px 0px 0px",
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={condensed ? "fpNav fpNavCondensed" : "fpNav"}>
      <div className="fpNavInner">
        <Link href="/" prefetch={false} className="fpNavBrand" aria-label="0dot home">
          <ThemeToggleLogo size={30} interactive={false} />
        </Link>

        <a href="#top" className="fpNavNameplate" aria-hidden={!condensed} tabIndex={condensed ? undefined : -1}>
          {nameplate}
        </a>

        <nav className="fpNavSections" aria-label="Sections" aria-hidden={!condensed}>
          {sections.map((s) => (
            <a key={s.href} href={s.href} tabIndex={condensed ? undefined : -1}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="fpNavActions">
          <ul className="fpNavSocials" aria-label="0dot on social media" aria-hidden={!condensed}>
            {socials.map((s) => (
              <li key={s.platform}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer me"
                  aria-label={s.label}
                  title={s.label}
                  tabIndex={condensed ? undefined : -1}
                >
                  <BrandIcon platform={s.platform} size={16} />
                </a>
              </li>
            ))}
          </ul>
          <Link href="/login" prefetch={false} className="button buttonSecondary buttonSmall fpNavLogin">
            Log in
          </Link>
          <TrackedLink href="/signup" prefetch={false} className="button buttonSmall" event="nav_cta_click" eventData={{ where: "front_page" }}>
            Create your 0dot
          </TrackedLink>

          {/* Mobile menu — native <details>, same primitive as MarketingNav. */}
          <details className="fpNavMenu">
            <summary aria-label="Menu">
              <Menu size={20} aria-hidden="true" />
            </summary>
            <div className="fpNavMenuPanel">
              <nav aria-label="Sections">
                {sections.map((s) => (
                  <a key={s.href} href={s.href}>
                    {s.label}
                  </a>
                ))}
              </nav>
              <ul className="fpNavMenuSocials" aria-label="0dot on social media">
                {socials.map((s) => (
                  <li key={s.platform}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer me" aria-label={s.label}>
                      <BrandIcon platform={s.platform} size={20} />
                    </a>
                  </li>
                ))}
              </ul>
              <TrackedLink href="/signup" prefetch={false} className="button" event="nav_cta_click" eventData={{ where: "front_page_menu" }}>
                Create your 0dot
              </TrackedLink>
              <Link href="/login" prefetch={false} className="button buttonSecondary">
                Log in
              </Link>
              <nav className="fpNavMenuLegal" aria-label="About 0dot">
                {LEGAL_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} prefetch={false}>
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
