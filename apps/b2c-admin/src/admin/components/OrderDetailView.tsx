import {
  ArrowLeftIcon,
  CloseIcon,
  DocumentPdfIcon,
  DownloadIcon,
  RefreshIcon,
  UploadIcon,
} from "@sanity/icons";
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Heading,
  Inline,
  Select,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@sanity/ui";
import { useAuthToken } from "@sanity/sdk-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import {
  AdminApiError,
  attachAdminOrderInvoice,
  closeAdminOrderReturnCase,
  completeAdminOrderReturnCase,
  downloadAdminOrderInvoice,
  fetchAdminOrderDetail,
  removeAdminOrderInvoice,
  resolveAdminOrderCancellation,
  updateAdminOrderShipment,
  updateAdminOrderStatus,
} from "../api.js";
import {
  formatDateTime,
  formatLineType,
  formatMoney,
  formatOrderStatus,
} from "../formatters.js";
import { buildSanityImageUrl } from "../image.js";
import type {
  AdminOrderAddressBlock,
  AdminOrderCancellationRequest,
  AdminOrderDetail,
  AdminOrderItem,
  AdminOrderReturnCase,
  AdminOrderStatus,
  AdminOrderTimelineEntry,
} from "../types.js";
import { AdminStateCard } from "./AdminStateCard.js";
import { OrderStatusBadge } from "./OrderStatusBadge.js";

type OrderDetailViewProps = {
  orderNumber: string;
  onBack: () => void;
};

type OrderDetailState =
  | {
      status: "idle" | "loading";
      order: AdminOrderDetail | null;
      error: null;
    }
  | {
      status: "ready";
      order: AdminOrderDetail;
      error: null;
    }
  | {
      status: "error";
      order: AdminOrderDetail | null;
      error: string;
    };

type ActionState =
  | {
      status: "idle" | "loading";
      message?: string;
    }
  | {
      status: "success" | "error";
      message: string;
    };

