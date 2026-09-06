"use client";

import { useActionState, useState } from "react";
import { updateFormDescription } from "@/app/actions/forms";
import { suggestFormDescription } from "@/app/actions/ai-content";
import { AISuggestButton } from "@/components/AISuggestButton";
import { MarkdownField } from "@/components/MarkdownField";

// The only editable field on an existing form — see updateFormDescription's
// own comment for why title/fields stay locked (responses are keyed by
// field label).
export function EditFormDescriptionForm({ formId, description }: { formId: string; description: string }) {
  const [state, formAction, pending] = useActionState(updateFormDescription, undefined);
  const [descriptionValue, setDescriptionValue] = useState(description);

  return (
    <form action={formAction} className="settingsForm">
      <input type="hidden" name="formId" value={formId} />
      <MarkdownField
        id={`formDescription-${formId}`}
        name="description"
        label="Description (shown to respondents)"
        value={descriptionValue}
        onChange={setDescriptionValue}
        maxLength={1000}
        rows={2}
      />
      <AISuggestButton
        label="AI: Suggest an intro"
        contextLabel="What's this form/survey about? (optional)"
        contextPlaceholder="e.g. customer feedback after a purchase"
        generate={suggestFormDescription}
        onInsert={setDescriptionValue}
      />
      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button buttonSmall" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
