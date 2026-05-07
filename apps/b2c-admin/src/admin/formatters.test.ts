import { describe, expect, it } from "vitest";

import {
  formatCouponActivityWindow,
  formatCouponDiscount,
  formatCouponScope,
  formatLineType,
  formatOrderStatus,
} from "./formatters.js";
import type { AdminCoupon } from "./types.js";

const BASE_COUPON: AdminCoupon = {
  code: "AUDIO100",
  createdAt: "2026-05-01T00:00:00.000Z",
  derivedStatus: "active",
  discountPercent: null,
  discountType: "fixed_order",
  discountValueCents: 10000,
  expiresAt: null,
  id: "coupon-1",
  isActive: true,
  productKeys: [],
  startsAt: null,
  updatedAt: "2026-05-01T00:00:00.000Z",
  usageCount: 0,
  usageLimit: null,
};

describe("admin formatters", () => {
  it("formats known and unknown order statuses", () => {
    expect(formatOrderStatus("paid")).toBe("Opłacone");
    expect(formatOrderStatus("custom_status")).toBe("custom_status");
  });

  it("formats order line-type combinations", () => {
    expect(formatLineType(["standard"])).toBe("Katalogowe");
    expect(formatLineType(["cpo"])).toBe("CPO");
    expect(formatLineType(["standard", "cpo"])).toBe("Mieszane");
  });

  it("formats coupon discount, scope, and activity windows", () => {
    expect(formatCouponDiscount(BASE_COUPON)).toContain("100");
    expect(formatCouponScope(BASE_COUPON)).toBe("Cały koszyk");
    expect(formatCouponActivityWindow(BASE_COUPON)).toBe("Bez terminu");

    expect(
      formatCouponDiscount({
        ...BASE_COUPON,
        discountPercent: 15,
        discountType: "percent_product",
        discountValueCents: null,
        productKeys: ["price-a"],
      }),
    ).toBe("15%");
    expect(
      formatCouponScope({
        ...BASE_COUPON,
        discountType: "percent_product",
        productKeys: ["price-a"],
      }),
    ).toBe("Wybrane produkty");
  });
});