export function OrderDetailView({ onBack, orderNumber }: OrderDetailViewProps) {
  const authToken = useAuthToken();
  const [refreshToken, setRefreshToken] = useState(0);
  const [state, setState] = useState<OrderDetailState>({
    status: "idle",
    order: null,
    error: null,
  });

  useEffect(() => {
    if (!authToken) {
      setState({
        status: "idle",
        order: null,
        error: null,
      });
      return;
    }

    const controller = new AbortController();

    setState((current) => ({
      status: "loading",
      order: current.order,
      error: null,
    }));

    fetchAdminOrderDetail({
      authToken,
      orderNumber,
      signal: controller.signal,
    })
      .then((order) =>
        setState({
          status: "ready",
          order,
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState((current) => ({
          status: "error",
          order: current.order,
          error:
            error instanceof AdminApiError || error instanceof Error
              ? error.message
              : "Nie udało się załadować szczegółów zamówienia.",
        }));
      });

    return () => controller.abort();
  }, [authToken, orderNumber, refreshToken]);

  if (!authToken) {
    return (
      <AdminStateCard
        heading="Łączenie z sesją Sanity"
        description="Szczegóły zamówienia uruchomią się po otrzymaniu aktywnego tokenu operatora."
        loading
      />
    );
  }

  return (
    <Box paddingX={3}>
      <Stack space={4}>
        <Flex align="center" justify="space-between" wrap="wrap">
          <Button
            icon={ArrowLeftIcon}
            mode="ghost"
            onClick={onBack}
            text="Wróć do zamówień"
            type="button"
          />
          <Button
            disabled={state.status === "loading"}
            icon={RefreshIcon}
            mode="ghost"
            onClick={() => setRefreshToken((value) => value + 1)}
            text="Odśwież"
            type="button"
          />
        </Flex>

        {state.status === "loading" && !state.order ? (
          <AdminStateCard
            heading="Ładowanie szczegółów"
            description="Pobieranie zamówienia z backendu Audiofast."
            loading
          />
        ) : null}

        {state.status === "error" ? (
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
            heading="Nie udało się załadować zamówienia"
            description={state.error}
            tone="critical"
          />
        ) : null}

        {state.order ? (
          <OrderDetailContent
            authToken={authToken}
            order={state.order}
            onChanged={() => setRefreshToken((value) => value + 1)}
          />
        ) : null}
      </Stack>
    </Box>
  );
}

function OrderDetailContent({
  authToken,
  onChanged,
  order,
}: {
  authToken: string;
  onChanged: () => void;
  order: AdminOrderDetail;
}) {
  return (
    <Stack space={4}>
      <OrderSummarySection order={order} />
      <StatusActionsSection
        authToken={authToken}
        onChanged={onChanged}
        order={order}
      />
      <CustomerSection order={order} />
      <ItemsSection order={order} />
      {order.currentStatus !== "awaiting_payment" ? (
        <Grid columns={[1, 1, 2]} gap={4}>
          <ShipmentSection
            authToken={authToken}
            onChanged={onChanged}
            order={order}
          />
          <InvoiceSection
            authToken={authToken}
            onChanged={onChanged}
            order={order}
          />
        </Grid>
      ) : null}
      <ReturnAndCancellationSection
        authToken={authToken}
        onChanged={onChanged}
        order={order}
      />
      <TimelineSection order={order} />
    </Stack>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <Card border padding={4} radius={2}>
      <Stack space={4}>
        <Heading as="h2" size={1}>
          {title}
        </Heading>
        {children}
      </Stack>
    </Card>
  );
}

function OrderSummarySection({ order }: { order: AdminOrderDetail }) {
  return (
    <Card border padding={4} radius={2}>
      <Flex align="flex-start" justify="space-between" wrap="wrap">
        <Stack space={3}>
          <Inline space={3}>
            <Heading as="h1" size={3}>
              {order.orderNumber}
            </Heading>
            <OrderStatusBadge status={order.currentStatus} />
          </Inline>
          <Text muted size={1}>
            Utworzono {formatDateTime(order.createdAt)}
          </Text>
        </Stack>
        <Stack space={2}>
          <Text muted size={1}>
            Suma
          </Text>
          <Text size={3} weight="bold">
            {formatMoney(order.grandTotalCents)}
          </Text>
        </Stack>
      </Flex>
    </Card>
  );
}

function StatusActionsSection({
  authToken,
  onChanged,
  order,
}: {
  authToken: string;
  onChanged: () => void;
  order: AdminOrderDetail;
}) {
  const [note, setNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<AdminOrderStatus | "">(
    order.actions.allowedNextStatuses[0] ?? "",
  );
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
  });

  useEffect(() => {
    setSelectedStatus(order.actions.allowedNextStatuses[0] ?? "");
  }, [order.actions.allowedNextStatuses, order.currentStatus]);

  async function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStatus) {
      return;
    }

    setActionState({ status: "loading" });

    try {
      await updateAdminOrderStatus({
        authToken,
        note,
        orderNumber: order.orderNumber,
        status: selectedStatus,
      });
      setNote("");
      setActionState({
        status: "success",
        message: "Status został zmieniony.",
      });
      onChanged();
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się zmienić statusu zamówienia.",
      });
    }
  }

  return (
    <DetailSection title="Status i akcje">
      <Grid columns={[1, 1, 2]} gap={3}>
        <KeyValue
          label="Aktualny status"
          value={formatOrderStatus(order.currentStatus)}
        />
        <KeyValue
          label="Następne statusy"
          value={
            order.actions.allowedNextStatuses.length > 0
              ? order.actions.allowedNextStatuses
                  .map(formatOrderStatus)
                  .join(", ")
              : "Brak dostępnych przejść"
          }
        />
      </Grid>
      {order.actions.allowedNextStatuses.length > 0 ? (
        <form onSubmit={submitStatus}>
          <Stack space={3}>
            <Grid columns={[1, 1, 2]} gap={3}>
              <Stack space={2}>
                <Text muted size={1}>
                  Nowy status
                </Text>
                <Select
                  disabled={actionState.status === "loading"}
                  onChange={(event) =>
                    setSelectedStatus(
                      event.currentTarget.value as AdminOrderStatus,
                    )
                  }
                  value={selectedStatus}
                >
                  {order.actions.allowedNextStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatOrderStatus(status)}
                    </option>
                  ))}
                </Select>
              </Stack>
              <Stack space={2}>
                <Text muted size={1}>
                  Notatka
                </Text>
                <TextInput
                  disabled={actionState.status === "loading"}
                  onChange={(event) => setNote(event.currentTarget.value)}
                  placeholder="Opcjonalnie"
                  value={note}
                />
              </Stack>
            </Grid>
            <Inline space={3}>
              <Button
                disabled={actionState.status === "loading" || !selectedStatus}
                text={
                  actionState.status === "loading"
                    ? "Zapisywanie"
                    : "Zmień status"
                }
                tone="primary"
                type="submit"
              />
              <ActionMessage state={actionState} />
            </Inline>
          </Stack>
        </form>
      ) : null}
    </DetailSection>
  );
}

function CustomerSection({ order }: { order: AdminOrderDetail }) {
  const hasCompanyData =
    order.invoice.recipientType === "company" ||
    Boolean(
      order.invoice.companyName || order.invoice.taxId || order.invoice.address,
    );

  return (
    <DetailSection title="Klient i dostawa">
      <Grid columns={[1, 1, 2]} gap={3}>
        <Stack space={4}>
          <Stack space={3}>
            <Text size={1} weight="semibold">
              Dane klienta
            </Text>
            <Grid columns={[1, 1, 2]} gap={3}>
              <KeyValue
                label="Klient"
                value={order.customer.displayName ?? "Bez nazwy"}
              />
              <KeyValue label="E-mail" value={order.customer.email} />
              <KeyValue
                label="Telefon"
                value={order.customer.phone ?? "Brak"}
              />
            </Grid>
          </Stack>

          {hasCompanyData ? (
            <Stack space={3}>
              <Text size={1} weight="semibold">
                Dane firmowe
              </Text>
              <Grid columns={[1, 1, 2]} gap={3}>
                <KeyValue
                  label="Firma"
                  value={order.invoice.companyName ?? "Brak"}
                />
                <KeyValue label="NIP" value={order.invoice.taxId ?? "Brak"} />
                {order.invoice.address ? (
                  <AddressBlock
                    address={order.invoice.address}
                    label="Adres firmowy"
                  />
                ) : null}
              </Grid>
            </Stack>
          ) : null}
        </Stack>
        <AddressSection address={order.shippingAddress} title="Adres dostawy" />
      </Grid>
    </DetailSection>
  );
}

