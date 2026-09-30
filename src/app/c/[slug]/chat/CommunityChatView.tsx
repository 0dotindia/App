"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { sendChatMessage, deleteChatMessage } from "@/app/actions/community-chat";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";

export type ChatMessageData = {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  sender: {
    username: { handle: string } | null;
    profile: { displayName: string; avatarUrl: string | null } | null;
  };
};

const REFRESH_COALESCE_MS = 300; // same coalescing posture as MessagingProvider

// Page-local SSE subscription, not a global provider like MessagingProvider
// — chat has no global unread badge to keep in sync (spec §11.1: "no
// per-user read receipts or unread counts"), so the connection only needs
// to exist while this page is open. publishToCommunityChat broadcasts to
// every subscriber including the sender's own tab, so a plain
// router.refresh() on any event covers the sender's own message too — no
// separate optimistic-append path needed (unlike Phase 2 DMs, where the
// SSE publish deliberately excludes the sender).
export function CommunityChatView({
  communitySlug,
  communityId,
  currentUserId,
  messages,
  canSend,
  canModerate,
}: {
  communitySlug: string;
  communityId: string;
  currentUserId?: string | null;
  messages: ChatMessageData[];
  canSend: boolean;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const MAX_COMPOSER_HEIGHT_PX = 160;
  // FIX_PLAN P2: same fix as ConversationView.tsx — the composer was fixed
  // at rows={1}, so a multi-line message (Shift+Enter) scrolled out of
  // view while typing. Uncontrolled (name="body", no React state), so this
  // grows on the input event rather than a value-change effect.
  function autoGrowComposer() {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT_PX)}px`;
  }
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX_PLAN P2: same fix as ConversationView.tsx — auto-scroll used to
  // fire on every messages update regardless of where the viewer was,
  // yanking someone back to the bottom while they'd scrolled up to read
  // history. Starts true so the initial load still lands at the bottom;
  // handleSubmit forces it true so sending your own message always scrolls
  // to it once the SSE roundtrip brings the new `messages` prop in.
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const source = new EventSource(`/api/c/${communitySlug}/chat/stream`);
    source.onmessage = () => {
      if (pendingRef.current) return;
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        router.refresh();
      }, REFRESH_COALESCE_MS);
    };
    return () => {
      source.close();
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, [communitySlug, router]);

  const NEAR_BOTTOM_THRESHOLD_PX = 80;

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    function handleScroll() {
      isNearBottomRef.current =
        container!.scrollHeight - container!.scrollTop - container!.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
    }
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [messages]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!String(formData.get("body") ?? "").trim()) return;
    startTransition(async () => {
      // A rejected send (rate limit, mute/ban, etc.) must not clear the
      // composer — that reads as "sent" when the message never landed,
      // silently losing what the user typed.
      const result = await sendChatMessage(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      if (composerRef.current) composerRef.current.style.height = "auto";
      isNearBottomRef.current = true;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 10rem)" }}>
      <div ref={listRef} role="log" aria-live="polite" aria-label="Chat messages" className="messageList">
        {messages.length === 0 && <EmptyState title="No messages yet — say hello." />}
        {messages.map((m) => {
          const displayName = m.sender.profile?.displayName ?? m.sender.username?.handle ?? "Unknown";
          return (
            <div
              key={m.id}
              className={`messageBubble${m.senderId === currentUserId ? " messageBubbleSelf" : ""}`}
              style={{ alignSelf: m.senderId === currentUserId ? "flex-end" : "flex-start" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <strong style={{ fontSize: "0.8rem" }}>{displayName}</strong>
                {canModerate && (
                  <form action={deleteChatMessage}>
                    <input type="hidden" name="communityId" value={communityId} />
                    <input type="hidden" name="messageId" value={m.id} />
                    <ConfirmButton
                      className="button buttonSecondary iconButton"
                      title="Remove this message?"
                      description="This can't be undone."
                      confirmLabel="Remove"
                      aria-label="Remove message"
                    >
                      <X size={14} />
                    </ConfirmButton>
                  </form>
                )}
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.body}</p>
            </div>
          );
        })}
      </div>

      {canSend ? (
        <form ref={formRef} onSubmit={handleSubmit} className="messageComposer">
          <input type="hidden" name="communityId" value={communityId} />
          <label htmlFor="chat-composer-input" className="srOnly">
            Message
          </label>
          <textarea
            id="chat-composer-input"
            name="body"
            ref={composerRef}
            rows={1}
            maxLength={500}
            placeholder="Send a message…"
            className="textInput"
            onInput={autoGrowComposer}
            style={{ resize: "none", overflowY: "auto", maxHeight: MAX_COMPOSER_HEIGHT_PX }}
          />
          <button type="submit" className="button" disabled={isPending}>
            {isPending ? "Sending…" : "Send"}
          </button>
          {error && (
            <p className="errorText" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="mutedText" style={{ padding: "0.75rem 0" }}>
          You don&apos;t have permission to send messages here.
        </p>
      )}
    </div>
  );
}
