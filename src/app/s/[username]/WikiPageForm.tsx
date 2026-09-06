"use client";

import { useActionState, useState } from "react";
import { createProfileWikiPage, updateProfileWikiPage } from "@/app/actions/knowledge-pages";
import { suggestWikiPageDraft } from "@/app/actions/ai-content";
import { AISuggestButton } from "@/components/AISuggestButton";
import { MarkdownField } from "@/components/MarkdownField";

type WikiPageFormPage = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  body: string;
  visibility: string;
  parentPageId: string | null;
};

// Mirrors ArticleForm.tsx: branch on the presence of the entity prop to
// pick create vs. update. `otherPages` feeds the parent-page select — a
// page can't be its own parent (enforced server-side too, see
// knowledge-pages.ts) so it's excluded from the option list when editing.
// Reordering among siblings happens via the up/down buttons on the list
// page (moveWikiPage) — this form no longer collects a raw position number.
export function WikiPageForm({ page, otherPages }: { page?: WikiPageFormPage; otherPages: { id: string; title: string }[] }) {
  const action = page ? updateProfileWikiPage : createProfileWikiPage;
  const [state, formAction, pending] = useActionState(action, undefined);
  const idSuffix = page?.id ?? "new";
  const [bodyValue, setBodyValue] = useState(page?.body ?? "");

  return (
    <form action={formAction} className="settingsForm">
      {page && <input type="hidden" name="pageId" value={page.id} />}
      {!page && (
        <div className="field">
          <label htmlFor={`wikiSlug-${idSuffix}`}>Slug (0dot.in/you/wiki/…)</label>
          <input id={`wikiSlug-${idSuffix}`} name="slug" maxLength={60} required pattern="[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?" />
        </div>
      )}
      <div className="field">
        <label htmlFor={`wikiTitle-${idSuffix}`}>Title</label>
        <input id={`wikiTitle-${idSuffix}`} name="title" defaultValue={page?.title} maxLength={120} required />
      </div>
      <MarkdownField
        id={`wikiBody-${idSuffix}`}
        name="body"
        label="Content"
        value={bodyValue}
        onChange={setBodyValue}
        rows={10}
      />
      <AISuggestButton
        label="AI: Draft this page"
        contextLabel="Topic or working title"
        contextPlaceholder="e.g. Getting started guide"
        generate={suggestWikiPageDraft}
        onInsert={(text) => setBodyValue((current) => (current.trim().length > 0 ? `${current}\n\n${text}` : text))}
      />
      <div className="fieldRow">
        <div className="field">
          <label htmlFor={`wikiKind-${idSuffix}`}>Kind</label>
          <select id={`wikiKind-${idSuffix}`} name="kind" defaultValue={page?.kind ?? "wiki"} className="textInput">
            <option value="wiki">Wiki page</option>
            <option value="documentation">Documentation</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`wikiVisibility-${idSuffix}`}>Visibility</label>
          <select id={`wikiVisibility-${idSuffix}`} name="visibility" defaultValue={page?.visibility ?? "public"} className="textInput">
            <option value="public">Public</option>
            <option value="unlisted">Unlisted (direct link only)</option>
            <option value="private">Private (only you)</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`wikiParent-${idSuffix}`}>Parent page</label>
        <select id={`wikiParent-${idSuffix}`} name="parentPageId" defaultValue={page?.parentPageId ?? ""} className="textInput">
          <option value="">None (top-level)</option>
          {otherPages.filter((p) => p.id !== page?.id).map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Saving…" : page ? "Save changes" : "Create page"}
      </button>
    </form>
  );
}