function ItemsSection({ order }: { order: AdminOrderDetail }) {
  const lineTypes = Array.from(
    new Set(order.items.map((item) => item.lineType)),
  );

  return (
    <DetailSection title="Produkty i podsumowanie">
      <Inline space={2}>
        <Badge fontSize={1} padding={2}>
          {formatLineType(lineTypes)}
        </Badge>
        {lineTypes.includes("cpo") ? (
          <Badge fontSize={1} padding={2} tone="primary">
            Zawiera CPO
          </Badge>
        ) : null}
      </Inline>
      <div className="orderDetailItems">
        {order.items.map((item) => (
          <OrderItemRow item={item} key={item.id} />
        ))}
      </div>
      <Card muted padding={4} radius={2}>
        <Stack space={3}>
          <SummaryLine
            label="Suma produktów"
            value={formatMoney(order.subtotalCents)}
          />
          <SummaryLine
            label="Rabat"
            value={`-${formatMoney(order.discountTotalCents)}`}
          />
          {order.discount?.couponCode ? (
            <SummaryLine label="Kupon" value={order.discount.couponCode} />
          ) : null}
          <SummaryLine
            strong
            label="Razem"
            value={formatMoney(order.grandTotalCents)}
          />
        </Stack>
      </Card>
    </DetailSection>
  );
}

function OrderItemRow({ item }: { item: AdminOrderItem }) {
  const imageUrl = buildSanityImageUrl(item.productImage);

  return (
    <Card border padding={3} radius={2}>
      <Flex align="center" gap={3}>
        {imageUrl ? (
          <img
            alt={item.productImage?.alt ?? item.productName}
            className="orderDetailItemImage"
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <div className="orderDetailItemImagePlaceholder" aria-hidden="true" />
        )}
        <Stack flex={1} space={3}>
          <Text size={2} weight="medium">
            {item.brandName} {item.productName}
          </Text>
          <Text muted size={2}>
            {item.quantity} x {formatMoney(item.unitPriceCents)}
          </Text>
          {item.details.length > 0 ? (
            <Box paddingTop={1}>
              <Inline space={2}>
                {item.details.map((detail) => (
                  <Badge fontSize={2} key={detail} padding={2} tone="primary">
                    {detail}
                  </Badge>
                ))}
              </Inline>
            </Box>
          ) : null}
          {item.cpoContext ? (
            <Text muted size={1}>
              CPO:{" "}
              {item.cpoContext.availabilityStatusAtPurchase ?? "brak statusu"}
            </Text>
          ) : null}
        </Stack>
        <Text size={2} weight="medium">
          {formatMoney(item.lineTotalCents)}
        </Text>
      </Flex>
    </Card>
  );
}

