"use client";

import { useActionState, useState } from "react";
import { createBook, updateBook } from "@/app/actions/books";
import { suggestBookDescription } from "@/app/actions/ai-content";
import { AISuggestButton } from "@/components/AISuggestButton";
import { ImagePickerField } from "@/components/ImagePickerField";
import { MarkdownField } from "@/components/MarkdownField";

type BookFormBook = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  visibility: string;
  coverImageUrl: string | null;
};

export function BookForm({ book }: { book?: BookFormBook }) {
  const action = book ? updateBook : createBook;
  const [state, formAction, pending] = useActionState(action, undefined);
  const idSuffix = book?.id ?? "new";
  const [descriptionValue, setDescriptionValue] = useState(book?.description ?? "");

  return (
    <form action={formAction} className="settingsForm" encType="multipart/form-data">
      {book && <input type="hidden" name="bookId" value={book.id} />}
      {!book && (
        <div className="field">
          <label htmlFor={`bookSlug-${idSuffix}`}>Slug (0dot.in/you/books/…)</label>
          <input id={`bookSlug-${idSuffix}`} name="slug" maxLength={80} required pattern="[a-z0-9_]{3,80}" />
        </div>
      )}
      <div className="field">
        <label htmlFor={`bookTitle-${idSuffix}`}>Title</label>
        <input id={`bookTitle-${idSuffix}`} name="title" defaultValue={book?.title} maxLength={200} required />
      </div>
      <MarkdownField
        id={`bookDescription-${idSuffix}`}
        name="description"
        label="Description"
        value={descriptionValue}
        onChange={setDescriptionValue}
        rows={4}
        maxLength={2000}
      />
      <AISuggestButton
        label="AI: Suggest a description"
        contextLabel="What's this book about? (optional)"
        contextPlaceholder="e.g. a beginner's guide to sourdough"
        generate={suggestBookDescription}
        onInsert={setDescriptionValue}
      />
      <div className="fieldRow">
        <ImagePickerField
          id={`bookCover-${idSuffix}`}
          name="coverImage"
          label="Cover image"
          mode="single"
          initialUrls={book?.coverImageUrl ? [book.coverImageUrl] : []}
        />
        <div className="field">
          <label htmlFor={`bookEbook-${idSuffix}`}>Ebook file (PDF/EPUB)</label>
          <input id={`bookEbook-${idSuffix}`} name="ebookFile" type="file" accept="application/pdf,application/epub+zip" />
        </div>
      </div>
      <div className="fieldRow">
        <div className="field">
          <label htmlFor={`bookStatus-${idSuffix}`}>Status</label>
          <select id={`bookStatus-${idSuffix}`} name="status" defaultValue={book?.status ?? "draft"} className="textInput">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`bookVisibility-${idSuffix}`}>Visibility</label>
          <select id={`bookVisibility-${idSuffix}`} name="visibility" defaultValue={book?.visibility ?? "public"} className="textInput">
            <option value="public">Public</option>
            <option value="unlisted">Unlisted (direct link only)</option>
            <option value="private">Private (only you)</option>
          </select>
        </div>
      </div>

      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Saving…" : book ? "Save changes" : "Create book"}
      </button>
    </form>
  );
}
