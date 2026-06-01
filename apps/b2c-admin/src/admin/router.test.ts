import { describe, expect, it } from "vitest";

import {
  getAnalyticsPath,
  getCouponCreatePath,
  getCouponEditPath,
  getCouponsPath,
  getOrderDetailPath,
  getOrdersPath,
  parseAdminRoute,
} from "./router.js";

describe("admin router", () => {
  it("maps top-level admin paths to the expected screens", () => {
    expect(parseAdminRoute("/")).toEqual({ screen: "orders" });
    expect(parseAdminRoute("/orders")).toEqual({ screen: "orders" });
    expect(parseAdminRoute("/coupons")).toEqual({ screen: "coupons" });
    expect(parseAdminRoute("/analytics")).toEqual({ screen: "analytics" });
  });

  it("parses detail paths with decoded identifiers", () => {
    expect(parseAdminRoute("/orders/AF-2026-00001")).toEqual({
      screen: "orderDetail",
      orderNumber: "AF-2026-00001",
    });
    expect(parseAdminRoute("/coupons/AUDIO%20100")).toEqual({
      screen: "couponEdit",
      couponId: "AUDIO 100",
    });
    expect(parseAdminRoute("/coupons/new")).toEqual({ screen: "couponCreate" });
  });

  it("generates stable App SDK paths", () => {
    expect(getOrdersPath()).toBe("/orders");
    expect(getCouponsPath()).toBe("/coupons");
    expect(getAnalyticsPath()).toBe("/analytics");
    expect(getCouponCreatePath()).toBe("/coupons/new");
    expect(getCouponEditPath("AUDIO 100")).toBe("/coupons/AUDIO%20100");
    expect(getOrderDetailPath("AF-2026-00001")).toBe("/orders/AF-2026-00001");
  });
});
