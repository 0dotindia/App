import { readFile } from "node:fs/promises";
import { join } from "node:path";

// content/USER_GUIDE.md is authored as a normal hand-wrapped Markdown file
// (~80-column soft wraps), unlike every other renderWikiMarkdown source in
// this codebase (DB text columns filled from a plain <textarea>, which never
// contains a mid-item line break — see wiki-markdown.tsx's own note on CRLF
// normalization). renderWikiMarkdown treats each physical line as a
// potential list-item boundary, so a soft-wrapped continuation line would
// otherwise break out of its bullet/numbered item as a stray paragraph.
// This joins those continuation lines back into one logical line per list
// item/paragraph before rendering — the same line-folding a real Markdown
// parser does — without changing renderWikiMarkdown's behavior for every
// other (already-unwrapped) caller.
function unwrapSoftWraps(text: string): string {
  const NEW_LOGICAL_LINE = /^(#{1,3}\s|-\s|\d+\.\s)/;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (line.trim().length > 0 && prev !== undefined && prev.trim().length > 0 && !NEW_LOGICAL_LINE.test(line)) {
      out[out.length - 1] = `${prev} ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

export async function loadHelpGuide(): Promise<{ title: string; body: string }> {
  const raw = await readFile(join(process.cwd(), "content/USER_GUIDE.md"), "utf-8");
  const titleMatch = raw.match(/^#\s+(.*)$/m);
  const title = titleMatch?.[1]?.trim() ?? "Welcome to 0dot";
  const rest = titleMatch ? raw.slice(titleMatch.index! + titleMatch[0].length) : raw;
  return { title, body: unwrapSoftWraps(rest.trimStart()) };
}
