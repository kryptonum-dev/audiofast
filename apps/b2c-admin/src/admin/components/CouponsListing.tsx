import { AddIcon, RefreshIcon } from "@sanity/icons";
import { Box, Button, Flex, Text } from "@sanity/ui";
import { useAuthToken } from "@sanity/sdk-react";
import { useEffect, useState } from "react";

import { AdminApiError, fetchAdminCoupons } from "../api.js";
import type { AdminCouponsResult, CouponsFilters } from "../types.js";
import { AdminLoadingTable } from "./AdminLoadingTable.js";
import { AdminPagination } from "./AdminPagination.js";
import { AdminStateCard } from "./AdminStateCard.js";
import {
  DEFAULT_COUPONS_FILTERS,
  CouponsFilters as CouponsFiltersControls,
} from "./CouponsFilters.js";
import { CouponsTable } from "./CouponsTable.js";

const COUPONS_PER_PAGE = 15;

type CouponsState =
  | {
      status: "idle" | "loading";
      data: AdminCouponsResult | null;
      error: null;
    }
  | {
      status: "ready";
      data: AdminCouponsResult;
      error: null;
    }
  | {
      status: "error";
      data: AdminCouponsResult | null;
      error: string;
    };

type CouponsListingProps = {
  onCreateCoupon: () => void;
};

export function CouponsListing({ onCreateCoupon }: CouponsListingProps) {
  const authToken = useAuthToken();
  const [filters, setFilters] = useState<CouponsFilters>(
    DEFAULT_COUPONS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [couponsState, setCouponsState] = useState<CouponsState>({
    status: "idle",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!authToken) {
      setCouponsState({
        status: "idle",
        data: null,
        error: null,
      });
      return;
    }

    const controller = new AbortController();

    setCouponsState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));

    fetchAdminCoupons({
      authToken,
      filters,
      page,
      limit: COUPONS_PER_PAGE,
      signal: controller.signal,
    })
      .then((data) => {
        setCouponsState({
          status: "ready",
          data,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setCouponsState((current) => ({
          status: "error",
          data: current.data,
          error:
            error instanceof AdminApiError || error instanceof Error
              ? error.message
              : "Nie udało się załadować kuponów.",
        }));
      });

    return () => controller.abort();
  }, [authToken, filters, page, refreshToken]);

  function updateFilters(nextFilters: CouponsFilters) {
    setFilters(nextFilters);
    setPage(1);
  }

  function resetFilters() {
    setFilters(DEFAULT_COUPONS_FILTERS);
    setPage(1);
  }

  if (!authToken) {
    return (
      <AdminStateCard
        heading="Łączenie z sesją Sanity"
        description="Panel kuponów uruchomi się po otrzymaniu aktywnego tokenu operatora."
        loading
      />
    );
  }

  const data = couponsState.data;

  return (
    <Box>
      <CouponsFiltersControls
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      <Box paddingX={3} paddingBottom={3}>
        <Flex align="center" justify="space-between" wrap="wrap">
          <Text muted size={1}>
            {data && couponsState.status !== "loading"
              ? `${data.pagination.totalCount} kuponów`
              : "Lista kuponów"}
          </Text>
          <Flex gap={2} wrap="wrap">
            <Button
              icon={AddIcon}
              mode="ghost"
              onClick={onCreateCoupon}
              padding={2}
              text="Nowy kupon"
              type="button"
            />
            <Button
              icon={RefreshIcon}
              mode="ghost"
              onClick={() => setRefreshToken((value) => value + 1)}
              padding={2}
              text="Odśwież"
              type="button"
            />
          </Flex>
        </Flex>
      </Box>

      {couponsState.status === "error" ? (
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
          heading="Nie udało się załadować kuponów"
          description={couponsState.error}
          tone="critical"
        />
      ) : null}

      {couponsState.status === "loading" ? (
        <>
          <AdminLoadingTable />
          {data ? (
            <AdminPagination
              disabled
              itemLabel="kuponów"
              pagination={data.pagination}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : null}

      {couponsState.status !== "loading" &&
      data &&
      data.coupons.length === 0 ? (
        <AdminStateCard
          heading="Brak kuponów"
          description="Nie znaleziono kuponów dla wybranych filtrów."
        />
      ) : null}

      {couponsState.status !== "loading" && data && data.coupons.length > 0 ? (
        <>
          <CouponsTable coupons={data.coupons} />
          <AdminPagination
            itemLabel="kuponów"
            pagination={data.pagination}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </Box>
  );
}
