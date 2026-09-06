"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

// A generic "pick some items, in order" field — the ordered-list equivalent
// of ImagePickerField, for referencing existing records (e.g. a learning
// path's courses) rather than uploading files. Selected items render as a
// list with up/down + remove (the same reorder convention every other list
// in this codebase uses, not drag-and-drop), each backed by a
// <input type="hidden" name={name} value={id}> in list order — since these
// are emitted in the exact order this component maintains, a plain
// `formData.getAll(name)` on submit already returns them in that order, no
// server-side change needed. An "Add" row (a <select> of not-yet-picked
// options + button) appends to the end.
export function OrderedPicker({
  name,
  options,
  initialSelectedIds,
}: {
  name: string;
  options: { id: string; label: string }[];
  initialSelectedIds: string[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [pendingAddId, setPendingAddId] = useState("");

  const labelById = new Map(options.map((o) => [o.id, o.label]));
  const availableOptions = options.filter((o) => !selectedIds.includes(o.id));

  function moveItem(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= selectedIds.length) return;
    setSelectedIds((prev) => {
      const next = [...prev];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  }

  function removeItem(id: string) {
    setSelectedIds((prev) => prev.filter((i) => i !== id));
  }

  function addItem() {
    if (!pendingAddId) return;
    setSelectedIds((prev) => [...prev, pendingAddId]);
    setPendingAddId("");
  }

  return (
    <div className="field">
      {selectedIds.length > 0 && (
        <div className="settingsGroup">
          {selectedIds.map((id, index) => (
            <div key={id} className="settingsRow">
              <span className="settingsRowText">
                <span className="settingsRowLabel">{labelById.get(id) ?? id}</span>
              </span>
              <span className="settingsRowTrailing">
                <button
                  type="button"
                  className="button buttonSecondary iconButton"
                  onClick={() => moveItem(index, "up")}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <ChevronUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="button buttonSecondary iconButton"
                  onClick={() => moveItem(index, "down")}
                  disabled={index === selectedIds.length - 1}
                  aria-label="Move down"
                >
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="button buttonSecondary iconButton"
                  onClick={() => removeItem(id)}
                  aria-label="Remove"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </span>
              <input type="hidden" name={name} value={id} />
            </div>
          ))}
        </div>
      )}

      {availableOptions.length > 0 && (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <select
            value={pendingAddId}
            onChange={(e) => setPendingAddId(e.target.value)}
            className="textInput"
            style={{ flex: 1 }}
          >
            <option value="">Choose a course to add…</option>
            {availableOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <button type="button" className="button buttonSecondary buttonSmall" onClick={addItem} disabled={!pendingAddId}>
            <Plus size={14} aria-hidden="true" /> Add
          </button>
        </div>
      )}
    </div>
  );
}
