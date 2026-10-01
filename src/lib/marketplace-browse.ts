import "server-only";
import { db } from "@/lib/db";
import { formatCoins } from "@/lib/coins";

// phase-9 spec §6.1: a query-time union across Course/DigitalProduct/
// Offering(freelance)/MarketplaceListing, not a master table — each
// fetcher below queries its own source-of-truth table directly. Shared
// here (rather than duplicated between /m and the search "Marketplace"
// tab, §6.3) purely to avoid writing the same six queries twice; there is
// still no unified schema/table backing this, satisfying §6.4's literal
// acceptance criterion.
export type MarketplaceBrowseCategory =
  | "course"
  | "digital_product"
  | "freelance_service"
  | "theme"
  | "template"
  | "app";

export type MarketplaceBrowseItem = {
  category: MarketplaceBrowseCategory;
  categoryLabel: string;
  id: string;
  href: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  createdAt: Date;
};

export const BROWSE_CATEGORY_LABELS: Record<MarketplaceBrowseCategory, string> = {
  course: "Course",
  digital_product: "Digital product",
  freelance_service: "Freelance service",
  theme: "Theme",
  template: "Template",
  app: "App",
};

// Every price on 0dot is a coin price (addendum-wallet-only-payments.md
// §4.1); `currency` is a legacy column, not a display unit.
function priceLabel(price: number | null): string {
  if (price === null) return "Free";
  return formatCoins(price);
}

// spec §6.2: courses rank by sales volume (accessGrants issued), the closest
// available proxy to "engagement" for a paid-access entity — same
// engagement-tie-break shape every search rank* function already uses,
// applied via a relation-count orderBy instead of a post-fetch sort.
export async function fetchCourses(
  q: string,
  take = 20,
  skip = 0,
  orderBy: NonNullable<Parameters<typeof db.course.findMany>[0]>["orderBy"] = [
    { accessGrants: { _count: "desc" } },
    { createdAt: "desc" },
    { id: "asc" },
  ]
): Promise<MarketplaceBrowseItem[]> {
  const rows = await db.course.findMany({
    where: {
      status: "active",
      ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] } : {}),
    },
    include: { creator: { include: { username: true } }, _count: { select: { accessGrants: true } } },
    orderBy,
    take,
    skip,
  });
  return rows.flatMap((course) => {
    const handle = course.creator.username?.handle;
    if (!handle) return [];
    return [
      {
        category: "course" as const,
        categoryLabel: BROWSE_CATEGORY_LABELS.course,
        id: course.id,
        href: `/${handle}/courses/${course.id}`,
        title: course.title,
        subtitle: `by ${handle}`,
        priceLabel: course.requiredTierId ? "Included with membership" : priceLabel(course.price),
        createdAt: course.createdAt,
      },
    ];
  });
}

// spec §6.2: digital products rank by sales volume (purchase count) — same
// reasoning as courses above.
export async function fetchDigitalProducts(
  q: string,
  take = 20,
  skip = 0,
  orderBy: NonNullable<Parameters<typeof db.digitalProduct.findMany>[0]>["orderBy"] = [
    { purchases: { _count: "desc" } },
    { createdAt: "desc" },
    { id: "asc" },
  ]
): Promise<MarketplaceBrowseItem[]> {
  const rows = await db.digitalProduct.findMany({
    where: {
      status: "active",
      ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] } : {}),
    },
    include: { creator: { include: { username: true } }, _count: { select: { purchases: true } } },
    orderBy,
    take,
    skip,
  });
  return rows.flatMap((product) => {
    const handle = product.creator.username?.handle;
    if (!handle) return [];
    return [
      {
        category: "digital_product" as const,
        categoryLabel: BROWSE_CATEGORY_LABELS.digital_product,
        id: product.id,
        href: `/${handle}`,
        title: product.title,
        subtitle: `by ${handle}`,
        priceLabel: priceLabel(product.price),
        createdAt: product.createdAt,
      },
    ];
  });
}