function ShipmentSection({
  authToken,
  onChanged,
  order,
}: {
  authToken: string;
  onChanged: () => void;
  order: AdminOrderDetail;
}) {
  const [carrier, setCarrier] = useState(order.shipment?.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(
    order.shipment?.trackingNumber ?? "",
  );
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
  });
  const [statusNote, setStatusNote] = useState("");
  const [shipDialogOpen, setShipDialogOpen] = useState(false);

  useEffect(() => {
    setCarrier(order.shipment?.carrier ?? "");
    setTrackingNumber(order.shipment?.trackingNumber ?? "");
  }, [order.shipment?.carrier, order.shipment?.trackingNumber]);

  async function submitShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (shouldConfirmShippedStatus(order)) {
      setShipDialogOpen(true);
      return;
    }

    await saveShipment({ updateStatus: false });
  }

  async function saveShipment({ updateStatus }: { updateStatus: boolean }) {
    setActionState({ status: "loading" });

    try {
      await updateAdminOrderShipment({
        authToken,
        carrier,
        orderNumber: order.orderNumber,
        trackingNumber,
      });

      if (updateStatus) {
        await updateAdminOrderStatus({
          authToken,
          note: statusNote,
          orderNumber: order.orderNumber,
          status: "shipped",
        });
      }

      setShipDialogOpen(false);
      setStatusNote("");
      setActionState({
        status: "success",
        message: updateStatus
          ? "Wysyłka została zapisana, a status zmieniony na wysłane."
          : "Dane wysyłki zostały zapisane.",
      });
      onChanged();
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się zapisać danych wysyłki.",
      });
    }
  }

  return (
    <DetailSection title="Wysyłka">
      {shipDialogOpen ? (
        <Dialog
          id="ship-order-dialog"
          header="Zmienić status na wysłane?"
          onClose={() => setShipDialogOpen(false)}
          width={1}
          footer={
            <Box paddingX={4} paddingBottom={4}>
              <Inline space={3}>
                <Button
                  disabled={actionState.status === "loading"}
                  mode="ghost"
                  onClick={() => saveShipment({ updateStatus: false })}
                  text="Zapisz bez zmiany statusu"
                  type="button"
                />
                <Button
                  disabled={actionState.status === "loading"}
                  onClick={() => saveShipment({ updateStatus: true })}
                  text={
                    actionState.status === "loading"
                      ? "Zapisywanie"
                      : "Zapisz i oznacz jako wysłane"
                  }
                  tone="primary"
                  type="button"
                />
              </Inline>
            </Box>
          }
        >
          <Box paddingX={4} paddingTop={4} paddingBottom={5}>
            <Stack space={4}>
              <Text size={1}>
                Zamówienie nie ma jeszcze statusu wysłane. Czy chcesz zapisać
                dane wysyłki i od razu zmienić status zamówienia na wysłane?
              </Text>
              <Stack space={2}>
                <Text muted size={1}>
                  Notatka do zmiany statusu
                </Text>
                <TextArea
                  disabled={actionState.status === "loading"}
                  onChange={(event) => setStatusNote(event.currentTarget.value)}
                  placeholder="Opcjonalnie"
                  rows={3}
                  value={statusNote}
                />
              </Stack>
            </Stack>
          </Box>
        </Dialog>
      ) : null}
      {order.shipment?.hasShipment ? (
        <Grid columns={[1, 1, 2]} gap={3}>
          <KeyValue
            label="Numer śledzenia"
            value={order.shipment.trackingNumber ?? "Brak"}
          />
          <KeyValue label="Kurier" value={order.shipment.carrier ?? "Brak"} />
        </Grid>
      ) : (
        <Text muted size={1}>
          Brak danych wysyłki.
        </Text>
      )}
      {order.actions.canEditShipment ? (
        <form onSubmit={submitShipment}>
          <Stack space={3}>
            <Grid columns={[1, 1, 2]} gap={3}>
              <Stack space={2}>
                <Text muted size={1}>
                  Numer śledzenia
                </Text>
                <TextInput
                  disabled={actionState.status === "loading"}
                  onChange={(event) =>
                    setTrackingNumber(event.currentTarget.value)
                  }
                  value={trackingNumber}
                />
              </Stack>
              <Stack space={2}>
                <Text muted size={1}>
                  Kurier
                </Text>
                <TextInput
                  disabled={actionState.status === "loading"}
                  onChange={(event) => setCarrier(event.currentTarget.value)}
                  placeholder="Opcjonalnie"
                  value={carrier}
                />
              </Stack>
            </Grid>
            <Inline space={3}>
              <Button
                disabled={
                  actionState.status === "loading" || !trackingNumber.trim()
                }
                text={
                  actionState.status === "loading"
                    ? "Zapisywanie"
                    : "Zapisz wysyłkę"
                }
                tone="primary"
                type="submit"
              />
              <ActionMessage state={actionState} />
            </Inline>
          </Stack>
        </form>
      ) : null}
    </DetailSection>
  );
}

