import { render, screen } from "../test/render.js";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminApp } from "./AdminApp.js";

vi.mock("./components/AnalyticsView.js", () => ({
  AnalyticsView: () => <div>Analytics screen</div>,
}));

vi.mock("./components/CouponCreateView.js", () => ({
  CouponCreateView: ({ onBack }: { onBack: () => void }) => (
    <div>
      Coupon create screen
      <button type="button" onClick={onBack}>
        Back from create
      </button>
    </div>
  ),
}));

vi.mock("./components/CouponEditView.js", () => ({
  CouponEditView: ({
    couponId,
    onBack,
  }: {
    couponId: string;
    onBack: () => void;
  }) => (
    <div>
      Coupon edit screen {couponId}
      <button type="button" onClick={onBack}>
        Back from edit
      </button>
    </div>
  ),
}));

vi.mock("./components/CouponsListing.js", () => ({
  CouponsListing: ({
    onCreateCoupon,
    onOpenCoupon,
  }: {
    onCreateCoupon: () => void;
    onOpenCoupon: (couponId: string) => void;
  }) => (
    <div>
      Coupons screen
      <button type="button" onClick={onCreateCoupon}>
        Create coupon
      </button>
      <button type="button" onClick={() => onOpenCoupon("coupon-1")}>
        Open coupon
      </button>
    </div>
  ),
}));

vi.mock("./components/OrderDetailView.js", () => ({
  OrderDetailView: ({
    onBack,
    orderNumber,
  }: {
    onBack: () => void;
    orderNumber: string;
  }) => (
    <div>
      Order detail screen {orderNumber}
      <button type="button" onClick={onBack}>
        Back from order
      </button>
    </div>
  ),
}));

vi.mock("./components/OrdersListing.js", () => ({
  OrdersListing: ({
    onOpenOrder,
  }: {
    onOpenOrder: (orderNumber: string) => void;
  }) => (
    <div>
      Orders screen
      <button type="button" onClick={() => onOpenOrder("AF-2026-00001")}>
        Open order
      </button>
    </div>
  ),
}));

describe("AdminApp", () => {
  it("defaults the App SDK shell to orders and navigates between top-level areas", async () => {
    const user = userEvent.setup();

    window.history.replaceState(null, "", "/");
    render(<AdminApp />);

    expect(screen.getByText("Orders screen")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/orders");

    await user.click(screen.getByRole("tab", { name: /Kupony/ }));
    expect(screen.getByText("Coupons screen")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/coupons");

    await user.click(screen.getByRole("tab", { name: /Analityka/ }));
    expect(screen.getByText("Analytics screen")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/analytics");
  });

  it("routes to order and coupon details through callback navigation", async () => {
    const user = userEvent.setup();

    window.history.replaceState(null, "", "/orders");
    render(<AdminApp />);

    await user.click(screen.getByRole("button", { name: "Open order" }));
    expect(
      screen.getByText("Order detail screen AF-2026-00001"),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/orders/AF-2026-00001");

    await user.click(screen.getByRole("button", { name: "Back from order" }));
    await user.click(screen.getByRole("tab", { name: /Kupony/ }));
    await user.click(screen.getByRole("button", { name: "Create coupon" }));
    expect(screen.getByText("Coupon create screen")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/coupons/new");

    await user.click(screen.getByRole("button", { name: "Back from create" }));
    await user.click(screen.getByRole("button", { name: "Open coupon" }));
    expect(screen.getByText("Coupon edit screen coupon-1")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/coupons/coupon-1");
  });
});
