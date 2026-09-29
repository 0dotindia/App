jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(() => Promise.resolve()) }));

import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { openMarketplaceItem } from "../openMarketplaceItem";
import type { MarketplaceItem } from "../../api/types";

const base = { categoryLabel: "", title: "t", subtitle: "", priceLabel: "" };

describe("openMarketplaceItem", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens listings and digital products on the native detail screen", () => {
    openMarketplaceItem({ ...base, category: "template", id: "l1", href: "/m/l1" } as MarketplaceItem);
    openMarketplaceItem({ ...base, category: "digital_product", id: "p1", href: "/amit" } as MarketplaceItem);
    expect(router.push).toHaveBeenCalledWith({ pathname: "/marketplace/[category]/[id]", params: { category: "template", id: "l1" } });
    expect(router.push).toHaveBeenCalledWith({ pathname: "/marketplace/[category]/[id]", params: { category: "digital_product", id: "p1" } });
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it("opens a course on the native course screen", () => {
    openMarketplaceItem({ ...base, category: "course", id: "c1", href: "/amit/courses/c1" } as MarketplaceItem);
    expect(router.push).toHaveBeenCalledWith({ pathname: "/[username]/courses/[courseId]", params: { username: "amit", courseId: "c1" } });
  });

  it("hands freelance services to the browser", () => {
    openMarketplaceItem({ ...base, category: "freelance_service", id: "o1", href: "/amit/services" } as MarketplaceItem);
    expect(router.push).not.toHaveBeenCalled();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringMatching(/\/amit\/services$/));
  });
});
