import { render, screen, waitFor } from "../../test/render.js";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AdminApiError } from "../api.js";
import { AnalyticsView } from "./AnalyticsView.js";
import type { AdminAnalyticsResult } from "../types.js";

const mocks = vi.hoisted(() => ({
  fetchAdminAnalytics: vi.fn(),
  useAuthToken: vi.fn(),
}));

vi.mock("@sanity/sdk-react", () => ({
  useAuthToken: mocks.useAuthToken,
}));

vi.mock("../api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api.js")>();

  return {
    ...actual,
    fetchAdminAnalytics: mocks.fetchAdminAnalytics,
  };
});

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const ANALYTICS_RESULT: AdminAnalyticsResult = {
  period: {
    from: "2026-05-01T00:00:00.000Z",
    to: "2026-05-31T23:59:59.999Z",
    groupBy: "day",
  },
  revenue: {
    averageOrderValueCents: 10000,
    countingMode: "paid_orders_excluding_cancelled_and_returned",
    discountTotalCents: 1500,
    grossPaidRevenueCents: 24500,
    paidOrderCount: 3,
    revenueCents: 20000,
    revenueOrderCount: 2,
  },
  series: [
    {
      digitalSalesCount: 3,
      discountTotalCents: 1500,
      grossPaidRevenueCents: 24500,
      label: "2026-05-06",
      paidOrderCount: 2,
      revenueCents: 20000,
    },
  ],
  statusCounts: [{ status: "paid", count: 2 }],
};

describe("AnalyticsView", () => {
  it("waits for a Sanity auth token before loading analytics", () => {
    mocks.useAuthToken.mockReturnValue(null);

    render(<AnalyticsView />);

    expect(screen.getByText("Łączenie z sesją Sanity")).toBeInTheDocument();
    expect(mocks.fetchAdminAnalytics).not.toHaveBeenCalled();
  });

  it("loads operational analytics and renders KPI cards plus chart", async () => {
    mocks.useAuthToken.mockReturnValue("sanity-token");
    mocks.fetchAdminAnalytics.mockResolvedValueOnce(ANALYTICS_RESULT);

    render(<AnalyticsView />);

    expect(await screen.findByText("Przychód w czasie")).toBeInTheDocument();
    expect(screen.getByText("Przychód")).toBeInTheDocument();
    expect(screen.getByText("Zamówienia")).toBeInTheDocument();
    expect(screen.getByText("Średnia wartość")).toBeInTheDocument();
    expect(screen.getByText("Rabaty")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(
      screen.getByText(/zamówień anulowanych i zwróconych/i),
    ).toBeInTheDocument();

    expect(mocks.fetchAdminAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        authToken: "sanity-token",
        filters: expect.objectContaining({
          groupBy: "day",
        }),
      }),
    );
  });

  it("reloads analytics when grouping changes", async () => {
    const user = userEvent.setup();
    mocks.useAuthToken.mockReturnValue("sanity-token");
    mocks.fetchAdminAnalytics
      .mockResolvedValueOnce(ANALYTICS_RESULT)
      .mockResolvedValueOnce({
        ...ANALYTICS_RESULT,
        period: { ...ANALYTICS_RESULT.period, groupBy: "month" },
      });

    render(<AnalyticsView />);
    await screen.findByText("Przychód w czasie");

    await user.selectOptions(screen.getByLabelText("Grupowanie"), "month");

    await waitFor(() =>
      expect(mocks.fetchAdminAnalytics).toHaveBeenCalledTimes(2),
    );
    expect(mocks.fetchAdminAnalytics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          groupBy: "month",
        }),
      }),
    );
  });

  it("shows the route error and keeps a retry action", async () => {
    mocks.useAuthToken.mockReturnValue("sanity-token");
    mocks.fetchAdminAnalytics.mockRejectedValueOnce(
      new AdminApiError("Could not load B2C operational analytics."),
    );

    render(<AnalyticsView />);

    expect(
      await screen.findByText("Nie udało się załadować analityki"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Could not load B2C operational analytics."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Spróbuj ponownie" }),
    ).toBeInTheDocument();
  });
});
