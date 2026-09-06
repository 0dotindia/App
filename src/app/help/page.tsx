import type { Metadata } from "next";
import { renderWikiMarkdown } from "@/lib/wiki-markdown";
import { loadHelpGuide } from "@/lib/help-content";

export const metadata: Metadata = {
  title: "Help",
  description: "Everything 0dot can do — profile, posting, communities, monetization, wallet, and more.",
};

// Not in route-context.ts's CHROMELESS_PATHS: unlike /about and /download
// (anonymous-only marketing pages with their own MarketingNav), this page is
// read by both signed-in users looking up a feature and prospects arriving
// from the marketing footer while signed out — the same "everyone, session
// state varies" audience /dmca and /trust-safety already serve inside the
// normal SiteHeader/Sidebar shell (SiteHeader itself renders a graceful
// anonymous state, same as /explore). Rendering MarketingNav here too, on
// top of that shell, was a double-header bug — see git history.
export default async function HelpPage() {
  const { title, body } = await loadHelpGuide();

  return (
    <div className="profileCard">
      <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.75rem" }}>{title}</h1>
      {renderWikiMarkdown(body)}
    </div>
  );
}
