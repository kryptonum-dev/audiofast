import { AddIcon, RefreshIcon } from "@sanity/icons";
import { Box, Button, Dialog, Flex, Inline, Text } from "@sanity/ui";
import { useAuthToken } from "@sanity/sdk-react";
import { useEffect, useState } from "react";

import {
  AdminApiError,
  archiveAdminCoupon,
  fetchAdminCoupons,
} from "../api.js";
import type {
  AdminCoupon,
  AdminCouponsResult,
  CouponsFilters,
} from "../types.js";
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
  onOpenCoupon: (couponId: string) => void;
};

export function CouponsListing({
  onCreateCoupon,
  onOpenCoupon,
}: CouponsListingProps) {
  const authToken = useAuthToken();
  const [filters, setFilters] = useState<CouponsFilters>(
    DEFAULT_COUPONS_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [couponToArchive, setCouponToArchive] = useState<AdminCoupon | null>(
    null,
  );
  const [couponsToBulkArchive, setCouponsToBulkArchive] = useState<
    AdminCoupon[]
  >([]);
  const [selectedCouponIds, setSelectedCouponIds] = useState<string[]>([]);
  const [archiveState, setArchiveState] = useState<{
    bulk: boolean;
    couponId: string | null;
    error: string | null;
  }>({
    bulk: false,
    couponId: null,
    error: null,
  });
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

  useEffect(() => {
    const visibleCouponIds = new Set(
      couponsState.data?.coupons.map((coupon) => coupon.id) ?? [],
    );

    setSelectedCouponIds((current) =>
      current.filter((couponId) => visibleCouponIds.has(couponId)),
    );
  }, [couponsState.data]);

  function updateFilters(nextFilters: CouponsFilters) {
    setFilters(nextFilters);
    setPage(1);
  }

  function resetFilters() {
    setFilters(DEFAULT_COUPONS_FILTERS);
    setPage(1);
  }

  function selectCoupon(couponId: string, selected: boolean) {
    setSelectedCouponIds((current) => {
      if (selected) {
        return current.includes(couponId) ? current : [...current, couponId];
      }

      return current.filter((selectedCouponId) => selectedCouponId !== couponId);
    });
  }

  function selectVisibleCoupons(selected: boolean) {
    const visibleCouponIds =
      couponsState.data?.coupons.map((coupon) => coupon.id) ?? [];

    setSelectedCouponIds((current) => {
      if (!selected) {
        return current.filter(
          (couponId) => !visibleCouponIds.includes(couponId),
        );
      }

      return Array.from(new Set([...current, ...visibleCouponIds]));
    });
  }

  function requestBulkArchiveCoupons() {
    const selectedCouponIdSet = new Set(selectedCouponIds);
    const coupons =
      couponsState.data?.coupons.filter((coupon) =>
        selectedCouponIdSet.has(coupon.id),
      ) ?? [];

    if (coupons.length === 0) {
      return;
    }

    setCouponsToBulkArchive(coupons);
    setArchiveState({
      bulk: false,
      couponId: null,
      error: null,
    });
  }

  async function confirmArchiveCoupon() {
    if (!authToken || !couponToArchive) {
      return;
    }

    setArchiveState({
      bulk: false,
      couponId: couponToArchive.id,
      error: null,
    });

    try {
      await archiveAdminCoupon({
        authToken,
        couponId: couponToArchive.id,
      });

      setCouponToArchive(null);
      setArchiveState({
        bulk: false,
        couponId: null,
        error: null,
      });

      if (couponsState.data?.coupons.length === 1 && page > 1) {
        setPage((currentPage) => Math.max(currentPage - 1, 1));
        return;
      }

      setRefreshToken((value) => value + 1);
    } catch (error: unknown) {
      setArchiveState({
        bulk: false,
        couponId: couponToArchive.id,
        error:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się usunąć kuponu.",
      });
    }
  }

  async function confirmBulkArchiveCoupons() {
    if (!authToken || couponsToBulkArchive.length === 0) {
      return;
    }

    setArchiveState({
      bulk: true,
      couponId: null,
      error: null,
    });

    try {
      await Promise.all(
        couponsToBulkArchive.map((coupon) =>
          archiveAdminCoupon({
            authToken,
            couponId: coupon.id,
          }),
        ),
      );

      setCouponsToBulkArchive([]);
      setSelectedCouponIds([]);
      setArchiveState({
        bulk: false,
        couponId: null,
        error: null,
      });

      if (
        couponsState.data &&
        couponsToBulkArchive.length >= couponsState.data.coupons.length &&
        page > 1
      ) {
        setPage((currentPage) => Math.max(currentPage - 1, 1));
        return;
      }

      setRefreshToken((value) => value + 1);
    } catch (error: unknown) {
      setArchiveState({
        bulk: false,
        couponId: null,
        error:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się usunąć zaznaczonych kuponów.",
      });
    }
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
      {couponToArchive ? (
        <Dialog
          id="archive-coupon-dialog"
          header="Usunąć kupon?"
          onClose={() => {
            if (!archiveState.couponId) {
              setCouponToArchive(null);
              setArchiveState({
                bulk: false,
                couponId: null,
                error: null,
              });
            }
          }}
          width={1}
          footer={
            <Box paddingX={4} paddingBottom={4}>
              <Inline space={3}>
                <Button
                  disabled={archiveState.couponId !== null}
                  mode="ghost"
                  onClick={() => {
                    setCouponToArchive(null);
                    setArchiveState({
                      bulk: false,
                      couponId: null,
                      error: null,
                    });
                  }}
                  text="Anuluj"
                  type="button"
                />
                <Button
                  disabled={archiveState.couponId !== null}
                  onClick={confirmArchiveCoupon}
                  text={
                    archiveState.couponId === couponToArchive.id
                      ? "Usuwanie..."
                      : "Usuń kupon"
                  }
                  tone="critical"
                  type="button"
                />
              </Inline>
            </Box>
          }
        >
          <Box paddingX={4} paddingTop={4} paddingBottom={5}>
            <Text size={1}>
              Kupon {couponToArchive.code} zostanie zarchiwizowany i nie będzie
              dostępny dla klientów. Historia użycia pozostanie w systemie.
            </Text>
            {archiveState.error ? (
              <Box marginTop={4}>
                <Text size={1}>{archiveState.error}</Text>
              </Box>
            ) : null}
          </Box>
        </Dialog>
      ) : null}

      {couponsToBulkArchive.length > 0 ? (
        <Dialog
          id="bulk-archive-coupons-dialog"
          header="Usunąć zaznaczone kupony?"
          onClose={() => {
            if (!archiveState.bulk) {
              setCouponsToBulkArchive([]);
              setArchiveState({
                bulk: false,
                couponId: null,
                error: null,
              });
            }
          }}
          width={1}
          footer={
            <Box paddingX={4} paddingBottom={4}>
              <Inline space={3}>
                <Button
                  disabled={archiveState.bulk}
                  mode="ghost"
                  onClick={() => {
                    setCouponsToBulkArchive([]);
                    setArchiveState({
                      bulk: false,
                      couponId: null,
                      error: null,
                    });
                  }}
                  text="Anuluj"
                  type="button"
                />
                <Button
                  disabled={archiveState.bulk}
                  onClick={confirmBulkArchiveCoupons}
                  text={
                    archiveState.bulk
                      ? "Usuwanie..."
                      : `Usuń ${couponsToBulkArchive.length} kuponów`
                  }
                  tone="critical"
                  type="button"
                />
              </Inline>
            </Box>
          }
        >
          <Box paddingX={4} paddingTop={4} paddingBottom={5}>
            <Text size={1}>
              Zaznaczone kupony zostaną zarchiwizowane i nie będą dostępne dla
              klientów. Historia użycia pozostanie w systemie.
            </Text>
            {archiveState.error ? (
              <Box marginTop={4}>
                <Text size={1}>{archiveState.error}</Text>
              </Box>
            ) : null}
          </Box>
        </Dialog>
      ) : null}

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
              disabled={selectedCouponIds.length === 0 || archiveState.bulk}
              mode="ghost"
              onClick={requestBulkArchiveCoupons}
              padding={2}
              text={`Usuń zaznaczone (${selectedCouponIds.length})`}
              tone="critical"
              type="button"
            />
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
          <CouponsTable
            archivingCouponId={archiveState.couponId}
            bulkArchiving={archiveState.bulk}
            coupons={data.coupons}
            onOpenCoupon={onOpenCoupon}
            onRequestArchiveCoupon={setCouponToArchive}
            onSelectCoupon={selectCoupon}
            onSelectVisibleCoupons={selectVisibleCoupons}
            selectedCouponIds={selectedCouponIds}
          />
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
