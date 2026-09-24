import type { Metadata } from "next";
import { requireOwnProfile } from "@/lib/auth-guards";
import { AssistantChat } from "@/components/AssistantChat";

export const metadata: Metadata = { title: "Assistant" };

export default async function AssistantPage() {
  const user = await requireOwnProfile();

  return (
    <div className="profileCard">
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>Your assistant</h1>
      <p className="mutedText" style={{ marginBottom: "1rem" }}>
        Ask about your own profile, posts, articles, projects and notifications. It is read-only, can&apos;t see your direct
        messages, and this conversation is kept only in this browser tab. To answer, the relevant excerpts of your own content
        are sent to our AI provider (Anthropic).
      </p>
      <AssistantChat displayName={user.profile!.displayName} />
    </div>
  );
}
