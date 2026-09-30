"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { purchaseCourseForUser } from "@/lib/purchases";
import { requireVerifiedUser } from "@/lib/auth-guards";
import { saveProtectedFile, issueDownloadToken } from "@/lib/protected-storage";
import { hasCourseAccess } from "@/lib/course-access";
import { checkCourseCompletion } from "@/lib/learning-completion";
import type { ActionState } from "@/app/actions/auth";

const MAX_FILE_BYTES = 500 * 1024 * 1024;
const STATUS_VALUES = new Set(["draft", "active", "archived"]);

const CONTENT_TYPE_VALUES = new Set(["video", "text", "download"]);

type CourseFields = {
  title: string;
  description: string;
  price: number | null;
  currency: string | null;
  requiredTierId: string | null;
  status: string;
};

// spec §11.1: purchasable directly, tier-bundled, or both — but not
// neither, or the course would be unreachable by anyone.
async function parseAndValidateCourseFields(formData: FormData, creatorId: string): Promise<{ error: string } | CourseFields> {
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 1 || title.length > 120) return { error: "Title must be 1-120 characters." };

  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 2000) return { error: "Description must be 2000 characters or fewer." };

  const priceRaw = String(formData.get("price") ?? "").trim();
  let price: number | null = null;
  let currency: string | null = null;
  if (priceRaw) {
    price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0.01) return { error: "Price must be a positive number." };
    currency = String(formData.get("currency") ?? "usd").trim().toLowerCase() || "usd";
  }

  const requiredTierIdRaw = String(formData.get("requiredTierId") ?? "").trim() || null;
  let requiredTierId: string | null = null;
  if (requiredTierIdRaw) {
    const tier = await db.membershipTier.findUnique({ where: { id: requiredTierIdRaw }, select: { creatorId: true } });
    if (!tier || tier.creatorId !== creatorId) return { error: "Choose one of your own membership tiers." };
    requiredTierId = requiredTierIdRaw;
  }

  if (price === null && requiredTierId === null) {
    return { error: "Set a price, bundle it into a membership tier, or both — a course needs at least one." };
  }

  const statusRaw = String(formData.get("status") ?? "draft");
  const status = STATUS_VALUES.has(statusRaw) ? statusRaw : "draft";

  return { title, description, price, currency, requiredTierId, status };
}

export async function createCourse(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const fields = await parseAndValidateCourseFields(formData, user.id);
  if ("error" in fields) return fields;

  await db.course.create({ data: { creatorId: user.id, ...fields } });

  if (user.username) revalidatePath(`/s/${user.username.handle}`);
  return undefined;
}

export async function updateCourse(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const courseId = String(formData.get("courseId") ?? "");

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Course not found." };
  if (course.creatorId !== user.id) return { error: "You don't have permission to manage this course." };

  const fields = await parseAndValidateCourseFields(formData, user.id);
  if ("error" in fields) return fields;

  await db.course.update({ where: { id: course.id }, data: fields });

  if (user.username) {
    revalidatePath(`/s/${user.username.handle}`);
    revalidatePath(`/s/${user.username.handle}/courses/${course.id}`);
  }
  return undefined;
}

export async function archiveCourse(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return;

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.creatorId !== user.id) return;

  await db.course.update({ where: { id: course.id }, data: { status: "archived" } });
  if (user.username) revalidatePath(`/s/${user.username.handle}`);
}

async function requireOwnedCourse(courseId: string, userId: string) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.creatorId !== userId) return null;
  return course;
}

export async function createModule(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 1 || title.length > 120) return { error: "Title must be 1-120 characters." };

  const course = await requireOwnedCourse(courseId, user.id);
  if (!course) return { error: "You don't have permission to manage this course." };

  const moduleCount = await db.courseModule.count({ where: { courseId } });
  await db.courseModule.create({ data: { courseId, title, position: moduleCount } });

  if (user.username) revalidatePath(`/s/${user.username.handle}/courses/${courseId}`);
  return undefined;
}