// spec §6.2's named signal for this category is "rating and responsiveness"
// — Offering has neither (no review model of its own, see phase-9 spec
// §7.1's "second instance, not yet a generalization" reasoning for why one
// wasn't added here too). Purchase volume is the closest available proxy,
// consistent with the courses/digital-products fallback above. Only
// sellerUserId-owned rows (individual freelancers) qualify — business
// catalog Offerings are Phase 4's Store, not a Marketplace roadmap
// category (spec §5's six-category list names "Freelance services", not
// general business commerce).
export async function fetchFreelanceServices(
  q: string,
  take = 20,
  skip = 0,
  orderBy: NonNullable<Parameters<typeof db.offering.findMany>[0]>["orderBy"] = [
    { purchases: { _count: "desc" } },
    { createdAt: "desc" },
    { id: "asc" },
  ]
): Promise<MarketplaceBrowseItem[]> {
  const rows = await db.offering.findMany({
    where: {
      sellerUserId: { not: null },
      status: "active",
      ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
    },
    include: { seller: { include: { username: true } }, _count: { select: { purchases: true } } },
    orderBy,
    take,
    skip,
  });
  return rows.flatMap((offering) => {
    const handle = offering.seller?.username?.handle;
    if (!handle) return [];
    return [
      {
        category: "freelance_service" as const,
        categoryLabel: BROWSE_CATEGORY_LABELS.freelance_service,
        id: offering.id,
        href: `/${handle}/services`,
        title: offering.name,
        subtitle: `by ${handle}`,
        priceLabel: offering.price !== null ? priceLabel(offering.price) : "Contact for pricing",
        createdAt: offering.createdAt,
      },
    ];
  });
}

// spec §6.2: themes/templates rank by rating then sales volume; apps rank
// by install count — genuinely different signals per category, the
// explicit departure from one global formula this section calls for.
export async function fetchListings(
  category: "theme" | "template" | "app",
  q: string,
  take = 20,
  skip = 0,
  orderBy?: NonNullable<Parameters<typeof db.marketplaceListing.findMany>[0]>["orderBy"]
): Promise<MarketplaceBrowseItem[]> {
  const rows = await db.marketplaceListing.findMany({
    where: {
      status: "active",
      category,
      ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] } : {}),
    },
    include: {
      seller: { include: { username: true } },
      sellerBusiness: { select: { name: true, slug: true } },
      _count: { select: { installs: true } },
    },
    orderBy:
      orderBy ??
      (category === "app"
        ? [{ installs: { _count: "desc" } }, { createdAt: "desc" }, { id: "asc" }]
        : [{ averageRating: "desc" }, { purchaseCount: "desc" }, { createdAt: "desc" }, { id: "asc" }]),
    take,
    skip,
  });
  return rows.map((listing) => {
    const sellerName = listing.sellerBusiness?.name ?? listing.seller?.username?.handle ?? "Unknown seller";
    return {
      category,
      categoryLabel: BROWSE_CATEGORY_LABELS[category],
      id: listing.id,
      href: `/m/${listing.id}`,
      title: listing.title,
      subtitle: `by ${sellerName}`,
      priceLabel: priceLabel(listing.price),
      createdAt: listing.createdAt,
    };
  });
}

export async function fetchMarketplaceCategory(category: MarketplaceBrowseCategory, q: string): Promise<MarketplaceBrowseItem[]> {
  if (category === "course") return fetchCourses(q);
  if (category === "digital_product") return fetchDigitalProducts(q);
  if (category === "freelance_service") return fetchFreelanceServices(q);
  return fetchListings(category, q);
}

// The "All" view (default /m tab, and the search Marketplace tab with no
// further category filter): every category's own ranking still applies
// within itself, results are then interleaved by recency only across
// categories — a neutral default for mixing genuinely incomparable
// per-category scores (an app's install count and a course's sale count
// aren't on the same scale), not a seventh global formula.
export async function fetchAllMarketplaceCategories(q: string, take = 20): Promise<MarketplaceBrowseItem[]> {
  const [courses, digitalProducts, freelanceServices, themes, templates, apps] = await Promise.all([
    fetchCourses(q, take),
    fetchDigitalProducts(q, take),
    fetchFreelanceServices(q, take),
    fetchListings("theme", q, take),
    fetchListings("template", q, take),
    fetchListings("app", q, take),
  ]);
  return [...courses, ...digitalProducts, ...freelanceServices, ...themes, ...templates, ...apps].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id)
  );
}
