import { ArrowLeftIcon } from "@sanity/icons";
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
import { useEffect, useState } from "react";

import {
  AdminApiError,
  createAdminCoupon,
  fetchAdminCouponProducts,
} from "../api.js";
import type {
  AdminCoupon,
  AdminCouponMutationInput,
  AdminCouponProductOption,
} from "../types.js";
import { AdminStateCard } from "./AdminStateCard.js";
import { CouponForm } from "./CouponForm.js";

type CouponCreateViewProps = {
  onBack: () => void;
};

type CreateState =
  | {
      status: "idle" | "loading";
      coupon: null;
      error: null;
    }
  | {
      status: "success";
      coupon: AdminCoupon;
      error: null;
    }
  | {
      status: "error";
      coupon: null;
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

export function CouponCreateView({ onBack }: CouponCreateViewProps) {
  const authToken = useAuthToken();
  const [state, setState] = useState<CreateState>({
    status: "idle",
    coupon: null,
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
          error:
            error instanceof AdminApiError || error instanceof Error
              ? error.message
              : "Nie udało się załadować produktów do kuponu.",
        }));
      });

    return () => controller.abort();
  }, [authToken]);

  function requestBack() {
    if (formDirty && state.status !== "success") {
      setConfirmBackOpen(true);
      return;
    }

    onBack();
  }

  async function handleSubmit(input: AdminCouponMutationInput) {
    if (!authToken) {
      return;
    }

    setState({
      status: "loading",
      coupon: null,
      error: null,
    });

    try {
      const coupon = await createAdminCoupon({
        authToken,
        input,
      });

      setState({
        status: "success",
        coupon,
        error: null,
      });
    } catch (error: unknown) {
      setState({
        status: "error",
        coupon: null,
        error:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się utworzyć kuponu.",
      });
    }
  }

  if (!authToken) {
    return (
      <AdminStateCard
        heading="Łączenie z sesją Sanity"
        description="Formularz kuponu uruchomi się po otrzymaniu aktywnego tokenu operatora."
        loading
      />
    );
  }

  return (
    <Box paddingX={3}>
      <Stack space={4}>
        {confirmBackOpen ? (
          <Dialog
            id="discard-coupon-dialog"
            header="Odrzucić nowy kupon?"
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
                kuponów, nowy kupon nie zostanie utworzony.
              </Text>
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
        </Flex>

        <Card padding={2} radius={2}>
          <Heading as="h2" size={2}>
            Nowy kupon
          </Heading>
        </Card>

        {state.status === "success" ? (
          <AdminStateCard
            action={
              <Flex gap={2} wrap="wrap">
                <Button
                  onClick={onBack}
                  text="Wróć do listy"
                  tone="primary"
                  type="button"
                />
                <Button
                  mode="ghost"
                  onClick={() =>
                    setState({
                      status: "idle",
                      coupon: null,
                      error: null,
                    })
                  }
                  text="Utwórz kolejny"
                  type="button"
                />
              </Flex>
            }
            heading="Kupon został utworzony"
            description={`Kod ${state.coupon.code} jest zapisany w systemie.`}
            tone="positive"
          />
        ) : null}

        {state.status === "error" ? (
          <AdminStateCard
            heading="Nie udało się utworzyć kuponu"
            description={state.error}
            tone="critical"
          />
        ) : null}

        {state.status !== "success" ? (
          <CouponForm
            disabled={state.status === "loading"}
            onDirtyChange={setFormDirty}
            onSubmit={handleSubmit}
            productOptions={productOptionsState.products}
            productOptionsError={productOptionsState.error}
            productOptionsLoading={productOptionsState.status === "loading"}
            submitText={
              state.status === "loading" ? "Tworzenie..." : "Utwórz kupon"
            }
          />
        ) : null}
      </Stack>
    </Box>
  );
}
