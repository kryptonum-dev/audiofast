import {
  formatCustomerOrderDateTime,
  getCustomerOrderStatusLabel,
} from "@/src/global/b2c/customer-auth/orders-formatting";
import type { CustomerOrderDetail } from "@/src/global/b2c/customer-auth/server/order-detail";
import { formatPrice } from "@/src/global/utils";

import styles from "./styles.module.scss";

type TimelineSummarySectionProps = {
  order: CustomerOrderDetail;
};

export default function TimelineSummarySection({
  order,
}: TimelineSummarySectionProps) {
  return (
    <div className={styles.twoColumnRow}>
      <section className={`${styles.equalSection} ${styles.timelineSection}`}>
        <h2>Historia zamówienia</h2>
        <ol className={styles.timeline}>
          {order.timeline.map((entry) => (
            <li key={entry.id} className={styles.timelineItem}>
              <span className={styles.timelineMarker} aria-hidden="true" />
              <div className={styles.timelineContent}>
                <strong>
                  {getCustomerOrderStatusLabel({
                    currentStatus: entry.status,
                    accessKind:
                      entry.status === "awaiting_payment"
                        ? "awaiting_payment_active"
                        : "customer_visible",
                  })}
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
                    {item.brandName ? `${item.brandName} ` : ""}
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
                      : "Rabat zamówienia"}
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
  );
}
