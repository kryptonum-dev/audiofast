import { render, screen } from "../../test/render.js";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CouponForm, getCouponFormValues } from "./CouponForm.js";
import type { AdminCoupon } from "../types.js";

describe("CouponForm", () => {
  it("builds a fixed-order coupon payload from operator input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onDirtyChange = vi.fn();

    render(
      <CouponForm
        enforceFutureDates={false}
        onDirtyChange={onDirtyChange}
        onSubmit={onSubmit}
        productOptions={[]}
        submitText="Zapisz kupon"
      />,
    );

    await user.type(screen.getByPlaceholderText("AUDIO100"), " AUDIO100 ");
    await user.type(screen.getByPlaceholderText("100.00"), "25.50");
    await user.type(screen.getByPlaceholderText("Bez limitu"), "4");
    await user.click(screen.getByRole("button", { name: "Zapisz kupon" }));

    expect(onSubmit).toHaveBeenCalledWith({
      code: "AUDIO100",
      discountPercent: null,
      discountType: "fixed_order",
      discountValueCents: 2550,
      expiresAt: null,
      isActive: true,
      productKeys: [],
      startsAt: null,
      usageLimit: 4,
    });
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  it("blocks product-scoped coupons until at least one product is selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CouponForm
        enforceFutureDates={false}
        onSubmit={onSubmit}
        productOptions={[]}
        submitText="Zapisz kupon"
      />,
    );

    await user.type(screen.getByPlaceholderText("AUDIO100"), "PRODUCT15");
    await user.selectOptions(screen.getByDisplayValue("Kwota na koszyk"), [
      "percent_product",
    ]);
    await user.type(screen.getByPlaceholderText("15"), "15");
    await user.click(screen.getByRole("button", { name: "Zapisz kupon" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Kupon produktowy wymaga wyboru co najmniej jednego produktu.",
      ),
    ).toBeInTheDocument();
  });

  it("maps existing coupon data back into editable form values", () => {
    const coupon: AdminCoupon = {
      code: "AUDIO100",
      createdAt: "2026-05-01T00:00:00.000Z",
      derivedStatus: "active",
      discountPercent: null,
      discountType: "fixed_product",
      discountValueCents: 1250,
      expiresAt: "2026-05-31T22:00:00.000Z",
      id: "coupon-1",
      isActive: false,
      productKeys: ["price-b", "price-a"],
      startsAt: "2026-05-10T08:30:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      usageCount: 2,
      usageLimit: 5,
    };

    expect(getCouponFormValues(coupon)).toMatchObject({
      code: "AUDIO100",
      discountType: "fixed_product",
      discountValuePln: "12.50",
      discountPercent: "",
      isActive: false,
      selectedProductKeys: ["price-b", "price-a"],
      usageLimit: "5",
    });
  });
});
