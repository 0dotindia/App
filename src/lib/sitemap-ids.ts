// Single source of truth for the sub-sitemap ids: sitemap.ts serves each at
// /sitemap/{id}.xml, robots.ts lists them, and /sitemap.xml (route.ts) indexes
// them. Next.js doesn't generate a /sitemap.xml index when generateSitemaps is
// in use, so without that route crawlers probing the default path get a 404.
export const SITEMAP_IDS = ["static", "profiles", "businesses", "communities", "events", "jobs", "marketplace"] as const;
