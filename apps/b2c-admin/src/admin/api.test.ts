import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AdminApiError,
  createAdminCoupon,
  fetchAdminAnalytics,
  fetchAdminCoupons,
  fetchAdminOrders,
  updateAdminOrderStatus,
} from "./api.js";
import type {
  AdminAnalyticsResult,
  AdminCoupon,
  AdminCouponsResult,
  AdminOrdersResult,
} from "./types.js";

const API_ORIGIN = "https://audiofast-git-b2c-kryptonum.vercel.app";

function okResponse<TData>(data: TData) {
  return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
}

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, error: "bad_request", message }),
    { status },
  );
}

function fetchMock() {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("admin API client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the deployed API origin for analytics without a double slash", async () => {
    const mock = fetchMock();
    const analytics: AdminAnalyticsResult = {
      period: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z",
        groupBy: "week",
      },
      revenue: {
        averageOrderValueCents: 10000,
        countingMode: "paid_orders_excluding_cancelled_and_returned",
        discountTotalCents: 1000,
        grossPaidRevenueCents: 30000,
        paidOrderCount: 3,
        revenueCents: 20000,
        revenueOrderCount: 2,
      },
      series: [],
      statusCounts: [],
    };

    mock.mockResolvedValueOnce(okResponse(analytics));

    await expect(
      fetchAdminAnalytics({
        authToken: "token-1",
        filters: {
          dateRange: { from: "2026-05-01", to: "2026-05-31" },
          groupBy: "week",
        },
      }),
    ).resolves.toEqual(analytics);

    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.origin).toBe(API_ORIGIN);
    expect(parsed.pathname).toBe("/api/admin/analytics/");
    expect(url).not.toContain(".app//api");
    expect(parsed.searchParams.get("groupBy")).toBe("week");
    expect(parsed.searchParams.get("from")).toBe(
      new Date("2026-05-01T00:00:00").toISOString(),
    );
    expect(parsed.searchParams.get("to")).toBe(
      new Date("2026-05-31T23:59:59.999").toISOString(),
    );
    expect(init.headers).toEqual({ Authorization: "Bearer token-1" });
  });

  it("serializes order filters and preserves the admin bearer token", async () => {
    const mock = fetchMock();
    const orders: AdminOrdersResult = {
      orders: [],
      filters: {},
      pagination: {
        currentPage: 2,
        limit: 15,
        nextPage: null,
        page: 2,
        pageSize: 15,
        previousPage: 1,
        totalCount: 0,
        totalPages: 1,
      },
    };

    mock.mockResolvedValueOnce(okResponse(orders));

    await fetchAdminOrders({
      authToken: "orders-token",
      page: 2,
      limit: 15,
      filters: {
        search: " AF-2026 ",
        status: "paid",
        lineType: "mixed",
        operations: "return",
        dateRange: { from: "2026-05-01", to: "2026-05-02" },
      },
    });

    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/api/admin/orders/");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("limit")).toBe("15");
    expect(parsed.searchParams.get("q")).toBe("AF-2026");
    expect(parsed.searchParams.get("status")).toBe("paid");
    expect(parsed.searchParams.get("lineType")).toBe("mixed");
    expect(parsed.searchParams.get("hasOpenReturnCase")).toBe("true");
    expect(init.headers).toEqual({ Authorization: "Bearer orders-token" });
  });

  it("normalizes coupon pagination returned by the backend", async () => {
    const mock = fetchMock();
    const coupon: AdminCoupon = {
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
    const result: AdminCouponsResult = {
      coupons: [coupon],
      pagination: {
        cursor: null,
        currentPage: 0,
        limit: 15,
        nextCursor: null,
        pageSize: 0,
        total: 31,
        totalCount: 0,
        totalPages: 0,
      },
    };

    mock.mockResolvedValueOnce(okResponse(result));

    await expect(
      fetchAdminCoupons({
        authToken: "coupon-token",
        page: 3,
        limit: 15,
        filters: {
          discountType: "fixed_order",
          search: "audio",
          status: "active",
        },
      }),
    ).resolves.toMatchObject({
      pagination: {
        currentPage: 3,
        pageSize: 15,
        totalCount: 31,
        totalPages: 3,
      },
    });

    const [url] = mock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.searchParams.get("cursor")).toBe("30");
    expect(parsed.searchParams.get("q")).toBe("audio");
    expect(parsed.searchParams.get("derivedStatus")).toBe("active");
    expect(parsed.searchParams.get("discountType")).toBe("fixed_order");
  });

  it("sends JSON mutations to coupon and order route families", async () => {
    const mock = fetchMock();
    const coupon: AdminCoupon = {
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

    mock
      .mockResolvedValueOnce(okResponse(coupon))
      .mockResolvedValueOnce(okResponse({ orderNumber: "AF-2026/00001" }));

    await createAdminCoupon({
      authToken: "coupon-token",
      input: {
        code: "AUDIO100",
        discountPercent: null,
        discountType: "fixed_order",
        discountValueCents: 10000,
        expiresAt: null,
        isActive: true,
        productKeys: [],
        startsAt: null,
        usageLimit: null,
      },
    });
    await updateAdminOrderStatus({
      authToken: "order-token",
      orderNumber: "AF-2026/00001",
      status: "processing",
      note: "Pakowanie",
    });

    const [, createInit] = mock.mock.calls[0] as [string, RequestInit];
    const [statusUrl, statusInit] = mock.mock.calls[1] as [string, RequestInit];

    expect(createInit.method).toBe("POST");
    expect(createInit.headers).toEqual({
      Authorization: "Bearer coupon-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(createInit.body as string)).toMatchObject({
      code: "AUDIO100",
      discountValueCents: 10000,
    });
    expect(new URL(statusUrl).pathname).toBe(
      "/api/admin/orders/AF-2026%2F00001/status/",
    );
    expect(statusInit.method).toBe("POST");
    expect(JSON.parse(statusInit.body as string)).toEqual({
      note: "Pakowanie",
      status: "processing",
    });
  });

  it("throws the backend envelope message when a route fails", async () => {
    const mock = fetchMock();

    mock.mockResolvedValueOnce(errorResponse("Operator nie ma dostępu.", 403));

    await expect(
      fetchAdminAnalytics({
        authToken: "bad-token",
        filters: {
          dateRange: { from: "", to: "" },
          groupBy: "day",
        },
      }),
    ).rejects.toEqual(new AdminApiError("Operator nie ma dostępu."));
  });
});
