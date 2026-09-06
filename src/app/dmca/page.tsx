import type { Metadata } from "next";
import Link from "next/link";
import { DmcaNoticeForm } from "./DmcaNoticeForm";

export const metadata: Metadata = { title: "DMCA notice" };

// TODO(legal): replace with the actual designated agent registered with
// the US Copyright Office (https://dmca.copyright.gov/osp/) — 17 U.S.C. §
// 512(c)(2) requires that registration, and requires this contact info to
// be publicly posted, for the site to keep safe-harbor protection at all.
const DESIGNATED_AGENT = {
  name: "[Designated Agent name]",
  email: "[dmca@yourdomain — create this mailbox before shipping]",
  address: "[Street address, City, State, ZIP, Country]",
};

// phase-13 spec §4.4: the heavier, statute-shaped formal notice, distinct
// from the lightweight Report(category=ip_infringement) flag every
// ReportButton already offers. Deliberately open to anyone, no account
// required — most real-world complainants have no 0dot account, and 17
// U.S.C. § 512(c)(3) doesn't get to assume they do. (Filing a
// counter-notice is different: the statute ties it to actually owning the
// removed content, which this codebase can only verify for a logged-in
// account — see /trust-safety.)
export default function DmcaPage() {
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
