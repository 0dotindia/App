"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth-guards";
import { saveUploadedImage } from "@/lib/uploads";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSafeUrl } from "@/lib/url-safety";
import { validateProjectSlugFormat } from "@/lib/reserved-project-slugs";
import { notifyProjectLike, notifyProjectComment } from "@/lib/notifications";
import type { ActionState } from "@/app/actions/auth";

const MAX_GALLERY_IMAGES = 12;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_EXTERNAL_LINKS = 10;
const STATUS_VALUES = new Set(["in_progress", "completed", "archived"]);
const VISIBILITY_VALUES = new Set(["public", "unlisted"]);

function checkProjectWriteRateLimit(userId: string): boolean {
  return checkRateLimit(`project:write:user:${userId}`, { max: 10, windowMs: 15 * 60 * 1000 });
}

function checkProjectCommentRateLimit(userId: string): boolean {
  return checkRateLimit(`project:comment:user:${userId}`, { max: 20, windowMs: 5 * 60 * 1000 });
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// external_links come in as parallel `linkLabel`/`linkUrl` form fields (one
// row per link) — each url validated by isSafeUrl (spec §3.1: rejects
// javascript:/data: the same way profile Links do), invalid or empty rows
// are dropped rather than erroring the whole submission.
function parseExternalLinks(formData: FormData): { label: string; url: string }[] {
  const labels = formData.getAll("linkLabel").map(String);
  const urls = formData.getAll("linkUrl").map(String);
  const links: { label: string; url: string }[] = [];
  for (let i = 0; i < Math.min(labels.length, urls.length) && links.length < MAX_EXTERNAL_LINKS; i++) {
    const url = urls[i].trim();
    const label = labels[i].trim().slice(0, 60);
    if (url && label && isSafeUrl(url)) links.push({ label, url });
  }
  return links;
}

type ProjectFields = {
  title: string;
  summary: string;
  description: string;
  status: string;
  visibility: string;
  featuredOnResume: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  externalLinksJson: string | null;
};

function parseAndValidateProjectFields(formData: FormData): { error: string } | ProjectFields {
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 1 || title.length > 120) return { error: "Title must be 1-120 characters." };

  const summary = String(formData.get("summary") ?? "").trim();
  if (summary.length > 280) return { error: "Summary must be 280 characters or fewer." };

  const description = String(formData.get("description") ?? "").trim();

  const statusRaw = String(formData.get("status") ?? "in_progress");
  const status = STATUS_VALUES.has(statusRaw) ? statusRaw : "in_progress";

  const visibilityRaw = String(formData.get("visibility") ?? "public");
  const visibility = VISIBILITY_VALUES.has(visibilityRaw) ? visibilityRaw : "public";

  const featuredOnResume = formData.get("featuredOnResume") === "true";

  const startedAt = parseDate(formData.get("startedAt"));
  const completedAt = parseDate(formData.get("completedAt"));

  const links = parseExternalLinks(formData);

  return {
    title,
    summary,
    description,
    status,
    visibility,
    featuredOnResume,
    startedAt,
    completedAt,
    externalLinksJson: links.length > 0 ? JSON.stringify(links) : null,
  };
}

// spec §3.1: credits the Skills used on a project (ProjectSkill join).
// Replace-all-on-save rather than a per-row add/remove UI — the join table
// has no attributes of its own, so a small owner-only checklist re-synced
// on every save is simpler than diffing.
async function syncProjectSkills(projectId: string, formData: FormData, ownerId: string): Promise<void> {
  const requestedIds = [...new Set(formData.getAll("skillIds").map(String))];
  const ownSkills = requestedIds.length
    ? await db.skill.findMany({ where: { id: { in: requestedIds }, profile: { userId: ownerId } }, select: { id: true } })
    : [];
  await db.$transaction([
    db.projectSkill.deleteMany({ where: { projectId } }),
    ...(ownSkills.length
      ? [db.projectSkill.createMany({ data: ownSkills.map((s) => ({ projectId, skillId: s.id })) })]
      : []),
  ]);
}

