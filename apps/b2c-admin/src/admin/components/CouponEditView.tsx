import { ArrowLeftIcon, RefreshIcon, TrashIcon } from "@sanity/icons";
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  Inline,
  Stack,
  Text,
} from "@sanity/ui";
import { useAuthToken } from "@sanity/sdk-react";
import { useEffect, useMemo, useState } from "react";

import {
  getAdminErrorMessage,
  archiveAdminCoupon,
  fetchAdminCoupon,
  fetchAdminCouponProducts,
  updateAdminCoupon,
} from "../api.js";
import type {
  AdminCoupon,
  AdminCouponMutationInput,
  AdminCouponProductOption,
} from "../types.js";
import { AdminStateCard } from "./AdminStateCard.js";
import { CouponForm, getCouponFormValues } from "./CouponForm.js";
import { CouponStatusBadge } from "./CouponStatusBadge.js";

type CouponEditViewProps = {
  couponId: string;
  onBack: () => void;
};

type CouponLoadState =
  | {
      status: "idle" | "loading";
      coupon: AdminCoupon | null;
      error: null;
    }
  | {
      status: "ready";
      coupon: AdminCoupon;
      error: null;
    }
  | {
      status: "error";
      coupon: AdminCoupon | null;
      error: string;
    };

type SaveState =
  | {
      status: "idle" | "loading" | "success";
      error: null;
    }
  | {
      status: "error";
      error: string;
    };

type ProductOptionsState =
  | {
      status: "idle" | "loading";
      products: AdminCouponProductOption[];
      error: null;
    }
  | {
      status: "ready";
      products: AdminCouponProductOption[];
      error: null;
    }
  | {
      status: "error";
      products: AdminCouponProductOption[];
      error: string;
    };

