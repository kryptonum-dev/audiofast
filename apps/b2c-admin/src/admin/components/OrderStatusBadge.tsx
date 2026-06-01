import { Badge } from "@sanity/ui";

import { formatOrderStatus, ORDER_STATUS_TONES } from "../formatters.js";
import type { AdminOrderStatus } from "../types.js";

type OrderStatusBadgeProps = {
  status: string;
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const tone = ORDER_STATUS_TONES[status as AdminOrderStatus] ?? "default";

  return (
    <Badge fontSize={1} mode="outline" padding={2} tone={tone}>
      {formatOrderStatus(status)}
    </Badge>
  );
}
