import { db } from "@/lib/db";
import { resolveApiRequest, requireScope, apiError } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { BROWSE_CATEGORY_LABELS } from "@/lib/marketplace-browse";

// Native detail for the two buy-once item kinds mobile can purchase with
// POST /api/v1/wallet/purchases: MarketplaceListing (theme/template/app,
// the /m/[id] page) and DigitalProduct. Courses already have their own
// detail route under /profiles/[username]/courses; freelance services are
// a booking, not a purchase, and stay a browser hand-off.
//
// Visibility matches the web: only an active item is public. A buyer keeps
// seeing an item they own after the seller archives it, so they can still
// reach what they paid for.
const LISTING_CATEGORIES = new Set(["theme", "template", "app"]);

export async function GET(request: Request, { params }: { params: Promise<{ category: string; id: string }> }) {
  const ctx = await resolveApiRequest(request);
  if ("error" in ctx) return apiError(ctx.error, ctx.status);

  const scopeError = requireScope(ctx, "marketplace:read");
  if (scopeError) return apiError(scopeError.error, scopeError.status);

  const { allowed, limit, remaining } = await checkApiRateLimit(ctx.appId);
  if (!allowed) return apiError("Rate limit exceeded.", 429);
  const headers = { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) };

  const { category, id } = await params;

  if (LISTING_CATEGORIES.has(category)) {
    const listing = await db.marketplaceListing.findUnique({
      where: { id },
      include: {
        seller: { include: { username: true, profile: true } },
        sellerBusiness: { select: { name: true, slug: true } },
      },
    });
    if (!listing || listing.category !== category) return apiError("Not found.", 404);
    const owned = Boolean(
      await db.marketplacePurchase.findUnique({ where: { listingId_buyerId: { listingId: listing.id, buyerId: ctx.userId } } })
    );
    if (listing.status !== "active" && !owned) return apiError("Not found.", 404);

    return Response.json(
      {
        category: listing.category,
        categoryLabel: BROWSE_CATEGORY_LABELS[category as "theme" | "template" | "app"],
        id: listing.id,
        title: listing.title,
        description: listing.description,
        descriptionFormat: "markdown",
        coverImageUrl: null,
        price: listing.price,
        seller: {
          name: listing.sellerBusiness?.name ?? listing.seller?.profile?.displayName ?? listing.seller?.username?.handle ?? "Unknown seller",
          username: listing.sellerBusiness ? null : listing.seller?.username?.handle ?? null,
          businessSlug: listing.sellerBusiness?.slug ?? null,
        },
        averageRating: listing.reviewCount > 0 ? listing.averageRating : null,
        reviewCount: listing.reviewCount,
        purchaseCount: listing.purchaseCount,
        available: listing.status === "active",
        owned,
        isOwnItem: listing.sellerUserId === ctx.userId,
        downloadable: false,
        webPath: `/m/${listing.id}`,
      },
      { headers }
    );
  }

  if (category === "digital_product") {
    const product = await db.digitalProduct.findUnique({
      where: { id },
      include: { creator: { include: { username: true, profile: true } } },
    });
    if (!product) return apiError("Not found.", 404);
    const owned = Boolean(
      await db.digitalProductPurchase.findUnique({ where: { productId_buyerId: { productId: product.id, buyerId: ctx.userId } } })
    );
    if (product.status !== "active" && !owned) return apiError("Not found.", 404);
    const handle = product.creator.username?.handle ?? null;

    return Response.json(
      {
        category: "digital_product",
        categoryLabel: BROWSE_CATEGORY_LABELS.digital_product,
        id: product.id,
        title: product.title,
        description: product.description,
        descriptionFormat: "plain",
        coverImageUrl: product.coverImageUrl,
        price: product.price,
        seller: { name: product.creator.profile?.displayName ?? handle ?? "Unknown seller", username: handle, businessSlug: null },
        averageRating: null,
        reviewCount: 0,
        purchaseCount: null,
        available: product.status === "active",
        owned,
        isOwnItem: product.creatorId === ctx.userId,
        downloadable: owned,
        webPath: handle ? `/${handle}` : "/m",
      },
      { headers }
    );
  }

  return apiError("Not found.", 404);
}
