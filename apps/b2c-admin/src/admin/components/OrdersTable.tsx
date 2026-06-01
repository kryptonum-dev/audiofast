import { Badge, Box, Card, Inline, Stack, Text } from "@sanity/ui";

import { formatDateTime, formatLineType, formatMoney } from "../formatters.js";
import type { AdminOrderListItem } from "../types.js";
import { OrderStatusBadge } from "./OrderStatusBadge.js";
import { SanityThumbnail } from "./SanityThumbnail.js";

type OrdersTableProps = {
  onOpenOrder?: (orderNumber: string) => void;
  orders: AdminOrderListItem[];
};

export function OrdersTable({ onOpenOrder, orders }: OrdersTableProps) {
  return (
    <Box paddingX={3}>
      <Card border radius={2}>
        <Box className="ordersTableScroller">
          <table className="ordersTable">
            <thead>
              <tr>
                <th>Zamówienie</th>
                <th>Data</th>
                <th>Klient</th>
                <th>Typ</th>
                <th>Status</th>
                <th>Operacje</th>
                <th>Suma</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  aria-label={`Otwórz zamówienie ${order.orderNumber}`}
                  className={onOpenOrder ? "ordersTableRowClickable" : undefined}
                  onKeyDown={(event) => {
                    if (!onOpenOrder) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenOrder(order.orderNumber);
                    }
                  }}
                  onClick={() => onOpenOrder?.(order.orderNumber)}
                  role={onOpenOrder ? "button" : undefined}
                  tabIndex={onOpenOrder ? 0 : undefined}
                >
                  <td>
                    <Inline space={3}>
                      <OrderLeadImage order={order} />
                      <Stack space={2}>
                        <Text size={1} weight="medium">
                          {order.orderNumber}
                        </Text>
                        {order.itemSummary.leadItem ? (
                          <Text muted size={1}>
                            {formatLeadItemLabel(order)}
                          </Text>
                        ) : null}
                      </Stack>
                    </Inline>
                  </td>
                  <td>
                    <Text size={1}>{formatDateTime(order.createdAt)}</Text>
                  </td>
                  <td>
                    <Stack space={2}>
                      <Text size={1} weight="medium">
                        {order.customer.displayName ?? "Bez nazwy"}
                      </Text>
                      <Text muted size={1}>
                        {order.customer.email}
                      </Text>
                    </Stack>
                  </td>
                  <td>
                    <Inline space={2}>
                      <Badge fontSize={1} padding={2} tone="default">
                        {formatLineType(order.itemSummary.lineTypes)}
                      </Badge>
                      {order.itemSummary.containsCpo ? (
                        <Badge fontSize={1} padding={2} tone="primary">
                          CPO
                        </Badge>
                      ) : null}
                    </Inline>
                  </td>
                  <td>
                    <OrderStatusBadge status={order.currentStatus} />
                  </td>
                  <td>
                    <Inline space={2}>
                      {order.hasOpenCancellationRequest ? (
                        <Badge fontSize={1} padding={2} tone="caution">
                          Anulowanie
                        </Badge>
                      ) : null}
                      {order.hasOpenReturnCase ? (
                        <Badge fontSize={1} padding={2} tone="caution">
                          Zwrot
                        </Badge>
                      ) : null}
                    </Inline>
                  </td>
                  <td>
                    <Text size={1} weight="medium">
                      {formatMoney(order.grandTotalCents)}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Card>
    </Box>
  );
}

function OrderLeadImage({ order }: { order: AdminOrderListItem }) {
  const image = order.itemSummary.leadItem?.productImage ?? null;
  const alt =
    image?.alt ??
    order.itemSummary.leadItem?.productName ??
    `Produkt z zamówienia ${order.orderNumber}`;

  return (
    <SanityThumbnail
      alt={alt}
      className="orderLeadImage"
      height={44}
      image={image}
      placeholderClassName="orderLeadImagePlaceholder"
      width={44}
    />
  );
}

function formatLeadItemLabel(order: AdminOrderListItem): string {
  const leadItem = order.itemSummary.leadItem;

  if (!leadItem) {
    return "";
  }

  const remainingItemCount = Math.max(order.itemSummary.totalItemCount - 1, 0);
  const baseLabel = `${leadItem.brandName} ${leadItem.productName}`;

  if (remainingItemCount === 0) {
    return baseLabel;
  }

  return `${baseLabel} + ${remainingItemCount} ${formatOtherItemsLabel(
    remainingItemCount,
  )}`;
}

function formatOtherItemsLabel(count: number): string {
  return count === 1 ? "inny" : "inne";
}
