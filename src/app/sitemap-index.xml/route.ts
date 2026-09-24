import { SITEMAP_IDS } from "@/lib/sitemap-ids";

// Sitemap index, served at /sitemap.xml via the beforeFiles rewrite in
// next.config.ts (a route handler can't live at /sitemap.xml itself — it
// collides with sitemap.ts's metadata route). That's the default location
// crawlers and Search Console probe. See sitemap-ids.ts.
export function GET() {
  const entries = SITEMAP_IDS.map((id) => `  <sitemap><loc>https://0dot.in/sitemap/${id}.xml</loc></sitemap>`).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
