import { db } from "@/lib/db";
import { resolveApiRequest, requireScope, requireVerifiedApiUser, apiError } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { notifyLike } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

// Toggle, mirroring actions/posts.ts's toggleLike — a second call un-likes
// rather than erroring, same idempotent-toggle posture as the web action.
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
  const post = await db.post.findFirst({ where: { id: postId, deletedAt: null }, select: { authorId: true } });
  if (!post) return apiError("Not found.", 404);

  // Read + write in one transaction (not just the write) — mirrors
  // toggleRepost's fix (docs/BUGS.md item #5): two concurrent calls could
  // otherwise both read "not liked yet" before either write commits, and
  // the second create() would throw on the unique constraint instead of
  // un-liking as this route's own comment promises. likeCount is also
  // re-read post-commit here instead of computed from a pre-transaction
  // snapshot ± 1, which could otherwise return a stale count under
  // concurrent likes/unlikes on the same post.
  const { liked, likeCount } = await db.$transaction(async (tx) => {
    const existing = await tx.postLike.findUnique({ where: { postId_userId: { postId, userId: ctx.userId } } });
    if (existing) {
      await tx.postLike.delete({ where: { postId_userId: { postId, userId: ctx.userId } } });
      const updated = await tx.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } }, select: { likeCount: true } });
      return { liked: false, likeCount: updated.likeCount };
    }
    await tx.postLike.create({ data: { postId, userId: ctx.userId } });
    const updated = await tx.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } }, select: { likeCount: true } });
    return { liked: true, likeCount: updated.likeCount };
  });

  if (liked) {
    await notifyLike({ recipientId: post.authorId, actorId: ctx.userId, subjectId: postId });
  }

  revalidatePath("/feed");
  revalidatePath("/explore");

  return Response.json(
    { liked, likeCount },
    { headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) } }
  );
}
