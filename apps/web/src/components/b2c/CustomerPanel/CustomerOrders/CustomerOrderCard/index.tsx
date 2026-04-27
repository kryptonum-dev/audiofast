import Link from 'next/link';

import Image from '@/src/components/shared/Image';
import Button from '@/src/components/ui/Button';
import {
  formatCustomerOrderDate,
  getCustomerOrderStatusLabel,
  getCustomerOrderStatusTone,
} from '@/src/global/b2c/customer-auth/orders-formatting';
import type { CustomerOrdersListItem } from '@/src/global/b2c/customer-auth/server/orders';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type CustomerOrderCardProps = {
  order: CustomerOrdersListItem;
  priority?: boolean;
};

export default function CustomerOrderCard({
  order,
  priority = false,
}: CustomerOrderCardProps) {
  const isAwaitingPayment = order.accessKind === 'awaiting_payment_active';
  const tone = getCustomerOrderStatusTone(order);
  const statusLabel = getCustomerOrderStatusLabel(order);
  const detailsHref = `/konto-klienta/zamowienia/${order.orderNumber}/`;
  const additionalCount = Math.max(0, order.totalItemCount - 1);
  const productImage = order.leadItem?.productImage ?? null;
  const productName = order.leadItem?.productName ?? 'Pozycja zamówienia';
  const brandName = order.leadItem?.brandName ?? null;
  const fallbackInitial = (brandName ?? productName ?? '?').charAt(0);

  return (
    <li className={styles.orderListItem}>
      <Link
        href={detailsHref}
        className={styles.orderCard}
        aria-label={`Zobacz szczegóły zamówienia ${order.orderNumber}`}
      >
        <div className={styles.imageBox}>
          {productImage ? (
            <Image
              image={productImage}
              sizes="(max-width: 28.0625rem) calc(100vw - 3rem), (max-width: 34.3125rem) 7rem, (max-width: 45.5625rem) 10rem, clamp(7.5rem, 12vw, 10rem)"
              fill
              loading={priority ? 'eager' : 'lazy'}
              priority={priority}
              fetchPriority={priority ? 'high' : 'auto'}
            />
          ) : (
            <span className={styles.imageFallback} aria-hidden="true">
              {fallbackInitial}
            </span>
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.bodyTop}>
            <span className={styles.eyebrow}>
              Zamówienie {order.orderNumber}
            </span>
            <h2 className={styles.productName}>
              {brandName ? `${brandName} ` : ''}
              {productName}
            </h2>
            {additionalCount > 0 ? (
              <p className={styles.productExtra}>
                {additionalCount === 1
                  ? 'oraz 1 inna pozycja'
                  : `oraz ${additionalCount} inne pozycje`}
              </p>
            ) : null}
          </div>

          <dl className={styles.bodyBottom}>
            <div className={styles.metaItem}>
              <dt className={styles.metaLabel}>Data zamówienia</dt>
              <dd className={styles.metaValue}>
                {formatCustomerOrderDate(order.createdAt)}
              </dd>
            </div>
            <div className={styles.metaItem}>
              <dt className={styles.metaLabel}>Wartość</dt>
              <dd className={styles.metaValue}>
                {formatPrice(order.grandTotalCents)}
              </dd>
            </div>
          </dl>

          {isAwaitingPayment ? (
            <p className={styles.paymentHint}>
              Płatność jest możliwa do{' '}
              <strong>{formatCustomerOrderDate(order.payableUntil)}</strong>.
            </p>
          ) : null}
        </div>

        <div className={styles.actions}>
          <span className={styles.status} data-tone={tone}>
            {statusLabel}
          </span>
          <Button
            tabIndex={-1}
            variant="primary"
            iconUsed="arrowUp"
            className={styles.cta}
          >
            Dowiedz się więcej
          </Button>
        </div>
      </Link>
    </li>
  );
}
