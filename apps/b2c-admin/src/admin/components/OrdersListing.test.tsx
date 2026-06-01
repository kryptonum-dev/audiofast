import { render, screen } from "../../test/render.js";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OrdersListing } from "./OrdersListing.js";
import type { AdminOrdersResult } from "../types.js";

const mocks = vi.hoisted(() => ({
  fetchAdminOrders: vi.fn(),
  useAuthToken: vi.fn(),
}));

vi.mock("@sanity/sdk-react", () => ({
  useAuthToken: mocks.useAuthToken,
}));

vi.mock("../api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api.js")>();

  return {
    ...actual,
    fetchAdminOrders: mocks.fetchAdminOrders,
  };
});

const ORDERS_RESULT: AdminOrdersResult = {
  filters: {},
  orders: [
    {
      createdAt: "2026-05-07T08:00:00.000Z",
      currentStatus: "paid",
      customer: {
        displayName: "Anna Kowalska",
        email: "anna@example.com",
        phone: null,
      },
      discountTotalCents: 1000,
      grandTotalCents: 9900,
      hasOpenCancellationRequest: true,
      hasOpenReturnCase: false,
      id: "order-1",
      invoice: {
        attachedAt: null,
        filename: null,
        hasInvoice: false,
        recipientType: "private",
      },
      itemSummary: {
        containsCpo: true,
        leadItem: {
          brandName: "Audiofast",
          productImage: null,
          productName: "Kurs testowy",
        },
        lineTypes: ["standard", "cpo"],
        totalItemCount: 2,
      },
      orderNumber: "AF-2026-00001",
      paidAt: "2026-05-07T08:10:00.000Z",
      payableUntil: "2026-05-07T08:15:00.000Z",
      shipment: {
        carrier: null,
        hasShipment: false,
        shippedAt: null,
        trackingNumber: null,
      },
    },
  ],
  pagination: {
    currentPage: 1,
    limit: 15,
    nextPage: null,
    page: 1,
    pageSize: 15,
    previousPage: null,
    totalCount: 1,
    totalPages: 1,
  },
};

describe("OrdersListing", () => {
  it("waits for a Sanity token before loading orders", () => {
    mocks.useAuthToken.mockReturnValue(null);

    render(<OrdersListing onOpenOrder={vi.fn()} />);

    expect(screen.getByText("Łączenie z sesją Sanity")).toBeInTheDocument();
    expect(mocks.fetchAdminOrders).not.toHaveBeenCalled();
  });

  it("loads orders and opens the selected order", async () => {
    const user = userEvent.setup();
    const onOpenOrder = vi.fn();

    mocks.useAuthToken.mockReturnValue("sanity-token");
    mocks.fetchAdminOrders.mockResolvedValueOnce(ORDERS_RESULT);

    render(<OrdersListing onOpenOrder={onOpenOrder} />);

    expect(await screen.findByText("AF-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Anna Kowalska")).toBeInTheDocument();
    expect(screen.getAllByText("Anulowanie").length).toBeGreaterThan(0);
    expect(mocks.fetchAdminOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        authToken: "sanity-token",
        limit: 15,
        page: 1,
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "Otwórz zamówienie AF-2026-00001" }),
    );

    expect(onOpenOrder).toHaveBeenCalledWith("AF-2026-00001");
  });

  it("renders the empty state for a successful empty result", async () => {
    mocks.useAuthToken.mockReturnValue("sanity-token");
    mocks.fetchAdminOrders.mockResolvedValueOnce({
      ...ORDERS_RESULT,
      orders: [],
      pagination: {
        ...ORDERS_RESULT.pagination,
        totalCount: 0,
      },
    });

    render(<OrdersListing onOpenOrder={vi.fn()} />);

    expect(await screen.findByText("Brak zamówień")).toBeInTheDocument();
  });

  it("does not show raw browser fetch errors", async () => {
    mocks.useAuthToken.mockReturnValue("sanity-token");
    mocks.fetchAdminOrders.mockRejectedValueOnce(new Error("Failed to fetch"));

    render(<OrdersListing onOpenOrder={vi.fn()} />);

    expect(
      await screen.findByText("Nie udało się załadować zamówień."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });
});
