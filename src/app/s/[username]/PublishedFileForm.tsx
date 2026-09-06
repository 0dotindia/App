"use client";

import { useActionState, useState } from "react";
import { createPublishedFile, updatePublishedFile } from "@/app/actions/published-files";
import { suggestFileDescription } from "@/app/actions/ai-content";
import { AISuggestButton } from "@/components/AISuggestButton";
import { ImagePickerField } from "@/components/ImagePickerField";
import { MarkdownField } from "@/components/MarkdownField";

type PublishedFileFormFile = {
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: string;
  coverImageUrl: string | null;
};

export function PublishedFileForm({ file }: { file?: PublishedFileFormFile }) {
  const action = file ? updatePublishedFile : createPublishedFile;
  const [state, formAction, pending] = useActionState(action, undefined);
  const idSuffix = file?.id ?? "new";
  const [descriptionValue, setDescriptionValue] = useState(file?.description ?? "");

  return (
    <form action={formAction} className="settingsForm" encType="multipart/form-data">
      {file && <input type="hidden" name="fileId" value={file.id} />}
      {!file && (
        <div className="field">
          <label htmlFor={`fileSlug-${idSuffix}`}>Slug (0dot.in/you/files/…)</label>
          <input id={`fileSlug-${idSuffix}`} name="slug" maxLength={80} required pattern="[a-z0-9_]{3,80}" />
        </div>
      )}
      <div className="field">
        <label htmlFor={`fileTitle-${idSuffix}`}>Title</label>
        <input id={`fileTitle-${idSuffix}`} name="title" defaultValue={file?.title} maxLength={200} required />
      </div>
      <MarkdownField
        id={`fileDescription-${idSuffix}`}
        name="description"
        label="Description"
        value={descriptionValue}
        onChange={setDescriptionValue}
        rows={4}
        maxLength={2000}
      />
      <AISuggestButton
        label="AI: Suggest a description"
        contextLabel="What's this file? (optional)"
        contextPlaceholder="e.g. a printable budgeting worksheet"
        generate={suggestFileDescription}
        onInsert={setDescriptionValue}
      />
      <div className="fieldRow">
        <ImagePickerField
          id={`fileCover-${idSuffix}`}
          name="coverImage"
          label="Cover image"
          mode="single"
          initialUrls={file?.coverImageUrl ? [file.coverImageUrl] : []}
        />
        <div className="field">
          <label htmlFor={`filePdf-${idSuffix}`}>PDF{file ? " (leave blank to keep current)" : ""}</label>
          <input id={`filePdf-${idSuffix}`} name="file" type="file" accept="application/pdf" required={!file} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`fileVisibility-${idSuffix}`}>Visibility</label>
        <select id={`fileVisibility-${idSuffix}`} name="visibility" defaultValue={file?.visibility ?? "public"} className="textInput">
          <option value="public">Public</option>
          <option value="unlisted">Unlisted (direct link only)</option>
          <option value="private">Private (only you)</option>
        </select>
      </div>

      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Saving…" : file ? "Save changes" : "Publish file"}
      </button>
    </form>
  );
}
