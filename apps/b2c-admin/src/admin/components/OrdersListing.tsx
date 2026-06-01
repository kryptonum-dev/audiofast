import { RefreshIcon } from "@sanity/icons";
import { Box, Button, Flex, Text } from "@sanity/ui";
import { useAuthToken } from "@sanity/sdk-react";
import { useEffect, useState } from "react";

import { getAdminErrorMessage, fetchAdminOrders } from "../api.js";
import type { AdminOrdersResult, OrdersFilters } from "../types.js";
import { AdminStateCard } from "./AdminStateCard.js";
import {
  DEFAULT_ORDERS_FILTERS,
  OrdersFilters as OrdersFiltersControls,
} from "./OrdersFilters.js";
import { OrdersLoadingTable } from "./OrdersLoadingTable.js";
import { OrdersPagination } from "./OrdersPagination.js";
import { OrdersTable } from "./OrdersTable.js";

const ORDERS_PER_PAGE = 15;

type OrdersState =
  | {
      status: "idle" | "loading";
      data: AdminOrdersResult | null;
      error: null;
    }
  | {
      status: "ready";
      data: AdminOrdersResult;
      error: null;
    }
  | {
      status: "error";
      data: AdminOrdersResult | null;
      error: string;
    };

type OrdersListingProps = {
  onOpenOrder: (orderNumber: string) => void;
};

export function OrdersListing({ onOpenOrder }: OrdersListingProps) {
  const authToken = useAuthToken();
  const [filters, setFilters] = useState<OrdersFilters>(DEFAULT_ORDERS_FILTERS);
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [ordersState, setOrdersState] = useState<OrdersState>({
    status: "idle",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!authToken) {
      setOrdersState({
        status: "idle",
        data: null,
        error: null,
      });
      return;
    }

    const controller = new AbortController();

    setOrdersState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));

    fetchAdminOrders({
      authToken,
      filters,
      page,
      limit: ORDERS_PER_PAGE,
      signal: controller.signal,
    })
      .then((data) => {
        setOrdersState({
          status: "ready",
          data,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setOrdersState((current) => ({
          status: "error",
          data: current.data,
          error: getAdminErrorMessage(
            error,
            "Nie udało się załadować zamówień.",
          ),
        }));
      });

    return () => controller.abort();
  }, [authToken, filters, page, refreshToken]);

  function updateFilters(nextFilters: OrdersFilters) {
    setFilters(nextFilters);
    setPage(1);
  }

  function resetFilters() {
    setFilters(DEFAULT_ORDERS_FILTERS);
    setPage(1);
  }

  if (!authToken) {
    return (
      <AdminStateCard
        heading="Łączenie z sesją Sanity"
        description="Panel zamówień uruchomi się po otrzymaniu aktywnego tokenu operatora."
        loading
      />
    );
  }

  const data = ordersState.data;

  return (
    <Box>
      <OrdersFiltersControls
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      <Box paddingX={3} paddingBottom={3}>
        <Flex align="center" justify="space-between" wrap="wrap">
          <Text muted size={1}>
            {data && ordersState.status !== "loading"
              ? `${data.pagination.totalCount} zamówień`
              : "Lista zamówień"}
          </Text>
          <Button
            icon={RefreshIcon}
            mode="ghost"
            onClick={() => setRefreshToken((value) => value + 1)}
            padding={2}
            text="Odśwież"
            type="button"
          />
        </Flex>
      </Box>

      {ordersState.status === "error" ? (
        <AdminStateCard
          action={
            <Button
              icon={RefreshIcon}
              onClick={() => setRefreshToken((value) => value + 1)}
              text="Spróbuj ponownie"
              tone="primary"
              type="button"
            />
          }
          heading="Nie udało się załadować zamówień"
          description={ordersState.error}
          tone="critical"
        />
      ) : null}

      {ordersState.status === "loading" ? (
        <>
          <OrdersLoadingTable />
          {data ? (
            <OrdersPagination
              disabled
              pagination={data.pagination}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : null}

      {ordersState.status !== "loading" && data && data.orders.length === 0 ? (
        <AdminStateCard
          heading="Brak zamówień"
          description="Nie znaleziono zamówień dla wybranych filtrów."
        />
      ) : null}

      {ordersState.status !== "loading" && data && data.orders.length > 0 ? (
        <>
          <OrdersTable orders={data.orders} onOpenOrder={onOpenOrder} />
          <OrdersPagination
            pagination={data.pagination}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </Box>
  );
}
