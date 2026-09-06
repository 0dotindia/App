"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createForm, type FormFieldDef } from "@/app/actions/forms";
import { suggestFormDescription } from "@/app/actions/ai-content";
import { AISuggestButton } from "@/components/AISuggestButton";
import { MarkdownField } from "@/components/MarkdownField";

type DraftField = FormFieldDef & { optionsText?: string };

const EMPTY_FIELD: DraftField = { label: "", type: "text", required: false };

export function FormBuilder() {
  const [state, formAction, pending] = useActionState(createForm, undefined);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [fields, setFields] = useState<DraftField[]>([{ ...EMPTY_FIELD }]);

  function updateField(index: number, patch: Partial<DraftField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function moveField(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  }

  const fieldsJson = JSON.stringify(
    fields
      .filter((f) => f.label.trim().length > 0)
      .map((f) => ({
        label: f.label,
        type: f.type,
        required: f.required,
        description: f.description,
        options: f.type === "choice" ? (f.optionsText ?? "").split(",").map((o) => o.trim()).filter(Boolean) : undefined,
      }))
  );

  return (
    <form action={formAction} className="settingsForm">
      <div>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required maxLength={160} className="textInput" />
      </div>

      <MarkdownField
        id="formDescription"
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

      <div>
        <label htmlFor="mode">Mode</label>
        <select id="mode" name="mode" defaultValue="form" className="textInput">
          <option value="form">Form</option>
          <option value="survey">Survey</option>
        </select>
      </div>

      <p className="sectionHeading">Fields</p>
      {fields.map((field, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", gap: "0.3rem", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Field label"
              value={field.label}
              onChange={(e) => updateField(index, { label: e.target.value })}
              className="textInput"
              style={{ flex: "2 1 140px" }}
            />
            <select value={field.type} onChange={(e) => updateField(index, { type: e.target.value })} className="textInput" style={{ flex: "1 1 100px" }}>
              <option value="text">Text</option>
              <option value="choice">Choice</option>
              <option value="rating">Rating</option>
              <option value="date">Date</option>
            </select>
            {field.type === "choice" && (
              <input
                placeholder="Options, comma-separated"
                value={field.optionsText ?? ""}
                onChange={(e) => updateField(index, { optionsText: e.target.value })}
                className="textInput"
                style={{ flex: "2 1 160px" }}
              />
            )}
            <label style={{ display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />
              Required
            </label>
          </div>
          <input
            placeholder="Help text shown under this field (optional)"
            value={field.description ?? ""}
            onChange={(e) => updateField(index, { description: e.target.value })}
            maxLength={300}
            className="textInput"
          />
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button
              type="button"
              className="button buttonSecondary iconButton"
              onClick={() => moveField(index, "up")}
              disabled={index === 0}
              aria-label="Move field up"
            >
              <ChevronUp size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button buttonSecondary iconButton"
              onClick={() => moveField(index, "down")}
              disabled={index === fields.length - 1}
              aria-label="Move field down"
            >
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <button type="button" className="button buttonSecondary buttonSmall" onClick={() => setFields((prev) => prev.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="button buttonSecondary buttonSmall" style={{ alignSelf: "flex-start" }} onClick={() => setFields((prev) => [...prev, { ...EMPTY_FIELD }])}>
        + Add field
      </button>

      <input type="hidden" name="fieldsJson" value={fieldsJson} />
      <button type="submit" className="button" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Creating…" : "Create"}
      </button>
      {state?.error && <p className="errorText">{state.error}</p>}
    </form>
  );
}
