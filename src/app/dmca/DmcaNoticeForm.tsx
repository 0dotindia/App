"use client";

import { useActionState, useRef, useState } from "react";
import { fileDmcaTakedownNoticeAction } from "@/app/actions/dmca";

// "Comment" is deliberately not offered here even though lib/dmca.ts's
// resolveDmcaSubject has a branch for it — that branch only accepts a raw
// internal comment id (no comment has a public permalink anywhere on the
// site), which no real-world complainant using this anonymous form could
// ever supply. Only content types with an actual shareable URL are listed.
const SUBJECT_TYPES = [
  { value: "post", label: "Post" },
  { value: "article", label: "Article" },
  { value: "marketplace_listing", label: "Marketplace listing" },
];

const CONTENT_LOCATION_HELP: Record<string, { placeholder: string; help: string }> = {
  post: {
    placeholder: "https://0dot.in/username/status/1234567890",
    help: "Paste the URL of the specific post — click its share/copy-link option, or copy it from your browser's address bar.",
  },
  article: {
    placeholder: "https://0dot.in/username/articles/article-slug",
    help: "Paste the URL of the specific article page.",
  },
  marketplace_listing: {
    placeholder: "https://0dot.in/m/listing-id",
    help: "Paste the URL of the specific marketplace listing.",
  },
};
const DEFAULT_CONTENT_LOCATION_HELP = {
  placeholder: "https://0dot.in/…",
  help: "Select a content type above, then paste the URL of the specific content — click its share/copy-link option, or copy it from your browser's address bar.",
};

// phase-13 spec §4.1: the formal, statute-shaped notice — every field here
// maps to a specific 17 U.S.C. § 512(c)(3) requirement. The two checkboxes
// are the statutory attestations; their exact legal wording is legal's to
// draft (§9's engineering-can't-invent-this note), so the copy below is a
// plain-language placeholder pending that review.
export function DmcaNoticeForm() {
  const [state, formAction, pending] = useActionState(fileDmcaTakedownNoticeAction, undefined);
  const [submitted, setSubmitted] = useState(false);
  const [subjectType, setSubjectType] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const locationHelp = CONTENT_LOCATION_HELP[subjectType] ?? DEFAULT_CONTENT_LOCATION_HELP;

  if (submitted && !state?.error) {
    return <p className="card">Notice submitted. Trust &amp; Safety staff will review it.</p>;
  }

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await formAction(formData);
        setSubmitted(true);
      }}
      className="card stack-lg"
    >
      <div className="field">
        <label htmlFor="dmca-complainant-name">Your name</label>
        <input id="dmca-complainant-name" type="text" name="complainantName" className="textInput" required />
      </div>

      <div className="field">
        <label htmlFor="dmca-complainant-contact">Your contact information (email or address)</label>
        <input id="dmca-complainant-contact" type="text" name="complainantContact" className="textInput" required />
        <p className="mutedTextSmall">
          Disclosed to the account whose content you&apos;re reporting, if they file a counter-notice — a
          statutory requirement, not optional.
        </p>
      </div>

      <div className="field">
        <label htmlFor="dmca-work-description">Description of the copyrighted work being infringed</label>
        <textarea id="dmca-work-description" name="copyrightedWorkDescription" className="textInput" rows={3} required />
      </div>

      <div className="field">
        <label htmlFor="dmca-subject-type">Content type</label>
        <select
          id="dmca-subject-type"
          name="infringingContentSubjectType"
          className="textInput"
          required
          value={subjectType}
          onChange={(e) => setSubjectType(e.target.value)}
        >
          <option value="" disabled>
            Select one
          </option>
          {SUBJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="dmca-content-location">Link to the infringing content</label>
        <input
          id="dmca-content-location"
          type="text"
          name="infringingContentLocation"
          className="textInput"
          placeholder={locationHelp.placeholder}
          required
        />
        <p className="mutedTextSmall">{locationHelp.help}</p>
      </div>

      <label className="checkboxField">
        <input type="checkbox" name="goodFaithStatementAccepted" required />
        <span>
          I have a good faith belief that use of the material in the manner complained of is not authorized by
          the copyright owner, its agent, or the law.
        </span>
      </label>

      <label className="checkboxField">
        <input type="checkbox" name="accuracyPerjuryStatementAccepted" required />
        <span>
          Under penalty of perjury, I state that the information in this notice is accurate and that I am the
          copyright owner or authorized to act on their behalf.
        </span>
      </label>

      <div className="field">
        <label htmlFor="dmca-signature">Signature (type your full legal name)</label>
        <input id="dmca-signature" type="text" name="signature" className="textInput" required />
      </div>

      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Submitting…" : "Submit notice"}
      </button>
    </form>
  );
}
