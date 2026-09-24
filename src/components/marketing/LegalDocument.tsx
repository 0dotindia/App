import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export type LegalSection = { heading: string; body: ReactNode };

// Shared shell for the Terms and Privacy pages — same marketing chrome as
// /about, one readable prose column, numbered sections.
export function LegalDocument({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <>
      <MarketingNav />
      <main className="legalPage">
        <header className="stack">
          <span className="eyebrow">Legal</span>
          <h1 className="display-3">{title}</h1>
          <p className="mutedText">Last updated {updated}</p>
          <p>{intro}</p>
        </header>
        {sections.map((s, i) => (
          <section className="stack" key={s.heading}>
            <h2>
              {i + 1}. {s.heading}
            </h2>
            {s.body}
          </section>
        ))}
      </main>
      <MarketingFooter />
    </>
  );
}
