"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Link2, List } from "lucide-react";
import { renderWikiMarkdown } from "@/lib/wiki-markdown";

// A .field textarea plus a small formatting toolbar and a Write/Preview
// toggle — not a WYSIWYG editor. This codebase deliberately has no
// markdown/rich-text-editor dependency (see wiki-markdown.tsx's own
// comment: hand-rolled subset, "matching this codebase's no new dependency
// posture"), so Preview renders through that exact same renderWikiMarkdown
// function every reader-facing page already uses — what the owner sees
// while editing is exactly what gets published, not an approximation.
//
// The <textarea> stays mounted (only visually hidden) while Preview is
// active, not conditionally rendered — its `name` has to stay in the DOM
// for a plain form submit to pick up the value regardless of which tab is
// showing when Save is clicked.
export function MarkdownField({
  id,
  name,
  label,
  value,
  onChange,
  rows = 5,
  maxLength,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(before: string, after: string = before) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    onChange(value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
    });
  }

  function prefixLines(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const nextBreak = value.indexOf("\n", selectionEnd);
    const blockEnd = nextBreak === -1 ? value.length : nextBreak;
    const block = value.slice(lineStart, blockEnd);
    const prefixed = block
      .split("\n")
      .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
      .join("\n");
    onChange(value.slice(0, lineStart) + prefixed + value.slice(blockEnd));
    requestAnimationFrame(() => el.focus());
  }

  return (
    <div className="field">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <label htmlFor={id}>{label}</label>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            className="button buttonSecondary buttonSmall"
            aria-pressed={tab === "write"}
            onClick={() => setTab("write")}
          >
            Write
          </button>
          <button
            type="button"
            className="button buttonSecondary buttonSmall"
            aria-pressed={tab === "preview"}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </div>
      </div>

      <div style={{ display: tab === "write" ? "flex" : "none", gap: "0.25rem", marginBottom: "0.3rem" }}>
        <button type="button" className="button buttonSecondary iconButton" aria-label="Bold" onClick={() => wrapSelection("**")}>
          <Bold size={14} aria-hidden="true" />
        </button>
        <button type="button" className="button buttonSecondary iconButton" aria-label="Italic" onClick={() => wrapSelection("*")}>
          <Italic size={14} aria-hidden="true" />
        </button>
        <button type="button" className="button buttonSecondary iconButton" aria-label="Bullet list" onClick={() => prefixLines("- ")}>
          <List size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="button buttonSecondary iconButton"
          aria-label="Link"
          onClick={() => wrapSelection("[", "](https://)")}
        >
          <Link2 size={14} aria-hidden="true" />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        style={{ display: tab === "write" ? undefined : "none" }}
      />

      {tab === "preview" &&
        (value.trim() ? (
          <div className="card card--inset">{renderWikiMarkdown(value)}</div>
        ) : (
          <p className="mutedText">Nothing to preview yet.</p>
        ))}
    </div>
  );
}