// spec §3.1/§3.4, build plan step 1: slug validated the same shared way
// usernames/communities/businesses are (src/lib/reserved-project-slugs.ts) —
// the fourth reuse of validateSlugFormat.
export async function createProject(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();

  if (!checkProjectWriteRateLimit(user.id)) {
    return { error: "You're creating projects too fast. Please slow down." };
  }

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const slugError = validateProjectSlugFormat(slug);
  if (slugError === "invalid_format") {
    return { error: "Slug must be 3-60 characters: letters, numbers, underscore only." };
  }
  if (slugError === "reserved") {
    return { error: "That slug is reserved." };
  }
  const existingSlug = await db.project.findUnique({ where: { slug } });
  if (existingSlug) return { error: "That slug is already taken." };

  const fields = parseAndValidateProjectFields(formData);
  if ("error" in fields) return fields;

  let coverImageUrl: string | undefined;
  const coverFile = formData.get("coverImage");
  if (coverFile instanceof File && coverFile.size > 0) {
    const result = await saveUploadedImage(coverFile, { maxBytes: MAX_IMAGE_BYTES, uploadedById: user.id });
    if ("error" in result) return { error: result.error };
    coverImageUrl = result.url;
  }

  const galleryFiles = formData
    .getAll("gallery")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, MAX_GALLERY_IMAGES);
  const galleryUrls: string[] = [];
  for (const file of galleryFiles) {
    const result = await saveUploadedImage(file, { maxBytes: MAX_IMAGE_BYTES, uploadedById: user.id });
    if ("error" in result) return { error: result.error };
    galleryUrls.push(result.url);
  }

  // New projects land at the end of the manual order, same "count of
  // existing siblings" convention addSkill/addWorkExperience already use.
  const projectCount = await db.project.count({ where: { ownerId: user.id } });

  const project = await db.project.create({
    data: {
      ownerId: user.id,
      slug,
      ...fields,
      position: projectCount,
      coverImageUrl,
      galleryJson: galleryUrls.length > 0 ? JSON.stringify(galleryUrls) : null,
    },
  });

  await syncProjectSkills(project.id, formData, user.id);

  if (user.username) revalidatePath(`/${user.username.handle}`);
  redirect(`/p/${project.slug}`);
}

export async function updateProject(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Project not found." };
  if (project.ownerId !== user.id) return { error: "You don't have permission to manage this project." };

  const fields = parseAndValidateProjectFields(formData);
  if ("error" in fields) return fields;

  let coverImageUrl = project.coverImageUrl;
  const coverFile = formData.get("coverImage");
  if (coverFile instanceof File && coverFile.size > 0) {
    const result = await saveUploadedImage(coverFile, { maxBytes: MAX_IMAGE_BYTES, uploadedById: user.id });
    if ("error" in result) return { error: result.error };
    coverImageUrl = result.url;
  }

  // Merges kept-existing + newly-uploaded instead of the old "any new file
  // submitted wholesale-replaces the whole gallery" behavior — that silently
  // deleted every other existing image the moment you added one more.
  // ImagePickerField (gallery mode) always reports the full current keep
  // set as `keepGalleryUrls`, one hidden input per URL; each is checked
  // against the project's actual current gallery rather than trusted
  // outright, since it arrives as ordinary form input.
  const currentGalleryUrls: string[] = project.galleryJson ? JSON.parse(project.galleryJson) : [];
  const keepGalleryUrls = formData
    .getAll("keepGalleryUrls")
    .filter((v): v is string => typeof v === "string")
    .filter((url) => currentGalleryUrls.includes(url));

  const galleryFiles = formData
    .getAll("gallery")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, Math.max(0, MAX_GALLERY_IMAGES - keepGalleryUrls.length));
  const newGalleryUrls: string[] = [];
  for (const file of galleryFiles) {
    const result = await saveUploadedImage(file, { maxBytes: MAX_IMAGE_BYTES, uploadedById: user.id });
    if ("error" in result) return { error: result.error };
    newGalleryUrls.push(result.url);
  }

  const mergedGalleryUrls = [...keepGalleryUrls, ...newGalleryUrls];
  const galleryJson = mergedGalleryUrls.length > 0 ? JSON.stringify(mergedGalleryUrls) : null;

  await db.project.update({
    where: { id: project.id },
    data: { ...fields, coverImageUrl, galleryJson },
  });
  await syncProjectSkills(project.id, formData, user.id);

  if (user.username) revalidatePath(`/${user.username.handle}`);
  revalidatePath(`/p/${project.slug}`);
  return undefined;
}

