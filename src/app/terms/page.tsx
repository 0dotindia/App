import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/components/marketing/LegalDocument";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using 0dot.in.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Who can use 0dot",
    body: (
      <p>
        You must be at least 13 years old. If you are under 18, you confirm that a parent or guardian permits you to use
        0dot. You must give accurate details when you sign up and keep your login secure. You are responsible for
        activity on your account.
      </p>
    ),
  },
  {
    heading: "Your account and username",
    body: (
      <p>
        Your username is your permanent address at <span className="brandUrl">0dot.in</span>/username. You may not
        impersonate a person or business, squat names to resell them, or claim a name to mislead others. We may reclaim
        or suspend a username that breaks these rules.
      </p>
    ),
  },
  {
    heading: "Your content",
    body: (
      <p>
        You own what you post. You give 0dot a worldwide, non-exclusive licence to host, display and deliver it so the
        service works — for example, showing your post to your followers. The licence ends when you delete the content
        or your account, except for copies that already exist in backups or that others have shared.
      </p>
    ),
  },
  {
    heading: "What you may not do",
    body: (
      <ul>
        <li>Post illegal content, or content that infringes someone else&rsquo;s rights.</li>
        <li>Harass, threaten or exploit others, or post sexual content involving minors.</li>
        <li>Send spam, run scams, or try to gain unauthorised access to accounts or systems.</li>
        <li>Scrape, overload or interfere with the service, or bypass its limits.</li>
      </ul>
    ),
  },
  {
    heading: "Payments, memberships and fees",
    body: (
      <p>
        Paid features — memberships, digital products, courses, tips and the wallet — are processed by our payment
        provider. Prices and any platform fee are shown before you pay. Refunds follow the policy the seller states at
        checkout, and where the law gives you a right to a refund, that right stays.
      </p>
    ),
  },
  {
    heading: "Reporting and removal",
    body: (
      <p>
        You can report content from the report button on any post or profile. We review reports and may remove content
        or restrict accounts that break these terms. See <Link href="/trust-safety">Trust &amp; Safety</Link> for how
        moderation decisions and appeals work.
      </p>
    ),
  },
  {
    heading: "Ending your account",
    body: (
      <p>
        You can export your data and delete your account from your account settings. We may suspend or end accounts that
        break these terms or put others at risk.
      </p>
    ),
  },
  {
    heading: "Availability and liability",
    body: (
      <p>
        We work to keep 0dot fast and reliable, but the service is provided &ldquo;as is&rdquo;, without a promise that
        it will always be available or error-free. To the extent the law allows, 0dot is not liable for indirect or
        consequential losses, and our total liability to you is limited to the amount you paid us in the 12 months before
        the claim.
      </p>
    ),
  },
  {
    heading: "Changes and governing law",
    body: (
      <p>
        We may update these terms and will post the new date above; if a change is significant we will tell you in the
        app. Continuing to use 0dot after a change means you accept it. These terms are governed by the laws of India,
        and the courts of India have jurisdiction, unless your local consumer law says otherwise.
      </p>
    ),
  },
  {
    heading: "Contact",
    body: (
      <p>
        Questions about these terms? See <Link href="/help">Help</Link>. How we handle your data is described in the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      updated="24 September 2026"
      intro="By creating an account or using 0dot.in you agree to these terms. If you don't agree, please don't use the service."
      sections={SECTIONS}
    />
  );
}