export async function deleteModule(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const moduleId = String(formData.get("moduleId") ?? "");
  if (!moduleId) return;

  const courseModule = await db.courseModule.findUnique({ where: { id: moduleId }, include: { course: true } });
  if (!courseModule || courseModule.course.creatorId !== user.id) return;

  await db.courseModule.delete({ where: { id: moduleId } });
  if (user.username) revalidatePath(`/s/${user.username.handle}/courses/${courseModule.courseId}`);
}

export async function createLesson(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const moduleId = String(formData.get("moduleId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 1 || title.length > 120) return { error: "Title must be 1-120 characters." };

  const contentType = String(formData.get("contentType") ?? "");
  if (!CONTENT_TYPE_VALUES.has(contentType)) return { error: "Choose a content type." };

  const courseModule = await db.courseModule.findUnique({ where: { id: moduleId }, include: { course: true } });
  if (!courseModule || courseModule.course.creatorId !== user.id) {
    return { error: "You don't have permission to manage this course." };
  }

  let body: string | null = null;
  let fileKey: string | null = null;
  let fileMimeType: string | null = null;
  let fileSizeBytes: number | null = null;

  if (contentType === "text") {
    body = String(formData.get("body") ?? "").trim();
    if (body.length < 1 || body.length > 20000) return { error: "Lesson text must be 1-20000 characters." };
  } else {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a file for this lesson." };
    const saved = await saveProtectedFile(file, { maxBytes: MAX_FILE_BYTES });
    if ("error" in saved) return saved;
    fileKey = saved.key;
    fileMimeType = saved.mimeType;
    fileSizeBytes = saved.sizeBytes;
  }

  const lessonCount = await db.lesson.count({ where: { moduleId } });
  await db.lesson.create({
    data: { moduleId, title, position: lessonCount, contentType, body, fileKey, fileMimeType, fileSizeBytes },
  });

  if (user.username) revalidatePath(`/s/${user.username.handle}/courses/${courseModule.courseId}`);
  return undefined;
}

export async function deleteLesson(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) return;

  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: { include: { course: true } } } });
  if (!lesson || lesson.module.course.creatorId !== user.id) return;

  await db.lesson.delete({ where: { id: lessonId } });
  if (user.username) revalidatePath(`/s/${user.username.handle}/courses/${lesson.module.courseId}`);
}

// Core lives in lib/purchases.ts, shared with POST /api/v1/wallet/purchases.
export async function purchaseCourse(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const result = await purchaseCourseForUser(user.id, String(formData.get("courseId") ?? ""));
  if ("error" in result) return { error: result.error };
  return { success: true };
}

// spec §11.2's third criterion: only recorded for a user who currently has
// access — re-checked here via hasCourseAccess, not trusted from the fact
// that the lesson page rendered (which itself already gated on the same
// check, but a direct action call must never assume its caller came from
// that page).
export async function markLessonComplete(formData: FormData): Promise<void> {
  const user = await requireVerifiedUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) return;

  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: { include: { course: true } } } });
  if (!lesson) return;
  if (!(await hasCourseAccess(user.id, lesson.module.courseId))) return;

  await db.courseProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: { userId: user.id, lessonId },
    update: {},
  });

  await checkCourseCompletion(user.id, lesson.module.courseId);

  const creatorUsername = await db.username.findUnique({ where: { userId: lesson.module.course.creatorId }, select: { handle: true } });
  if (creatorUsername) revalidatePath(`/${creatorUsername.handle}/courses/${lesson.module.courseId}`);
}

// spec §11.2's first criterion ("even by guessing lesson IDs"): re-checks
// access here (issuance time) AND the /api/downloads/[token] route
// re-checks again (request time) — same double-check posture
// requestDownloadUrl already established for digital products.
export async function requestLessonFileUrl(lessonId: string): Promise<{ url: string } | { error: string }> {
  const user = await requireVerifiedUser();

  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson || !lesson.fileKey) return { error: "This lesson has no file." };
  if (!(await hasCourseAccess(user.id, lesson.module.courseId))) return { error: "You don't have access to this course." };

  const token = issueDownloadToken({ resourceType: "lesson", resourceId: lessonId, userId: user.id });
  return { url: `/api/downloads/${token}` };
}