export function CouponEditView({ couponId, onBack }: CouponEditViewProps) {
  const authToken = useAuthToken();
  const [couponState, setCouponState] = useState<CouponLoadState>({
    status: "idle",
    coupon: null,
    error: null,
  });
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    error: null,
  });
  const [productOptionsState, setProductOptionsState] =
    useState<ProductOptionsState>({
      status: "idle",
      products: [],
      error: null,
    });
  const [formDirty, setFormDirty] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [archiveState, setArchiveState] = useState<
    | {
        status: "idle" | "loading";
        error: null;
      }
    | {
        status: "error";
        error: string;
      }
  >({
    status: "idle",
    error: null,
  });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!authToken) {
      setCouponState({
        status: "idle",
        coupon: null,
        error: null,
      });
      return;
    }

    const controller = new AbortController();

    setCouponState((current) => ({
      status: "loading",
      coupon: current.coupon,
      error: null,
    }));
    setSaveState({
      status: "idle",
      error: null,
    });

    fetchAdminCoupon({
      authToken,
      couponId,
      signal: controller.signal,
    })
      .then((coupon) => {
        setCouponState({
          status: "ready",
          coupon,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setCouponState((current) => ({
          status: "error",
          coupon: current.coupon,
          error: getAdminErrorMessage(error, "Nie udało się załadować kuponu."),
        }));
      });

    return () => controller.abort();
  }, [authToken, couponId, refreshToken]);

  useEffect(() => {
    if (!authToken) {
      setProductOptionsState({
        status: "idle",
        products: [],
        error: null,
      });
      return;
    }

    const controller = new AbortController();

    setProductOptionsState((current) => ({
      status: "loading",
      products: current.products,
      error: null,
    }));

    fetchAdminCouponProducts({
      authToken,
      signal: controller.signal,
    })
      .then((data) => {
        setProductOptionsState({
          status: "ready",
          products: data.products,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setProductOptionsState((current) => ({
          status: "error",
          products: current.products,
          error: getAdminErrorMessage(
            error,
            "Nie udało się załadować produktów do kuponu.",
          ),
        }));
      });

    return () => controller.abort();
  }, [authToken]);

  const initialValues = useMemo(
    () =>
      couponState.status === "ready"
        ? getCouponFormValues(couponState.coupon)
        : null,
    [couponState],
  );

  function requestBack() {
    if (formDirty) {
      setConfirmBackOpen(true);
      return;
    }

    onBack();
  }

  async function handleSubmit(input: AdminCouponMutationInput) {
    if (!authToken) {
      return;
    }

    setSaveState({
      status: "loading",
      error: null,
    });

    try {
      const coupon = await updateAdminCoupon({
        authToken,
        couponId,
        input,
      });

      setCouponState({
        status: "ready",
        coupon,
        error: null,
      });
      setSaveState({
        status: "success",
        error: null,
      });
    } catch (error: unknown) {
      setSaveState({
        status: "error",
        error: getAdminErrorMessage(error, "Nie udało się zapisać kuponu."),
      });
    }
  }

  async function confirmArchiveCoupon() {
    if (!authToken || !couponState.coupon) {
      return;
    }

    setArchiveState({
      status: "loading",
      error: null,
    });

    try {
      await archiveAdminCoupon({
        authToken,
        couponId: couponState.coupon.id,
      });

      onBack();
    } catch (error: unknown) {
      setArchiveState({
        status: "error",
        error: getAdminErrorMessage(error, "Nie udało się usunąć kuponu."),
      });
    }
  }

  if (!authToken) {
    return (
      <AdminStateCard
        heading="Łączenie z sesją Sanity"
        description="Edycja kuponu uruchomi się po otrzymaniu aktywnego tokenu operatora."
        loading
      />
    );
  }

  const coupon = couponState.coupon;

  return (
    <Box paddingX={3}>
      <Stack space={4}>
        {confirmBackOpen ? (
          <Dialog
            id="discard-coupon-edit-dialog"
            header="Odrzucić zmiany?"
            onClose={() => setConfirmBackOpen(false)}
            width={1}
            footer={
              <Box paddingX={4} paddingBottom={4}>
                <Inline space={3}>
                  <Button
                    mode="ghost"
                    onClick={() => setConfirmBackOpen(false)}
                    text="Zostań"
                    type="button"
                  />
                  <Button
                    onClick={onBack}
                    text="Odrzuć zmiany"
                    tone="critical"
                    type="button"
                  />
                </Inline>
              </Box>
            }
          >
            <Box paddingX={4} paddingTop={4} paddingBottom={5}>
              <Text size={1}>
                W formularzu są niezapisane dane. Jeśli wrócisz do listy
                kuponów, ostatnie zmiany nie zostaną zapisane.
              </Text>
            </Box>
          </Dialog>
        ) : null}

        {confirmArchiveOpen && coupon ? (
          <Dialog
            id="archive-coupon-edit-dialog"
            header="Usunąć kupon?"
            onClose={() => {
              if (archiveState.status !== "loading") {
                setConfirmArchiveOpen(false);
                setArchiveState({
                  status: "idle",
                  error: null,
                });
              }
            }}
            width={1}
            footer={
              <Box paddingX={4} paddingBottom={4}>
                <Inline space={3}>
                  <Button
                    disabled={archiveState.status === "loading"}
                    mode="ghost"
                    onClick={() => {
                      setConfirmArchiveOpen(false);
                      setArchiveState({
                        status: "idle",
                        error: null,
                      });
                    }}
                    text="Anuluj"
                    type="button"
                  />
                  <Button
                    disabled={archiveState.status === "loading"}
                    onClick={confirmArchiveCoupon}
                    text={
                      archiveState.status === "loading"
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
                Kupon {coupon.code} zostanie zarchiwizowany i nie będzie
                dostępny dla klientów. Historia użycia pozostanie w systemie.
              </Text>
              {archiveState.status === "error" ? (
                <Box marginTop={4}>
                  <Text size={1}>{archiveState.error}</Text>
                </Box>
              ) : null}
            </Box>
          </Dialog>
        ) : null}

        <Flex align="center" justify="space-between" wrap="wrap">
          <Button
            icon={ArrowLeftIcon}
            mode="ghost"
            onClick={requestBack}
            text="Wróć do kuponów"
            type="button"
          />
          <Flex gap={2} wrap="wrap">
            <Button
              disabled={couponState.status === "loading" || !coupon}
              icon={TrashIcon}
              mode="ghost"
              onClick={() => {
                setConfirmArchiveOpen(true);
                setArchiveState({
                  status: "idle",
                  error: null,
                });
              }}
              text="Usuń kupon"
              tone="critical"
              type="button"
            />
            <Button
              disabled={couponState.status === "loading"}
              icon={RefreshIcon}
              mode="ghost"
              onClick={() => setRefreshToken((value) => value + 1)}
              text="Odśwież"
              type="button"
            />
          </Flex>
        </Flex>

        <Card padding={2} radius={2}>
          <Flex align="center" gap={3} wrap="wrap">
            <Heading as="h2" size={2}>
              {coupon ? `Edytuj kupon ${coupon.code}` : "Edytuj kupon"}
            </Heading>
            {coupon ? (
              <CouponStatusBadge status={coupon.derivedStatus} />
            ) : null}
          </Flex>
        </Card>

        {couponState.status === "loading" && !coupon ? (
          <AdminStateCard
            heading="Ładowanie kuponu"
            description="Pobieram aktualne dane kuponu."
            loading
          />
        ) : null}

        {couponState.status === "error" ? (
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
            heading="Nie udało się załadować kuponu"
            description={couponState.error}
            tone="critical"
          />
        ) : null}

        {saveState.status === "success" ? (
          <AdminStateCard
            heading="Kupon został zapisany"
            description="Zmiany są już dostępne w systemie."
            tone="positive"
          />
        ) : null}

        {saveState.status === "error" ? (
          <AdminStateCard
            heading="Nie udało się zapisać kuponu"
            description={saveState.error}
            tone="critical"
          />
        ) : null}

        {couponState.status === "ready" && initialValues ? (
          <CouponForm
            disabled={saveState.status === "loading"}
            enforceFutureDates={false}
            initialValues={initialValues}
            onDirtyChange={setFormDirty}
            onSubmit={handleSubmit}
            productOptions={productOptionsState.products}
            productOptionsError={productOptionsState.error}
            productOptionsLoading={productOptionsState.status === "loading"}
            submitText={
              saveState.status === "loading" ? "Zapisywanie..." : "Zapisz kupon"
            }
            usageLimitMinimum={Math.max(couponState.coupon.usageCount, 1)}
          />
        ) : null}
      </Stack>
    </Box>
  );
}
