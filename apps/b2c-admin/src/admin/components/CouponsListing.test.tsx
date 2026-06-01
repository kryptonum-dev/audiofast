import { render, screen } from "../../test/render.js";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CouponsListing } from "./CouponsListing.js";
import type { AdminCoupon, AdminCouponsResult } from "../types.js";

const mocks = vi.hoisted(() => ({
  archiveAdminCoupon: vi.fn(),
  fetchAdminCoupons: vi.fn(),
  useAuthToken: vi.fn(),
}));

vi.mock("@sanity/sdk-react", () => ({
  useAuthToken: mocks.useAuthToken,
}));

vi.mock("../api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api.js")>();

  return {
    ...actual,
    archiveAdminCoupon: mocks.archiveAdminCoupon,
    fetchAdminCoupons: mocks.fetchAdminCoupons,
  };
});

const COUPON: AdminCoupon = {
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
  updatedAt: "2026-05-02T00:00:00.000Z",
  usageCount: 1,
  usageLimit: 5,
};

const COUPONS_RESULT: AdminCouponsResult = {
  coupons: [COUPON],
  pagination: {
    cursor: null,
    currentPage: 1,
    limit: 15,
    nextCursor: null,
    pageSize: 15,
    total: 1,
    totalCount: 1,
    totalPages: 1,
  },
};

describe("CouponsListing", () => {
  it("waits for a Sanity token before loading coupons", () => {
    mocks.useAuthToken.mockReturnValue(null);

    render(<CouponsListing onCreateCoupon={vi.fn()} onOpenCoupon={vi.fn()} />);

    expect(screen.getByText("Łączenie z sesją Sanity")).toBeInTheDocument();
    expect(mocks.fetchAdminCoupons).not.toHaveBeenCalled();
  });

  it("loads coupons and exposes create/edit actions", async () => {
    const user = userEvent.setup();
    const onCreateCoupon = vi.fn();
    const onOpenCoupon = vi.fn();

    mocks.useAuthToken.mockReturnValue("sanity-token");
    mocks.fetchAdminCoupons.mockResolvedValueOnce(COUPONS_RESULT);

    render(
      <CouponsListing
        onCreateCoupon={onCreateCoupon}
        onOpenCoupon={onOpenCoupon}
      />,
    );

    expect(await screen.findByText("AUDIO100")).toBeInTheDocument();
    expect(screen.getByText("1 kuponów")).toBeInTheDocument();
    expect(mocks.fetchAdminCoupons).toHaveBeenCalledWith(
      expect.objectContaining({
        authToken: "sanity-token",
        limit: 15,
        page: 1,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Nowy kupon" }));
    expect(onCreateCoupon).toHaveBeenCalled();

    await user.click(
      screen.getAllByRole("button", { name: "Edytuj kupon AUDIO100" })[1]!,
    );
    expect(onOpenCoupon).toHaveBeenCalledWith("coupon-1");
  });

  it("asks for confirmation before archiving a coupon", async () => {
    const user = userEvent.setup();

    mocks.useAuthToken.mockReturnValue("sanity-token");
    mocks.fetchAdminCoupons.mockResolvedValue(COUPONS_RESULT);
    mocks.archiveAdminCoupon.mockResolvedValue(COUPON);

    render(<CouponsListing onCreateCoupon={vi.fn()} onOpenCoupon={vi.fn()} />);

    await screen.findByText("AUDIO100");
    await user.click(
      screen.getByRole("button", { name: "Usuń kupon AUDIO100" }),
    );

    expect(screen.getByText("Usunąć kupon?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Usuń kupon" }));

    expect(mocks.archiveAdminCoupon).toHaveBeenCalledWith({
      authToken: "sanity-token",
      couponId: "coupon-1",
    });
  });
});
