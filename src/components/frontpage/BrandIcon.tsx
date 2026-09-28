import { BRAND_ICONS } from "@/components/frontpage/brand-icons";
import type { SocialPlatform } from "@/lib/landing-content";

// An official brand mark (brand-icons.ts). Colored with the brand's own hex
// via --brand; the .fpBrandMono class (front-page.css) swaps the black
// marks (X, Threads, GitHub) to the ink color so they survive dark mode.
const MONO = new Set(["#000000", "#181717"]);

export function BrandIcon({ platform, size = 24, className }: { platform: SocialPlatform; size?: number; className?: string }) {
  const { path, hex } = BRAND_ICONS[platform];
  return (
    <svg
      className={["fpBrandIcon", MONO.has(hex) && "fpBrandMono", className].filter(Boolean).join(" ")}
      style={{ "--brand": hex } as React.CSSProperties}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
