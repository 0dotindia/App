"use client";

import { useState } from "react";

// Shared by the post-signup recovery-codes page and the Security settings
// regenerate form — a monospace list plus a copy-all button, since these
// codes are the only way back into an account with no email on file.
export function RecoveryCodeList({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      // Clipboard access can be denied (insecure context, browser policy);
      // the codes are still on screen to write down.
    }
  }

  return (
    <div className="stack">
      <ul className="recoveryCodeList">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <button type="button" className="button buttonSecondary" onClick={copyAll}>
        {copied ? "Copied" : "Copy codes"}
      </button>
    </div>
  );
}
