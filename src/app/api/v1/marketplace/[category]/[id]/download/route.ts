import { db } from "@/lib/db";
import { resolveApiRequest, requireScope, apiError } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { issueDownloadToken } from "@/lib/protected-storage";

// Bearer-token counterpart to requestDownloadUrl (src/app/actions/
// digital-products.ts), same shape as the course lesson-file route: mints
// a short-lived signed /api/downloads/[token] URL after re-checking
// ownership and refund status. The signed token is the credential, so the
// mobile client opens the returned URL directly. Only digital products
// carry a downloadable file.
export async function POST(request: Request, { params }: { params: Promise<{ category: string; id: string }> }) {
  const ctx = await resolveApiRequest(request);
  if ("error" in ctx) return apiError(ctx.error, ctx.status);

  const scopeError = requireScope(ctx, "marketplace:read");
  if (scopeError) return apiError(scopeError.error, scopeError.status);

  const { allowed, limit, remaining } = await checkApiRateLimit(ctx.appId);
  if (!allowed) return apiError("Rate limit exceeded.", 429);

  const { category, id } = await params;
  if (category !== "digital_product") return apiError("This item has no download.", 404);

  const purchase = await db.digitalProductPurchase.findUnique({
    where: { productId_buyerId: { productId: id, buyerId: ctx.userId } },
    include: { paymentTransaction: { select: { status: true } } },
  });
  if (!purchase) return apiError("You don't own this product.", 403);
  if (purchase.paymentTransaction.status === "refunded") return apiError("This purchase was refunded.", 403);

  const token = issueDownloadToken({ resourceType: "digital_product", resourceId: id, userId: ctx.userId });
  return Response.json(
    { url: `/api/downloads/${token}` },
    { headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) } }
  );
}
