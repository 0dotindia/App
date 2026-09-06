"use client";

import { useActionState, useState } from "react";
import { updateDeveloperApp } from "@/app/actions/developer-apps";
import { suggestDeveloperAppDescription } from "@/app/actions/ai-content";
import { AISuggestButton } from "@/components/AISuggestButton";
import { ImagePickerField } from "@/components/ImagePickerField";

// The one edit path for an existing app — see updateDeveloperApp's own
// comment for why name/description/logo (display copy, safe anytime) differ
// from Forms' locked-after-creation title/fields.
export function EditDeveloperAppForm({
  appId,
  name,
  description,
  logoUrl,
}: {
  appId: string;
  name: string;
  description: string;
  logoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateDeveloperApp, undefined);
  const [descriptionValue, setDescriptionValue] = useState(description);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "40ch" }} encType="multipart/form-data">
      <input type="hidden" name="appId" value={appId} />
      <div className="field">
        <label htmlFor={`appName-${appId}`}>Name</label>
        <input id={`appName-${appId}`} name="name" defaultValue={name} required maxLength={100} className="textInput" />
      </div>
      <div className="field">
        <label htmlFor={`appDescription-${appId}`}>Description</label>
        <textarea
          id={`appDescription-${appId}`}
          name="description"
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.target.value)}
          maxLength={1000}
          className="textInput"
          rows={3}
        />
      </div>
      <AISuggestButton
        label="AI: Suggest a description"
        contextLabel="What does this app do? (optional)"
        contextPlaceholder="e.g. a Slack bot that posts new orders"
        generate={suggestDeveloperAppDescription}
        onInsert={setDescriptionValue}
      />
      <ImagePickerField
        id={`appLogo-${appId}`}
        name="logo"
        label="Logo (shown on the consent screen)"
        mode="single"
        initialUrls={logoUrl ? [logoUrl] : []}
      />
      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button buttonSmall" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
