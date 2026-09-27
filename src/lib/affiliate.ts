import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { AffiliateAttribution } from "@/lib/wallet/charge";

// spec §7.2: last-click within 30 days. Relying on the cookie's own Max-Age
// to expire is what actually implements "within 30 days" here — once the
// browser drops the cookie, there's nothing left to attribute to, so no
// separate clickedAt-vs-now comparison is needed at read time.
export const AFFILIATE_COOKIE_NAME = "aff";
export const AFFILIATE_ATTRIBUTION_WINDOW_S = 30 * 24 * 60 * 60;

// spec §7.3: attribution is last-click, applied consistently — whichever
// affiliate code is in the cookie right now is the one credited, never
// first-click or all-clicks-credited (that's what avoids double-counted
// commission across multiple affiliates promoting the same sale).
export async function getAttributedAffiliateLink(
  offeringType: string,
  offeringId: string,
  excludeUserId: string
) {
  const store = await cookies();
  const code = store.get(AFFILIATE_COOKIE_NAME)?.value;
  if (!code) return null;

  const link = await db.affiliateLink.findUnique({
    where: { code },
    include: { program: true },
  });
  if (!link) return null;
  if (link.program.status !== "active") return null;
  if (link.program.offeringType !== offeringType || link.program.offeringId !== offeringId) return null;
  if (link.affiliateId === excludeUserId) return null; // no self-referral credit

  return link;
}


// addendum-wallet-only-payments.md §8 #3: the attribution chargeWallet
// needs to pay a coin commission on this sale, or null.
export async function getAffiliateAttribution(
  offeringType: string,
  offeringId: string,
  buyerId: string
): Promise<AffiliateAttribution | null> {
  const link = await getAttributedAffiliateLink(offeringType, offeringId, buyerId);
  return link ? { linkId: link.id, affiliateId: link.affiliateId, commissionPercent: link.program.commissionPercent } : null;
}
