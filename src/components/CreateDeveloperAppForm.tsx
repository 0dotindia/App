"use client";

import { useActionState, useState } from "react";
import { createDeveloperApp } from "@/app/actions/developer-apps";
import { suggestDeveloperAppDescription } from "@/app/actions/ai-content";
import { AISuggestButton } from "@/components/AISuggestButton";
import { ImagePickerField } from "@/components/ImagePickerField";

export function CreateDeveloperAppForm({ businesses }: { businesses: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createDeveloperApp, undefined);
  const [descriptionValue, setDescriptionValue] = useState("");

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "40ch" }} encType="multipart/form-data">
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required maxLength={100} className="textInput" />
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
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
      <ImagePickerField id="appLogo" name="logo" label="Logo (shown on the consent screen)" mode="single" initialUrls={[]} />
      <div className="field">
        <label htmlFor="ownerType">Owned by</label>
        <select id="ownerType" name="ownerType" defaultValue="user" className="textInput">
          <option value="user">You</option>
          {businesses.length > 0 && <option value="business">A business you own</option>}
        </select>
      </div>
      {businesses.length > 0 && (
        <div className="field">
          <label htmlFor="ownerBusinessId">Business</label>
          <select id="ownerBusinessId" name="ownerBusinessId" defaultValue="" className="textInput">
            <option value="">—</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="redirectUris">Redirect URIs (one per line)</label>
        <textarea id="redirectUris" name="redirectUris" required className="textInput" rows={3} placeholder="https://example.com/oauth/callback" />
      </div>
      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button buttonSmall" style={{ alignSelf: "flex-start" }} disabled={pending}>
        {pending ? "Registering…" : "Register app"}
      </button>
    </form>
  );
}
