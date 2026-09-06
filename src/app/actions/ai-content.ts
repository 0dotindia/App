"use server";

import { requireOwnProfile, requireVerifiedUser } from "@/lib/auth-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAIProvider } from "@/lib/ai-provider";
import { logAIGeneration, markAIGenerationAccepted } from "@/lib/ai-generation";

// phase-11 spec §5.1: both features here only ever return a suggestion for
// the caller to review, edit, and submit through the *existing*
// compose/validation surface (EditProfileForm's own updateProfile action,
// ArticleForm's own createArticle/updateArticle action) — there is no
// AI-only write path. Called directly from a client component (not wired
// through useActionState/a <form action>), same "plain async server
// action, invoked as an RPC" shape as any other button-triggered mutation
// that isn't itself a form submission.
export type AISuggestionResult = { generationId: string; text: string } | { error: string };

async function requireSuggestionRateLimit(userId: string): Promise<{ error: string } | null> {
  // Every invocation has a real inference cost (spec §10.1) — a tighter
  // limit than plain content mutations (createPost etc.), same reasoning
  // rate-limit.ts already documents for signup/login.
  const allowed = checkRateLimit(`ai-suggest:${userId}`, { max: 20, windowMs: 60 * 60 * 1000 });
  return allowed ? null : { error: "You're generating AI suggestions too quickly. Try again in a bit." };
}

export async function suggestProfileBio(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 500);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "profile_bio", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "profile_builder",
    requestedById: user.id,
    subjectType: "profile",
    subjectId: user.id,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestArticleDraft(topic: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedTopic = topic.trim().slice(0, 300);
  if (trimmedTopic.length === 0) return { error: "Enter a topic first." };

  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "article_draft", context: trimmedTopic });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  // subjectId is null: the article may not exist yet (a new-article draft
  // suggestion happens before the first save) — subject_id is nullable in
  // the AIGeneration model for exactly this case.
  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "article",
    subjectId: null,
    modelName: result.modelName,
    input: { topic: trimmedTopic },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestProjectPitch(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "project_pitch", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "profile_builder",
    requestedById: user.id,
    subjectType: "project",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestProjectDescription(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "project_description", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "project",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestWorkExperienceBullets(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "work_experience_bullets", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "profile_builder",
    requestedById: user.id,
    subjectType: "work_experience",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

// context here isn't user-typed (unlike the fields above) — the caller
// assembles it server-side from the profile's bio + project titles/
// summaries (see portfolio/skills/page.tsx) so the suggestion reflects the
// owner's actual portfolio without a second round-trip to collect input.
export async function suggestSkills(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 1000);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "skill_suggestions", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "profile_builder",
    requestedById: user.id,
    subjectType: "profile",
    subjectId: user.id,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestBookDescription(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "book_description", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "book",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestWikiPageDraft(topic: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedTopic = topic.trim().slice(0, 300);
  if (trimmedTopic.length === 0) return { error: "Enter a topic first." };

  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "wiki_page_draft", context: trimmedTopic });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "wiki_page",
    subjectId: null,
    modelName: result.modelName,
    input: { topic: trimmedTopic },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestFileDescription(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "file_description", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "published_file",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

// Shared by both Podcast.description (show-level) and
// PodcastEpisode.description (episode-level) — same prompt shape, different
// call sites, same posture as suggestProjectPitch/suggestProjectDescription
// sharing one kind family.
export async function suggestPodcastShowNotes(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "podcast_show_notes", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "podcast",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestProductDescription(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "product_description", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "digital_product",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestOfferingDescription(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "offering_description", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "offering",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestTierDescription(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "membership_tier_description", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "membership_tier",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestFormDescription(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "form_description", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "form",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

export async function suggestCrossPostCaption(context: string): Promise<AISuggestionResult> {
  const user = await requireOwnProfile();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "cross_post_caption", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "scheduled_cross_post",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

// requireVerifiedUser, not requireOwnProfile like every other suggester
// above — a developer app can be owned by a business, and registering one
// never requires the caller to have claimed a profile/username (see
// createDeveloperApp, src/app/actions/developer-apps.ts).
export async function suggestDeveloperAppDescription(context: string): Promise<AISuggestionResult> {
  const user = await requireVerifiedUser();
  const limited = await requireSuggestionRateLimit(user.id);
  if (limited) return limited;

  const trimmedContext = context.trim().slice(0, 300);
  const provider = getAIProvider();
  let result: Awaited<ReturnType<typeof provider.suggestText>>;
  try {
    result = await provider.suggestText({ kind: "developer_app_description", context: trimmedContext });
  } catch {
    return { error: "AI suggestions are temporarily unavailable. Try again shortly." };
  }

  const generation = await logAIGeneration({
    feature: "content_writer",
    requestedById: user.id,
    subjectType: "developer_app",
    subjectId: null,
    modelName: result.modelName,
    input: { context: trimmedContext },
    output: { text: result.text },
    costTokens: result.costTokens,
  });

  return { generationId: generation.id, text: result.text };
}

// §5.3 acceptance criterion: accepted reflects real use, not mere
// generation — called when the user clicks Insert (true) or Discard
// (false) on the suggestion preview.
export async function recordAISuggestionDecision(generationId: string, accepted: boolean): Promise<void> {
  await requireOwnProfile();
  await markAIGenerationAccepted(generationId, accepted);
}
