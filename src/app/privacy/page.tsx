import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/components/marketing/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What 0dot.in collects, why, and the controls you have.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "What we collect",
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> name, username, email, mobile number, date of birth and a hashed password.
        </li>
        <li>
          <strong>What you add:</strong> your profile, posts, links, messages, uploads, and content you sell or buy.
        </li>
        <li>
          <strong>Payments:</strong> handled by Stripe. We keep order and payout records, not your card number.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, device and browser type, and login history, used for security and
          to keep the service running.
        </li>
      </ul>
    ),
  },
  {
    heading: "Why we use it",
    body: (
      <p>
        To run your account and profile, deliver messages and notifications, process payments, protect the service from
        abuse, and meet legal obligations. Our aim is for your identity data to be yours: we don&rsquo;t sell it, and we
        don&rsquo;t run ad-targeting on it.
      </p>
    ),
  },
  {
    heading: "What is public",
    body: (
      <p>
        Your profile and posts are public unless you set them private. Fields start at the most private reasonable
        setting and you choose what to show. Direct messages are encrypted at rest.
      </p>
    ),
  },
  {
    heading: "Who we share it with",
    body: (
      <p>
        Only service providers that run 0dot for us — hosting (Vercel), database (Turso), file storage (Vercel Blob),
        email (Resend), payments (Stripe), live video and voice (LiveKit), error monitoring (Sentry) and, when you use AI
        tools, an AI model provider. We also disclose data when the law requires it or to protect people from harm.
      </p>
    ),
  },
  {
    heading: "Cookies",
    body: (
      <p>
        We use cookies that are needed to keep you signed in and secure. We don&rsquo;t use advertising cookies.
      </p>
    ),
  },
  {
    heading: "How long we keep it",
    body: (
      <p>
        We keep your data while your account is active. When you delete your account it is scheduled for erasure and then
        removed, except records we must keep by law (such as payment records) and short-lived backups.
      </p>
    ),
  },
  {
    heading: "Your choices and rights",
    body: (
      <p>
        You can view and edit your details, export your data, change your privacy settings and delete your account from
        your account settings. You may also ask us to correct or erase your data, or withdraw consent, under applicable
        law, including India&rsquo;s Digital Personal Data Protection Act, 2023.
      </p>
    ),
  },
  {
    heading: "Children",
    body: (
      <p>
        0dot is not for children under 13. If you are under 18, a parent or guardian must permit you to use it. If you
        believe a child has signed up without permission, report it and we will remove the account.
      </p>
    ),
  },
  {
    heading: "Security",
    body: (
      <p>
        We use encryption in transit, encrypted message storage, hashed passwords and rate limiting. No system is
        perfectly secure, so please use a strong, unique password.
      </p>
    ),
  },
  {
    heading: "Changes and contact",
    body: (
      <p>
        We will post updates here with a new date. For questions or to exercise your rights, see{" "}
        <Link href="/help">Help</Link>. Our rules of use are in the <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated="24 September 2026"
      intro="This explains what 0dot.in collects, why, and the controls you have over it."
      sections={SECTIONS}
    />
  );
}
