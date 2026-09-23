import type { Metadata } from "next";
import Link from "next/link";
import { DmcaNoticeForm } from "./DmcaNoticeForm";

export const metadata: Metadata = { title: "DMCA notice" };

// 17 U.S.C. § 512(c)(2) requires a designated agent (registered with the US
// Copyright Office, https://dmca.copyright.gov/osp/) and requires this exact
// contact info to be publicly posted, for the site to keep safe-harbor
// protection at all. Sourced from env rather than hardcoded so a missing
// value fails loudly (this page throws instead of silently shipping
// placeholder text as if it were real legal contact info).
function requireDmcaAgentEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — the DMCA designated-agent contact (17 U.S.C. § 512(c)(2)) must be configured before this page can render.`
    );
  }
  return value;
}

// phase-13 spec §4.4: the heavier, statute-shaped formal notice, distinct
// from the lightweight Report(category=ip_infringement) flag every
// ReportButton already offers. Deliberately open to anyone, no account
// required — most real-world complainants have no 0dot account, and 17
// U.S.C. § 512(c)(3) doesn't get to assume they do. (Filing a
// counter-notice is different: the statute ties it to actually owning the
// removed content, which this codebase can only verify for a logged-in
// account — see /trust-safety.)
export default function DmcaPage() {
  const DESIGNATED_AGENT = {
    name: requireDmcaAgentEnv("DMCA_AGENT_NAME"),
    email: requireDmcaAgentEnv("DMCA_AGENT_EMAIL"),
    address: requireDmcaAgentEnv("DMCA_AGENT_ADDRESS"),
  };

  return (
    <div className="dmcaPage stack-lg">
      <div className="card section">
        <span className="eyebrow">Copyright</span>
        <h1 className="text-lg">File a DMCA takedown notice</h1>
        <p className="mutedText">
          If you&apos;re a copyright owner (or authorized to act on their behalf) and believe content on 0dot
          infringes your copyright, use the form below to request its removal. You don&apos;t need a 0dot account
          to file a notice.
        </p>
        <p className="mutedText">
          If you were notified that your <em>own</em> content was removed and believe that was a mistake, file a
          counter-notice instead from <Link href="/trust-safety">your Trust &amp; Safety page</Link> (this does
          require signing in, so we can verify you&apos;re the content&apos;s owner).
        </p>
      </div>

      <div className="card stack-sm">
        <h2 className="text-base">Designated DMCA agent</h2>
        <p className="mutedText text-sm">
          You can also send a notice directly to our designated agent instead of using the form:
        </p>
        <p className="dmcaAgentAddress">
          {DESIGNATED_AGENT.name}
          <br />
          {DESIGNATED_AGENT.address}
          <br />
          {DESIGNATED_AGENT.email}
        </p>
      </div>

      <DmcaNoticeForm />
    </div>
  );
}
