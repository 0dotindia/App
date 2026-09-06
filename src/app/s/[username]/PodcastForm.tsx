"use client";

import { useActionState, useState } from "react";
import { createPodcast, updatePodcast } from "@/app/actions/podcasts";
import { suggestPodcastShowNotes } from "@/app/actions/ai-content";
import { AISuggestButton } from "@/components/AISuggestButton";
import { ImagePickerField } from "@/components/ImagePickerField";
import { MarkdownField } from "@/components/MarkdownField";

export function PodcastForm({
  podcast,
}: {
  podcast?: { id: string; title: string; description: string; coverUrl: string | null };
}) {
  const action = podcast ? updatePodcast : createPodcast;
  const [state, formAction, pending] = useActionState(action, undefined);
  const idSuffix = podcast?.id ?? "new";
  const [descriptionValue, setDescriptionValue] = useState(podcast?.description ?? "");

  return (
    <form action={formAction} className="settingsForm" encType="multipart/form-data">
      {podcast && <input type="hidden" name="podcastId" value={podcast.id} />}
      <div className="field">
        <label htmlFor={`podcastTitle-${idSuffix}`}>Title</label>
        <input id={`podcastTitle-${idSuffix}`} name="title" defaultValue={podcast?.title} maxLength={120} required />
      </div>
      <MarkdownField
        id={`podcastDescription-${idSuffix}`}
        name="description"
        label="Description"
        value={descriptionValue}
        onChange={setDescriptionValue}
        maxLength={2000}
        rows={2}
      />
      <AISuggestButton
        label="AI: Suggest show notes"
        contextLabel="What's this podcast about? (optional)"
        contextPlaceholder="e.g. indie game development"
        generate={suggestPodcastShowNotes}
        onInsert={setDescriptionValue}
      />
      <ImagePickerField
        id={`podcastCover-${idSuffix}`}
        name="coverImage"
        label="Cover image"
        mode="single"
        initialUrls={podcast?.coverUrl ? [podcast.coverUrl] : []}
      />
      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Saving…" : podcast ? "Save changes" : "Create podcast"}
      </button>
    </form>
  );
}
