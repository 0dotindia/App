import { db } from "@/lib/db";
import { resolveApiRequest, requireScope, requireVerifiedApiUser, apiError } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { revalidatePath } from "next/cache";

// Toggle, mirroring actions/posts.ts's toggleBookmark and this same
// directory's like/repost routes — a second call un-bookmarks rather than
// erroring. No count in the response: bookmark counts are never public
// (phase-1 spec §5.3), unlike likeCount/repostCount.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveApiRequest(request);
  if ("error" in ctx) return apiError(ctx.error, ctx.status);

  const scopeError = requireScope(ctx, "engagement:write");
  if (scopeError) return apiError(scopeError.error, scopeError.status);

  const { allowed, limit, remaining } = await checkApiRateLimit(ctx.appId);
  if (!allowed) return apiError("Rate limit exceeded.", 429);

  const verifiedError = await requireVerifiedApiUser(ctx);
  if (verifiedError) return apiError(verifiedError.error, verifiedError.status);

  const { id: postId } = await params;
  const post = await db.post.findFirst({ where: { id: postId, deletedAt: null }, select: { id: true } });
  if (!post) return apiError("Not found.", 404);

  // Read + write in one transaction — same TOCTOU fix as the like route:
  // a double-tap could otherwise have both requests read "not bookmarked
  // yet" and both attempt create(), the second throwing on the unique
  // constraint instead of un-bookmarking.
  const bookmarked = await db.$transaction(async (tx) => {
    const existing = await tx.bookmark.findUnique({ where: { postId_userId: { postId, userId: ctx.userId } } });
    if (existing) {
      await tx.bookmark.delete({ where: { postId_userId: { postId, userId: ctx.userId } } });
      return false;
    }
    await tx.bookmark.create({ data: { postId, userId: ctx.userId } });
    return true;
  });

  revalidatePath("/feed");
  revalidatePath("/explore");
  revalidatePath("/bookmarks");

  return Response.json(
    { bookmarked },
    { headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) } }
  );
}
