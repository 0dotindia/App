import { resolveApiRequest, requireScope, apiError } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { fetchAllMarketplaceCategories, fetchMarketplaceCategory, type MarketplaceBrowseCategory } from "@/lib/marketplace-browse";

const CATEGORIES = new Set<MarketplaceBrowseCategory>(["course", "digital_product", "freelance_service", "theme", "template", "app"]);

// Reuses marketplace-browse.ts's query-time union across Course/
// DigitalProduct/Offering(freelance)/MarketplaceListing wholesale — the
// same lib /m and the web search "Marketplace" tab already share, so
// mobile gets the real six-category marketplace, not just the raw
// MarketplaceListing table's three (theme/template/app). This route is
// browse-only: listing/digital-product detail is GET ./[category]/[id],
// course detail is the profile courses route, and buying any of the three
// is POST /api/v1/wallet/purchases. Freelance services stay a browser
// hand-off via their `href`.
export async function GET(request: Request) {
  const ctx = await resolveApiRequest(request);
  if ("error" in ctx) return apiError(ctx.error, ctx.status);

  const scopeError = requireScope(ctx, "marketplace:read");
  if (scopeError) return apiError(scopeError.error, scopeError.status);

  const { allowed, limit, remaining } = await checkApiRateLimit(ctx.appId);
  if (!allowed) return apiError("Rate limit exceeded.", 429);

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const categoryRaw = url.searchParams.get("category");
  const category = categoryRaw && CATEGORIES.has(categoryRaw as MarketplaceBrowseCategory) ? (categoryRaw as MarketplaceBrowseCategory) : null;

  const items = category ? await fetchMarketplaceCategory(category, q) : await fetchAllMarketplaceCategories(q);

  return Response.json(
    {
      items: items.map((item) => ({
        category: item.category,
        categoryLabel: item.categoryLabel,
        id: item.id,
        href: item.href,
        title: item.title,
        subtitle: item.subtitle,
        priceLabel: item.priceLabel,
      })),
    },
    { headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) } }
  );
}
