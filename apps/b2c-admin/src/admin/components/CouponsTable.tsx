import { EditIcon, TrashIcon } from "@sanity/icons";
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Inline,
  Stack,
  Text,
} from "@sanity/ui";

import {
  formatCouponActivityWindow,
  formatCouponDiscount,
  formatCouponScope,
  formatDateTime,
} from "../formatters.js";
import type { AdminCoupon } from "../types.js";
import { CouponStatusBadge } from "./CouponStatusBadge.js";

type CouponsTableProps = {
  archivingCouponId?: string | null;
  bulkArchiving?: boolean;
  coupons: AdminCoupon[];
  onOpenCoupon?: (couponId: string) => void;
  onRequestArchiveCoupon?: (coupon: AdminCoupon) => void;
  onSelectCoupon?: (couponId: string, selected: boolean) => void;
  onSelectVisibleCoupons?: (selected: boolean) => void;
  selectedCouponIds?: string[];
};

export function CouponsTable({
  archivingCouponId = null,
  bulkArchiving = false,
  coupons,
  onOpenCoupon,
  onRequestArchiveCoupon,
  onSelectCoupon,
  onSelectVisibleCoupons,
  selectedCouponIds = [],
}: CouponsTableProps) {
  const selectedCouponIdSet = new Set(selectedCouponIds);
  const allVisibleSelected =
    coupons.length > 0 && coupons.every((coupon) => selectedCouponIdSet.has(coupon.id));
  const someVisibleSelected = coupons.some((coupon) =>
    selectedCouponIdSet.has(coupon.id),
  );

  return (
    <Box paddingX={3}>
      <Card border radius={2}>
        <Box className="ordersTableScroller">
          <table className="ordersTable">
            <thead>
              <tr>
                <th>
                  <span className="couponTableCheckboxControl">
                    <Checkbox
                      aria-label="Zaznacz widoczne kupony"
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onChange={(event) =>
                        onSelectVisibleCoupons?.(event.currentTarget.checked)
                      }
                    />
                  </span>
                </th>
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
                <tr
                  key={coupon.id}
                  aria-label={`Edytuj kupon ${coupon.code}`}
                  className={
                    onOpenCoupon ? "ordersTableRowClickable" : undefined
                  }
                  onKeyDown={(event) => {
                    if (!onOpenCoupon) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenCoupon(coupon.id);
                    }
                  }}
                  onClick={() => onOpenCoupon?.(coupon.id)}
                  role={onOpenCoupon ? "button" : undefined}
                  tabIndex={onOpenCoupon ? 0 : undefined}
                >
                  <td>
                    <span className="couponTableCheckboxControl">
                      <Checkbox
                        aria-label={`Zaznacz kupon ${coupon.code}`}
                        checked={selectedCouponIdSet.has(coupon.id)}
                        onChange={(event) => {
                          event.stopPropagation();
                          onSelectCoupon?.(
                            coupon.id,
                            event.currentTarget.checked,
                          );
                        }}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </span>
                  </td>
                  <td>
                    <Flex align="center" gap={3}>
                      <Inline space={1}>
                        <Button
                          aria-label={`Edytuj kupon ${coupon.code}`}
                          icon={EditIcon}
                          mode="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenCoupon?.(coupon.id);
                          }}
                          padding={2}
                          type="button"
                        />
                        <Button
                          aria-label={`Usuń kupon ${coupon.code}`}
                          disabled={
                            bulkArchiving || archivingCouponId === coupon.id
                          }
                          icon={TrashIcon}
                          mode="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRequestArchiveCoupon?.(coupon);
                          }}
                          padding={2}
                          tone="critical"
                          type="button"
                        />
                      </Inline>
                      <Stack space={2}>
                        <Text size={1} weight="medium">
                          {coupon.code}
                        </Text>
                        <Text muted size={1}>
                          Utworzono {formatDateTime(coupon.createdAt)}
                        </Text>
                      </Stack>
                    </Flex>
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
