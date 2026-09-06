"use client";

import { useState } from "react";
import { recordAISuggestionDecision, type AISuggestionResult } from "@/app/actions/ai-content";

// Sibling to AISuggestButton for the one shape it doesn't fit: a suggestion
// that's a *list* to pick from (skill names), not one text blob to insert
// into an existing field. Same generate/rate-limit/log plumbing
// (ai-content.ts), but each item is its own chip — clicking one calls
// `onPick` (the real addSkill server action) directly instead of writing
// into a textarea. `accepted` on the AI generation record reflects whether
// *any* chip was ever clicked, same "accepted means real use" posture
// AISuggestButton already established for Insert/Discard.
export function AISuggestChipsButton({
  label,
  generate,
  onPick,
}: {
  label: string;
  generate: () => Promise<AISuggestionResult>;
  onPick: (item: string) => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ generationId: string; items: string[] } | null>(null);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  async function handleGenerate() {
    setPending(true);
    setError(null);
    const result = await generate();
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const items = Array.from(
      new Set(
        result.text
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    setSuggestion({ generationId: result.generationId, items });
    setAddedItems(new Set());
  }

  async function handlePick(item: string) {
    setAddedItems((prev) => new Set(prev).add(item));
    await onPick(item);
  }

  async function handleClose() {
    if (suggestion) await recordAISuggestionDecision(suggestion.generationId, addedItems.size > 0);
    setSuggestion(null);
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="button buttonSecondary buttonSmall"
        onClick={() => {
          setOpen(true);
          void handleGenerate();
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="field" style={{ border: "1px solid var(--border, #333)", borderRadius: 8, padding: "0.6rem" }}>
      {pending && <p className="mutedText">Thinking…</p>}
      {error && <p className="errorText">{error}</p>}
      {suggestion && suggestion.items.length === 0 && <p className="mutedText">No suggestions this time.</p>}
      {suggestion && suggestion.items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {suggestion.items.map((item) => (
            <button
              key={item}
              type="button"
              className="button buttonSecondary buttonSmall"
              disabled={addedItems.has(item)}
              onClick={() => handlePick(item)}
            >
              {addedItems.has(item) ? `✓ ${item}` : `+ ${item}`}
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: "0.5rem" }}>
        <button type="button" className="button buttonSecondary buttonSmall" onClick={handleClose}>
          Close
        </button>
      </div>
    </div>
  );
}