// Same shape as moveSkill (src/app/actions/skills.ts) with one addition:
// Project.position defaults to 0 with no backfill (every pre-existing row
// starts tied), so a plain two-row swap on tied values would be a same-
// value no-op the first time any legacy project gets reordered. Every
// sibling is renumbered to its current sequential display index first —
// index and swapIndex are then guaranteed-distinct integers, so swapping
// them always produces a real, visible reorder, and every other project's
// position collapses onto real, distinct values as a side effect (so this
// degrades to a plain two-row swap on every move after the first).
export async function moveProject(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const projectId = String(formData.get("projectId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (direction !== "up" && direction !== "down") return;

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== user.id) return;

  const siblings = await db.project.findMany({
    where: { ownerId: project.ownerId },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
  const index = siblings.findIndex((p) => p.id === projectId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return;

  const positions = siblings.map((_, i) => i);
  [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];

  await db.$transaction(
    siblings.map((sibling, i) => db.project.update({ where: { id: sibling.id }, data: { position: positions[i] } })),
  );

  if (user.username) revalidatePath(`/s/${user.username.handle}`);
  if (user.username) revalidatePath(`/${user.username.handle}`);
}

export async function archiveProject(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== user.id) return;

  await db.project.update({ where: { id: project.id }, data: { status: "archived" } });
  if (user.username) revalidatePath(`/${user.username.handle}`);
  revalidatePath(`/p/${project.slug}`);
}

// spec §3.1: userId is resolved from a submitted handle so a project owner
// can credit a real 0dot member; leaving the handle field empty falls back
// to a free-text displayName credit for someone without an account —
// exactly one of the two is required, enforced here (the app-layer
// invariant the schema comment on ProjectCollaborator calls out).
export async function addCollaborator(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Project not found." };
  if (project.ownerId !== user.id) return { error: "You don't have permission to manage this project." };

  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  const displayNameRaw = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim().slice(0, 60) || null;

  let userId: string | null = null;
  let displayName: string | null = null;

  if (handle) {
    const collaboratorUsername = await db.username.findUnique({ where: { handle } });
    if (!collaboratorUsername) return { error: "No user found with that handle." };
    const alreadyCredited = await db.projectCollaborator.findFirst({
      where: { projectId, userId: collaboratorUsername.userId },
    });
    if (alreadyCredited) return { error: "That user is already credited on this project." };
    userId = collaboratorUsername.userId;
  } else {
    if (displayNameRaw.length < 1 || displayNameRaw.length > 100) {
      return { error: "Enter a handle, or a display name for a collaborator without a 0dot account." };
    }
    displayName = displayNameRaw;
  }

  await db.projectCollaborator.create({ data: { projectId, userId, displayName, role } });

  if (user.username) revalidatePath(`/${user.username.handle}`);
  revalidatePath(`/p/${project.slug}`);
  return undefined;
}

export async function removeCollaborator(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  if (!collaboratorId) return;

  const collaborator = await db.projectCollaborator.findUnique({
    where: { id: collaboratorId },
    include: { project: true },
  });
  if (!collaborator || collaborator.project.ownerId !== user.id) return;

  await db.projectCollaborator.delete({ where: { id: collaboratorId } });
  revalidatePath(`/p/${collaborator.project.slug}`);
}

// Mirrors toggleLike (posts.ts) exactly: same-transaction create/delete +
// increment/decrement, notification fired after the transaction commits.
export async function toggleProjectLike(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const projectId = String(formData.get("projectId") ?? "");

  const [existing, project] = await Promise.all([
    db.projectLike.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } }),
    db.project.findUnique({ where: { id: projectId }, select: { ownerId: true, slug: true } }),
  ]);
  if (!project) return;

  if (existing) {
    await db.$transaction([
      db.projectLike.delete({ where: { projectId_userId: { projectId, userId: user.id } } }),
      db.project.update({ where: { id: projectId }, data: { likeCount: { decrement: 1 } } }),
    ]);
  } else {
    await db.$transaction([
      db.projectLike.create({ data: { projectId, userId: user.id } }),
      db.project.update({ where: { id: projectId }, data: { likeCount: { increment: 1 } } }),
    ]);
    await notifyProjectLike({ recipientId: project.ownerId, actorId: user.id, projectSlug: project.slug });
  }

  revalidatePath(`/p/${project.slug}`);
}

export async function createProjectComment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const projectId = String(formData.get("projectId") ?? "");

  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 1000) return { error: "Comment must be 1-1000 characters." };

  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true, slug: true } });
  if (!project) return { error: "Project not found." };

  if (!checkProjectCommentRateLimit(user.id)) {
    return { error: "You're commenting too fast. Please slow down." };
  }

  await db.$transaction([
    db.projectComment.create({ data: { projectId, authorId: user.id, body } }),
    db.project.update({ where: { id: projectId }, data: { commentCount: { increment: 1 } } }),
  ]);
  await notifyProjectComment({ recipientId: project.ownerId, actorId: user.id, projectSlug: project.slug });

  revalidatePath(`/p/${project.slug}`);
  return undefined;
}

// Soft-deleted, same posture as Post — commentCount is decremented so the
// visible count stays accurate even though the row (and its content, for
// moderation history) is retained.
export async function deleteProjectComment(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const commentId = String(formData.get("commentId") ?? "");
  if (!commentId) return;

  const comment = await db.projectComment.findUnique({
    where: { id: commentId },
    include: { project: true },
  });
  if (!comment || comment.deletedAt) return;
  if (comment.authorId !== user.id && comment.project.ownerId !== user.id) return;

  await db.$transaction([
    db.projectComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
    db.project.update({ where: { id: comment.projectId }, data: { commentCount: { decrement: 1 } } }),
  ]);
  revalidatePath(`/p/${comment.project.slug}`);
}
