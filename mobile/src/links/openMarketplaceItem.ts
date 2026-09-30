import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { API_BASE_URL } from "../config";
import type { MarketplaceCategory, MarketplaceItem } from "../api/types";

const NATIVE_DETAIL_CATEGORIES = new Set<MarketplaceCategory>(["theme", "template", "app", "digital_product"]);

// Shared by the Marketplace screen and Explore's marketplace search tab.
// Listings and digital products open the native detail screen (buy with
// coins there); courses open the existing native course screen, whose
// browse href `/<handle>/courses/<id>` already matches its route. Freelance
// services are a booking, not a purchase, and stay a browser hand-off.
export function openMarketplaceItem(item: MarketplaceItem): void {
  if (NATIVE_DETAIL_CATEGORIES.has(item.category)) {
    router.push({ pathname: "/marketplace/[category]/[id]", params: { category: item.category, id: item.id } });
    return;
  }
  const course = item.category === "course" ? item.href.match(/^\/([^/]+)\/courses\/([^/]+)$/) : null;
  if (course) {
    router.push({ pathname: "/[username]/courses/[courseId]", params: { username: course[1], courseId: course[2] } });
    return;
  }
  WebBrowser.openBrowserAsync(`${API_BASE_URL}${item.href}`).catch(() => {});
}
