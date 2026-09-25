"use client";

import { useRef, useState } from "react";
import { askAssistant, rateAssistantReply } from "@/app/actions/personal-assistant";

type Turn = { role: "user" | "assistant"; content: string; generationId?: string; rated?: boolean; toolsUsed?: string[] };

const SUGGESTIONS = [
  "Summarize my profile in two sentences",
  "What have I posted about recently?",
  "Which of my articles are still drafts?",
  "Do I have unread notifications?",
];

// The transcript lives only in this component's state (browser memory) and
// is sent back with each question — the server stores nothing but a bounded
// audit row, so a refresh clears the conversation by design.
export function AssistantChat({ displayName }: { displayName: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setPending(true);
    setInput("");
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: message }]);

    const result = await askAssistant(history, message);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setTurns((t) => [...t, { role: "assistant", content: result.text, generationId: result.generationId, toolsUsed: result.toolsUsed }]);
    }
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  async function rate(index: number, helpful: boolean) {
    const turn = turns[index];
    if (!turn?.generationId || turn.rated) return;
    setTurns((t) => t.map((x, i) => (i === index ? { ...x, rated: true } : x)));
    await rateAssistantReply(turn.generationId, helpful);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div role="log" aria-live="polite" aria-label="Conversation with your assistant" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {turns.length === 0 && (
          <div>
            <p className="mutedText">Hi {displayName}. Try one of these:</p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="button buttonSecondary buttonSmall" onClick={() => send(s)} disabled={pending}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, i) => (
          <div
            key={i}
            style={{
              alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "0.5rem 0.75rem",
              borderRadius: 10,
              border: "1px solid var(--border, #333)",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            <span className="srOnly">{turn.role === "user" ? "You: " : "Assistant: "}</span>
            {turn.content}
            {turn.role === "assistant" && turn.generationId && (
              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", alignItems: "center" }}>
                {turn.toolsUsed && turn.toolsUsed.length > 0 && (
                  <span className="mutedText" style={{ fontSize: "0.75rem" }}>
                    Looked at: {[...new Set(turn.toolsUsed)].map((t) => t.replace(/^(get|list)_my_/, "")).join(", ")}
                  </span>
                )}
                {turn.rated ? (
                  <span className="mutedText" style={{ fontSize: "0.75rem" }}>Thanks for the feedback</span>
                ) : (
                  <>
                    <button type="button" className="button buttonSecondary buttonSmall" onClick={() => rate(i, true)} aria-label="Helpful">
                      Helpful
                    </button>
                    <button type="button" className="button buttonSecondary buttonSmall" onClick={() => rate(i, false)} aria-label="Not helpful">
                      Not helpful
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {pending && <p className="mutedText">Thinking…</p>}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="errorText" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        style={{ display: "flex", gap: "0.4rem" }}
      >
        <input
          className="textInput"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your 0dot data…"
          aria-label="Message your assistant"
          maxLength={4000}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="button" disabled={pending || input.trim().length === 0}>
          Send
        </button>
      </form>
    </div>
  );
}
