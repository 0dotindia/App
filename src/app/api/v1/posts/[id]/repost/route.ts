import { db } from "@/lib/db";
import { resolveApiRequest, requireScope, requireVerifiedApiUser, apiError } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { revalidatePath } from "next/cache";

// Plain-repost toggle only, mirroring actions/posts.ts's toggleRepost —
// quote-reposts (createQuoteRepost) need their own compose UI and stay
// web-only for now, same scoping decision as the compose route's
// text-only, no-media posture.
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
  const original = await db.post.findFirst({ where: { id: postId, deletedAt: null }, select: { id: true } });
  if (!original) return apiError("Not found.", 404);

  // Read + write in one transaction (not just the write) — two concurrent
  // toggles could otherwise both read "not reposted yet" before either
  // commits, same race the web action's own comment flags. repostCount is
  // also re-read post-commit here (not computed from a pre-transaction
  // snapshot ± 1), which could otherwise return a stale count under
  // concurrent repost/un-repost activity on the same post.
  const { reposted, repostCount } = await db.$transaction(async (tx) => {
    const existing = await tx.post.findFirst({
      where: { authorId: ctx.userId, repostOfId: postId, body: "", deletedAt: null },
    });
    if (existing) {
      await tx.post.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
      const updated = await tx.post.update({ where: { id: postId }, data: { repostCount: { decrement: 1 } }, select: { repostCount: true } });
      return { reposted: false, repostCount: updated.repostCount };
    }
    await tx.post.create({ data: { authorId: ctx.userId, body: "", repostOfId: postId } });
    const updated = await tx.post.update({ where: { id: postId }, data: { repostCount: { increment: 1 } }, select: { repostCount: true } });
    return { reposted: true, repostCount: updated.repostCount };
  });

  const user = await db.user.findUnique({ where: { id: ctx.userId }, select: { username: { select: { handle: true } } } });
  revalidatePath("/feed");
  revalidatePath("/explore");
  if (user?.username?.handle) revalidatePath(`/${user.username.handle}`);

  return Response.json(
    { reposted, repostCount },
    { headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) } }
  );
}
