import { Badge, Box, Card, Inline, Stack, Text } from "@sanity/ui";

import {
  formatCouponActivityWindow,
  formatCouponDiscount,
  formatCouponScope,
  formatDateTime,
} from "../formatters.js";
import type { AdminCoupon } from "../types.js";
import { CouponStatusBadge } from "./CouponStatusBadge.js";

type CouponsTableProps = {
  coupons: AdminCoupon[];
};

export function CouponsTable({ coupons }: CouponsTableProps) {
  return (
    <Box paddingX={3}>
      <Card border radius={2}>
        <Box className="ordersTableScroller">
          <table className="ordersTable">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Status</th>
                <th>Rabat</th>
                <th>Zakres</th>
                <th>Użycie</th>
                <th>Aktywność</th>
                <th>Aktualizacja</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <Stack space={2}>
                      <Text size={1} weight="medium">
                        {coupon.code}
                      </Text>
                      <Text muted size={1}>
                        Utworzono {formatDateTime(coupon.createdAt)}
                      </Text>
                    </Stack>
                  </td>
                  <td>
                    <CouponStatusBadge status={coupon.derivedStatus} />
                  </td>
                  <td>
                    <Text size={1} weight="medium">
                      {formatCouponDiscount(coupon)}
                    </Text>
                  </td>
                  <td>
                    <Inline space={2}>
                      <Badge fontSize={1} padding={2} tone="default">
                        {formatCouponScope(coupon)}
                      </Badge>
                      {coupon.productKeys.length > 0 ? (
                        <Badge fontSize={1} padding={2} tone="primary">
                          {coupon.productKeys.length} prod.
                        </Badge>
                      ) : null}
                    </Inline>
                  </td>
                  <td>
                    <Text size={1}>
                      {coupon.usageCount} /{" "}
                      {coupon.usageLimit === null
                        ? "bez limitu"
                        : coupon.usageLimit}
                    </Text>
                  </td>
                  <td>
                    <Text size={1}>{formatCouponActivityWindow(coupon)}</Text>
                  </td>
                  <td>
                    <Text size={1}>{formatDateTime(coupon.updatedAt)}</Text>
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
