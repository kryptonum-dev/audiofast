import {
  formatCustomerDeliveryEstimate,
  formatCustomerOrderDateTime,
  getCustomerTimelineStatusLabel,
} from '@/src/global/b2c/customer-auth/orders-formatting';
import type { CustomerOrderDetail } from '@/src/global/b2c/customer-auth/server/order-detail';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type TimelineSummarySectionProps = {
  order: CustomerOrderDetail;
};

export default function TimelineSummarySection({
  order,
}: TimelineSummarySectionProps) {
  const deliveryEstimateLabel = formatCustomerDeliveryEstimate(
    order.deliveryEstimate,
  );

  return (
    <div className={styles.timelineSummaryGroup}>
      <div className={styles.twoColumnRow}>
        <section className={`${styles.equalSection} ${styles.timelineSection}`}>
          <h2>Historia zamówienia</h2>
          <ol className={styles.timeline}>
            {order.timeline.map((entry) => (
              <li key={entry.id} className={styles.timelineItem}>
                <span className={styles.timelineMarker} aria-hidden="true" />
                <div className={styles.timelineContent}>
                  <strong>
                    {getCustomerTimelineStatusLabel(entry.status)}
                  </strong>
                  <span>{formatCustomerOrderDateTime(entry.changedAt)}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.equalSection} ${styles.pricingSection}`}>
          <h2>Podsumowanie płatności</h2>
          <div className={styles.pricingTable}>
            <dl className={styles.pricingRows}>
              {order.items.map((item) => (
                <div key={item.id} className={styles.pricingLine}>
                  <dt>
                    <strong>
                      {item.brandName ? `${item.brandName} ` : ''}
                      {item.productName}
                    </strong>
                    <span>
                      {item.quantity} × {formatPrice(item.unitPriceCents)}
                    </span>
                  </dt>
                  <dd>{formatPrice(item.lineSubtotalCents)}</dd>
                </div>
              ))}
              {order.discountTotalCents > 0 ? (
                <div className={styles.pricingLine}>
                  <dt>
                    <strong>Rabat</strong>
                    <span>
                      {order.discount?.couponCode
                        ? `Kod ${order.discount.couponCode}`
                        : 'Rabat zamówienia'}
                    </span>
                  </dt>
                  <dd>-{formatPrice(order.discountTotalCents)}</dd>
                </div>
              ) : null}
              <div className={styles.pricingLine}>
                <dt>
                  <strong>Dostawa</strong>
                  <span>W cenie zamówienia</span>
                </dt>
                <dd>W cenie</dd>
              </div>
            </dl>
            <div className={styles.pricingTotal}>
              <span>Razem do zapłaty</span>
              <strong>{formatPrice(order.grandTotalCents)}</strong>
            </div>
            <p className={styles.taxNote}>Ceny brutto, VAT wliczony w cenę.</p>
          </div>
        </section>
      </div>

      {deliveryEstimateLabel ? (
        <div className={styles.deliveryEstimateCard}>
          <span className={styles.deliveryEstimateIcon}>
            {DELIVERY_TRUCK_ICON}
          </span>
          <div className={styles.deliveryEstimateContent}>
            <h2>Przewidywana dostawa</h2>
            <p>{deliveryEstimateLabel}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const DELIVERY_TRUCK_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      clipPath="url(#delivery-truck-icon-clip)"
    >
      <path d="M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
      <path d="M5 17H3v-4M2 5h11v12m-4 0h6M13 6h5l3 5v6h-2m2-6h-8M3 9h4" />
    </g>
    <defs>
      <clipPath id="delivery-truck-icon-clip">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