function InvoiceSection({
  authToken,
  onChanged,
  order,
}: {
  authToken: string;
  onChanged: () => void;
  order: AdminOrderDetail;
}) {
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
  });
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const invoiceInputId = `invoice-upload-${order.id}`;
  const invoiceFilename = order.invoice.hasInvoice
    ? (order.invoice.filename ?? `faktura-${order.orderNumber}.pdf`)
    : null;

  async function uploadInvoice(file: File | null) {
    if (!file || actionState.status === "loading") {
      return;
    }

    setActionState({ status: "loading" });

    try {
      await attachAdminOrderInvoice({
        authToken,
        file,
        orderNumber: order.orderNumber,
      });
      setActionState({ status: "success", message: "Faktura została dodana." });
      onChanged();
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się dodać faktury.",
      });
    }
  }

  async function downloadInvoice() {
    setActionState({ status: "loading" });

    try {
      await downloadAdminOrderInvoice({
        authToken,
        orderNumber: order.orderNumber,
      });
      setActionState({ status: "idle" });
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się pobrać faktury.",
      });
    }
  }

  async function removeInvoice() {
    setActionState({ status: "loading" });

    try {
      await removeAdminOrderInvoice({
        authToken,
        orderNumber: order.orderNumber,
      });
      setRemoveDialogOpen(false);
      setActionState({
        status: "success",
        message: "Faktura została usunięta.",
      });
      onChanged();
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się usunąć faktury.",
      });
    }
  }

  return (
    <DetailSection title="Faktura">
      {removeDialogOpen ? (
        <Dialog
          id="remove-invoice-dialog"
          header="Usunąć fakturę?"
          onClose={() => setRemoveDialogOpen(false)}
          width={1}
          footer={
            <Box paddingX={4} paddingBottom={4}>
              <Inline space={3}>
                <Button
                  disabled={actionState.status === "loading"}
                  mode="ghost"
                  onClick={() => setRemoveDialogOpen(false)}
                  text="Anuluj"
                  type="button"
                />
                <Button
                  disabled={actionState.status === "loading"}
                  onClick={removeInvoice}
                  text={
                    actionState.status === "loading"
                      ? "Usuwanie"
                      : "Usuń fakturę"
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
              Czy na pewno chcesz usunąć fakturę z tego zamówienia?
            </Text>
          </Box>
        </Dialog>
      ) : null}
      {order.actions.canAttachInvoice ? (
        <Stack space={3}>
          <input
            accept="application/pdf"
            className="invoiceFileInput"
            disabled={actionState.status === "loading"}
            id={invoiceInputId}
            onChange={(event) =>
              uploadInvoice(event.currentTarget.files?.[0] ?? null)
            }
            type="file"
          />
          {invoiceFilename ? (
            <Stack space={3}>
              <Card border padding={3} radius={2}>
                <Flex align="center" gap={3}>
                  <Card padding={2} radius={2} tone="primary">
                    <DocumentPdfIcon />
                  </Card>
                  <Stack flex={1} space={2}>
                    <Text muted size={1}>
                      Plik faktury
                    </Text>
                    <Text size={1} weight="medium">
                      {invoiceFilename}
                    </Text>
                  </Stack>
                  <Button
                    disabled={actionState.status === "loading"}
                    icon={CloseIcon}
                    mode="bleed"
                    onClick={() => setRemoveDialogOpen(true)}
                    padding={2}
                    text=""
                    tone="critical"
                    type="button"
                  />
                </Flex>
              </Card>
              <Inline space={3}>
                <Button
                  disabled={actionState.status === "loading"}
                  icon={UploadIcon}
                  mode="ghost"
                  onClick={() =>
                    document.getElementById(invoiceInputId)?.click()
                  }
                  text="Zmień fakturę"
                  type="button"
                />
                <Button
                  disabled={actionState.status === "loading"}
                  icon={DownloadIcon}
                  mode="ghost"
                  onClick={downloadInvoice}
                  text="Pobierz fakturę"
                  type="button"
                />
              </Inline>
            </Stack>
          ) : (
            <Box style={{ maxWidth: 240 }}>
              <Button
                disabled={actionState.status === "loading"}
                icon={UploadIcon}
                onClick={() => document.getElementById(invoiceInputId)?.click()}
                text={
                  actionState.status === "loading"
                    ? "Dodawanie faktury"
                    : "Dodaj fakturę"
                }
                tone="primary"
                type="button"
              />
            </Box>
          )}
          <Inline space={3}>
            <ActionMessage state={actionState} />
          </Inline>
        </Stack>
      ) : null}
    </DetailSection>
  );
}

function ReturnAndCancellationSection({
  authToken,
  onChanged,
  order,
}: {
  authToken: string;
  onChanged: () => void;
  order: AdminOrderDetail;
}) {
  return (
    <DetailSection title="Anulowania i zwroty">
      <Grid columns={[1, 1, 2]} gap={4}>
        <CancellationPanel
          authToken={authToken}
          onChanged={onChanged}
          order={order}
        />
        <ReturnsPanel
          authToken={authToken}
          onChanged={onChanged}
          order={order}
        />
      </Grid>
    </DetailSection>
  );
}

function CancellationPanel({
  authToken,
  onChanged,
  order,
}: {
  authToken: string;
  onChanged: () => void;
  order: AdminOrderDetail;
}) {
  const [adminNote, setAdminNote] = useState("");
  const [cancellationToResolve, setCancellationToResolve] = useState<{
    request: AdminOrderCancellationRequest;
    resolution: "cancel_order" | "decline_request";
  } | null>(null);
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
  });
  const request =
    order.cancellationRequests.find(
      (candidate) => candidate.status === "open",
    ) ?? null;

  async function submitCancellation(
    resolution: "cancel_order" | "decline_request",
  ) {
    const targetRequest = cancellationToResolve?.request ?? request;

    if (!targetRequest) {
      return;
    }

    setActionState({ status: "loading" });
    const resolvedAdminNote =
      resolution === "cancel_order" ? adminNote : "";

    try {
      await resolveAdminOrderCancellation({
        adminNote: resolvedAdminNote,
        authToken,
        orderNumber: order.orderNumber,
        requestId: targetRequest.id,
        resolution,
      });
      setAdminNote("");
      setCancellationToResolve(null);
      setActionState({
        status: "success",
        message: "Zgłoszenie anulowania zostało obsłużone.",
      });
      onChanged();
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się obsłużyć anulowania.",
      });
    }
  }

  return (
    <Stack space={3}>
      {cancellationToResolve ? (
        <Dialog
          id="resolve-cancellation-dialog"
          header={
            cancellationToResolve.resolution === "cancel_order"
              ? "Anulować zamówienie?"
              : "Odrzucić zgłoszenie anulowania?"
          }
          onClose={() => {
            if (actionState.status !== "loading") {
              setCancellationToResolve(null);
              setAdminNote("");
            }
          }}
          width={1}
          footer={
            <Box paddingX={4} paddingBottom={4}>
              <Inline space={3}>
                <Button
                  disabled={actionState.status === "loading"}
                  mode="ghost"
                  onClick={() => {
                    setCancellationToResolve(null);
                    setAdminNote("");
                  }}
                  text="Anuluj"
                  type="button"
                />
                <Button
                  disabled={actionState.status === "loading"}
                  onClick={() =>
                    submitCancellation(cancellationToResolve.resolution)
                  }
                  text={
                    actionState.status === "loading"
                      ? "Zapisywanie"
                      : cancellationToResolve.resolution === "cancel_order"
                        ? "Anuluj zamówienie"
                        : "Odrzuć zgłoszenie"
                  }
                  tone={
                    cancellationToResolve.resolution === "cancel_order"
                      ? "critical"
                      : "primary"
                  }
                  type="button"
                />
              </Inline>
            </Box>
          }
        >
          <Box paddingX={4} paddingTop={4} paddingBottom={5}>
            <Stack space={4}>
              <Text size={1}>
                {cancellationToResolve.resolution === "cancel_order"
                  ? "Czy na pewno chcesz anulować to zamówienie i zamknąć zgłoszenie klienta?"
                  : "Czy na pewno chcesz odrzucić zgłoszenie anulowania? Zamówienie pozostanie w aktualnym statusie."}
              </Text>
              {cancellationToResolve.resolution === "cancel_order" ? (
                <Stack space={2}>
                  <Text muted size={1}>
                    Notatka do zmiany statusu
                  </Text>
                  <TextArea
                    disabled={actionState.status === "loading"}
                    onChange={(event) =>
                      setAdminNote(event.currentTarget.value)
                    }
                    placeholder="Opcjonalnie"
                    rows={3}
                    value={adminNote}
                  />
                </Stack>
              ) : null}
            </Stack>
          </Box>
        </Dialog>
      ) : null}
      <Heading as="h3" size={0}>
        Anulowanie
      </Heading>
      {order.cancellationRequests.length > 0 ? (
        <Stack space={3}>
          {order.cancellationRequests.map((cancellationRequest) => {
            const isOpen = cancellationRequest.status === "open";

            return (
              <Card
                border
                key={cancellationRequest.id}
                padding={3}
                radius={2}
                shadow={isOpen ? 1 : 0}
                style={{ opacity: isOpen ? 1 : 0.66 }}
                tone={isOpen ? "primary" : "transparent"}
              >
                <Stack space={3}>
                  <Flex align="center" justify="space-between">
                    <Text size={1} weight="semibold">
                      {isOpen ? "Aktualne zgłoszenie" : "Historia zgłoszenia"}
                    </Text>
                    <Badge
                      fontSize={1}
                      padding={2}
                      tone={isOpen ? "primary" : "default"}
                    >
                      {isOpen ? "Aktywne" : "Zamknięte"}
                    </Badge>
                  </Flex>
                  <Grid columns={[1, 1, 2]} gap={3}>
                    <KeyValue
                      label="Status"
                      value={cancellationRequest.status}
                    />
                    <KeyValue
                      label="Zgłoszono"
                      value={formatDateTime(cancellationRequest.requestedAt)}
                    />
                    <KeyValue
                      label="Powód"
                      value={cancellationRequest.reason ?? "Brak"}
                    />
                    <KeyValue
                      label="Zamknięto"
                      value={
                        cancellationRequest.resolvedAt
                          ? formatDateTime(cancellationRequest.resolvedAt)
                          : "Nie"
                      }
                    />
                    {cancellationRequest.adminNote ? (
                      <KeyValue
                        label="Notatka operatora"
                        value={cancellationRequest.adminNote}
                      />
                    ) : null}
                  </Grid>
                  {isOpen && order.actions.canResolveCancellationRequest ? (
                    <Inline space={3}>
                      <Button
                        disabled={actionState.status === "loading"}
                        onClick={() =>
                          setCancellationToResolve({
                            request: cancellationRequest,
                            resolution: "cancel_order",
                          })
                        }
                        text="Anuluj zamówienie"
                        tone="critical"
                        type="button"
                      />
                      <Button
                        disabled={actionState.status === "loading"}
                        mode="ghost"
                        onClick={() =>
                          setCancellationToResolve({
                            request: cancellationRequest,
                            resolution: "decline_request",
                          })
                        }
                        text="Odrzuć zgłoszenie"
                        type="button"
                      />
                    </Inline>
                  ) : null}
                </Stack>
              </Card>
            );
          })}
          <ActionMessage state={actionState} />
        </Stack>
      ) : (
        <Text muted size={1}>
          Brak zgłoszeń anulowania.
        </Text>
      )}
    </Stack>
  );
}

