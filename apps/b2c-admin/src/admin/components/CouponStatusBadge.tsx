import { Badge } from "@sanity/ui";

import { COUPON_STATUS_TONES, formatCouponStatus } from "../formatters.js";
import type { AdminCouponDerivedStatus } from "../types.js";

type CouponStatusBadgeProps = {
  status: string;
};

export function CouponStatusBadge({ status }: CouponStatusBadgeProps) {
  return (
    <Badge
      fontSize={1}
      padding={2}
      tone={
        COUPON_STATUS_TONES[status as AdminCouponDerivedStatus] ?? "default"
      }
    >
      {formatCouponStatus(status)}
    </Badge>
  );
}