function ReturnsPanel({
  authToken,
  onChanged,
  order,
}: {
  authToken: string;
  onChanged: () => void;
  order: AdminOrderDetail;
}) {
  const [adminNote, setAdminNote] = useState("");
  const [returnToComplete, setReturnToComplete] =
    useState<AdminOrderReturnCase | null>(null);
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
  });

  async function updateReturnCase(
    returnCase: AdminOrderReturnCase,
    action: "close" | "complete",
  ) {
    setActionState({ status: "loading" });

    try {
      if (action === "complete") {
        await completeAdminOrderReturnCase({
          adminNote,
          authToken,
          orderNumber: order.orderNumber,
          returnCaseId: returnCase.id,
        });
      } else {
        await closeAdminOrderReturnCase({
          authToken,
          orderNumber: order.orderNumber,
          returnCaseId: returnCase.id,
        });
      }

      setAdminNote("");
      setReturnToComplete(null);
      setActionState({
        status: "success",
        message: "Sprawa zwrotu została zaktualizowana.",
      });
      onChanged();
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Nie udało się zaktualizować sprawy zwrotu.",
      });
    }
  }

  return (
    <Stack space={3}>
      {returnToComplete ? (
        <Dialog
          id="complete-return-dialog"
          header="Oznaczyć zamówienie jako zwrócone?"
          onClose={() => {
            if (actionState.status !== "loading") {
              setReturnToComplete(null);
              setAdminNote("");
            }
          }}
          width={1}
          footer={
            <Box paddingX={4} paddingBottom={4}>
              <Inline space={3}>
                <Button
                  disabled={actionState.status === "loading"}
                  mode="ghost"
                  onClick={() => {
                    setReturnToComplete(null);
                    setAdminNote("");
                  }}
                  text="Anuluj"
                  type="button"
                />
                <Button
                  disabled={actionState.status === "loading"}
                  onClick={() => updateReturnCase(returnToComplete, "complete")}
                  text={
                    actionState.status === "loading"
                      ? "Zapisywanie"
                      : "Oznacz jako zwrócone"
                  }
                  tone="primary"
                  type="button"
                />
              </Inline>
            </Box>
          }
        >
          <Box paddingX={4} paddingTop={4} paddingBottom={5}>
            <Stack space={4}>
              <Text size={1}>
                Czy na pewno chcesz zakończyć tę sprawę zwrotu i zmienić status
                zamówienia na zwrócone?
              </Text>
              <Stack space={2}>
                <Text muted size={1}>
                  Notatka do zmiany statusu
                </Text>
                <TextArea
                  disabled={actionState.status === "loading"}
                  onChange={(event) => setAdminNote(event.currentTarget.value)}
                  placeholder="Opcjonalnie"
                  rows={3}
                  value={adminNote}
                />
              </Stack>
            </Stack>
          </Box>
        </Dialog>
      ) : null}
      <Heading as="h3" size={0}>
        Zwroty
      </Heading>
      {order.returnCases.length > 0 ? (
        <Stack space={2}>
          {order.returnCases.map((returnCase) => {
            const isOpen = returnCase.status === "open";

            return (
              <Card
                border
                key={returnCase.id}
                padding={3}
                radius={2}
                shadow={isOpen ? 1 : 0}
                style={{ opacity: isOpen ? 1 : 0.66 }}
                tone={isOpen ? "primary" : "transparent"}
              >
                <Stack space={3}>
                  <Flex align="center" justify="space-between">
                    <Text size={1} weight="semibold">
                      {isOpen ? "Aktualna sprawa zwrotu" : "Historia zwrotu"}
                    </Text>
                    <Badge
                      fontSize={1}
                      padding={2}
                      tone={isOpen ? "primary" : "default"}
                    >
                      {isOpen ? "Aktywna" : "Zamknięta"}
                    </Badge>
                  </Flex>
                  <Grid columns={[1, 1, 2]} gap={3}>
                    <KeyValue label="Status" value={returnCase.status} />
                    <KeyValue
                      label="Utworzono"
                      value={formatDateTime(returnCase.createdAt)}
                    />
                    <KeyValue
                      label="Powód"
                      value={returnCase.reason ?? "Brak"}
                    />
                    <KeyValue
                      label="Zamknięto"
                      value={
                        returnCase.closedAt
                          ? formatDateTime(returnCase.closedAt)
                          : "Nie"
                      }
                    />
                  </Grid>
                  {isOpen ? (
                    <Inline space={3}>
                      <Button
                        disabled={actionState.status === "loading"}
                        onClick={() => {
                          setAdminNote("");
                          setReturnToComplete(returnCase);
                        }}
                        text="Oznacz jako zwrócone"
                        tone="primary"
                        type="button"
                      />
                      <Button
                        disabled={actionState.status === "loading"}
                        mode="ghost"
                        onClick={() => updateReturnCase(returnCase, "close")}
                        text="Zamknij bez zwrotu"
                        type="button"
                      />
                    </Inline>
                  ) : null}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <Text muted size={1}>
          Brak spraw zwrotu.
        </Text>
      )}
      <ActionMessage state={actionState} />
    </Stack>
  );
}

function getTimelineSourceLabel(source: string) {
  if (source === "system") {
    return "System Audiofast";
  }

  if (source === "admin" || source === "operator") {
    return "Panel admina";
  }

  return source || "Źródło nieznane";
}

function getTimelineActorName(entry: AdminOrderTimelineEntry) {
  if (entry.actorName) {
    return entry.actorName;
  }

  if (entry.actorEmail) {
    return entry.actorEmail;
  }

  if (entry.actor) {
    return entry.actor;
  }

  return entry.source === "system" ? "Automatyzacja" : "Nieznany operator";
}

function getTimelineActorInitials(entry: AdminOrderTimelineEntry) {
  if (entry.source === "system" && !entry.actorName && !entry.actorEmail) {
    return "SA";
  }

  const name = getTimelineActorName(entry);
  const parts = name
    .replace(/@.*/, "")
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "AF";
}

function TimelineActor({ entry }: { entry: AdminOrderTimelineEntry }) {
  const actorName = getTimelineActorName(entry);
  const sourceLabel = getTimelineSourceLabel(entry.source);

  return (
    <Flex align="center" gap={3}>
      <div className="timelineAvatar" data-source={entry.source}>
        {entry.actorImage ? (
          <img alt="" src={entry.actorImage} />
        ) : (
          <span>{getTimelineActorInitials(entry)}</span>
        )}
      </div>
      <Stack className="timelineActorText" space={2}>
        <Text size={1} weight="semibold">
          {actorName}
        </Text>
        <Text muted size={1}>
          {sourceLabel}
          {entry.actorEmail && entry.actorEmail !== actorName
            ? ` · ${entry.actorEmail}`
            : ""}
        </Text>
      </Stack>
    </Flex>
  );
}

function getTimelineStatusTone(status: string) {
  switch (status) {
    case "paid":
    case "completed":
      return "success";
    case "awaiting_payment":
      return "warning";
    case "processing":
      return "processing";
    case "shipped":
      return "shipped";
    case "cancelled":
      return "destructive";
    case "returned":
      return "returned";
    default:
      return "neutral";
  }
}

function TimelineSection({ order }: { order: AdminOrderDetail }) {
  return (
    <DetailSection title="Historia statusów">
      <Stack className="timelineList" space={3}>
        {order.timeline.map((entry) => (
          <Card
            border
            className="timelineEntry"
            key={entry.id}
            padding={4}
            radius={2}
          >
            <Flex align="flex-start" gap={4} justify="space-between" wrap="wrap">
              <Stack flex={1} space={3}>
                <Flex align="center" gap={2} wrap="wrap">
                  <span
                    className="timelineStatus"
                    data-tone={getTimelineStatusTone(entry.status)}
                  >
                    {formatOrderStatus(entry.status)}
                  </span>
                  {entry.previousStatus ? (
                    <Text muted size={1}>
                      z {formatOrderStatus(entry.previousStatus)}
                    </Text>
                  ) : null}
                </Flex>
                <TimelineActor entry={entry} />
                {entry.note ? (
                  <Card className="timelineNote" padding={3} radius={2}>
                    <Stack space={2}>
                      <Text muted size={1}>
                        Notatka
                      </Text>
                      <Text size={1} weight="medium">
                        {entry.note}
                      </Text>
                    </Stack>
                  </Card>
                ) : null}
              </Stack>
              <Stack className="timelineDate" space={2}>
                <Text muted size={1}>
                  Data zmiany
                </Text>
                <Text size={1} weight="semibold">
                  {formatDateTime(entry.changedAt)}
                </Text>
              </Stack>
            </Flex>
          </Card>
        ))}
      </Stack>
    </DetailSection>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <Stack space={2}>
      <Text muted size={1}>
        {label}
      </Text>
      <Text size={1} weight="medium">
        {value}
      </Text>
    </Stack>
  );
}

function AddressBlock({
  address,
  label,
}: {
  address: AdminOrderAddressBlock;
  label: string;
}) {
  const values = [
    address.companyName,
    address.taxId ? `NIP: ${address.taxId}` : null,
    address.recipientName,
    address.phone ? `Tel: ${address.phone}` : null,
    ...address.lines,
  ].filter(Boolean);

  return (
    <Stack space={2}>
      <Text muted size={1}>
        {label}
      </Text>
      <Text size={1} weight="medium">
        {values.join(", ") || "Brak"}
      </Text>
    </Stack>
  );
}

function AddressSection({
  address,
  title,
}: {
  address: AdminOrderAddressBlock;
  title: string;
}) {
  const [streetLine, cityLine] = address.lines;
  const recipientName = address.recipientName?.trim();
  const phone = address.phone?.trim();

  return (
    <Stack space={3}>
      <Text size={1} weight="semibold">
        {title}
      </Text>
      <Grid columns={[1, 1, 2]} gap={3}>
        {address.companyName ? (
          <KeyValue label="Firma" value={address.companyName} />
        ) : null}
        {address.taxId ? <KeyValue label="NIP" value={address.taxId} /> : null}
        {recipientName ? (
          <KeyValue label="Odbiorca" value={recipientName} />
        ) : null}
        {phone ? <KeyValue label="Telefon" value={phone} /> : null}
        <KeyValue label="Ulica" value={streetLine ?? "Brak"} />
        <KeyValue label="Kod i miasto" value={cityLine ?? "Brak"} />
      </Grid>
    </Stack>
  );
}

function SummaryLine({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <Flex align="center" justify="space-between">
      <Text muted={!strong} size={2} weight={strong ? "bold" : undefined}>
        {label}
      </Text>
      <Text size={2} weight={strong ? "bold" : "medium"}>
        {value}
      </Text>
    </Flex>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <Text muted size={1}>
        Zapisywanie...
      </Text>
    );
  }

  return (
    <Text muted={state.status !== "error"} size={1}>
      {state.message}
    </Text>
  );
}

function shouldConfirmShippedStatus(order: AdminOrderDetail) {
  return (
    (order.currentStatus === "paid" || order.currentStatus === "processing") &&
    order.actions.allowedNextStatuses.includes("shipped")
  );
}

function toDatetimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
