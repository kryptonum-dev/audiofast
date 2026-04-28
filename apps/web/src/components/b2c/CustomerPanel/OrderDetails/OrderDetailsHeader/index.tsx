import Button from '@/src/components/ui/Button';
import {
  formatCustomerOrderDateTime,
  getCustomerOrderStatusLabel,
} from '@/src/global/b2c/customer-auth/orders-formatting';
import type { CustomerOrderDetail } from '@/src/global/b2c/customer-auth/server/order-detail';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type OrderDetailsHeaderProps = {
  order: CustomerOrderDetail;
};

function renderOptionalValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : 'Brak danych';
}

function renderLineCount(items: CustomerOrderDetail['items']): string {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  if (count === 1) {
    return '1 produkt';
  }

  if (count > 1 && count < 5) {
    return `${count} produkty`;
  }

  return `${count} produktów`;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd>{renderOptionalValue(value)}</dd>
    </div>
  );
}

export default function OrderDetailsHeader({ order }: OrderDetailsHeaderProps) {
  const statusLabel = getCustomerOrderStatusLabel(order);
  const isAwaitingPayment = order.accessKind === 'awaiting_payment_active';

  return (
    <>
      <header className={styles.pageHeader}>
        <h1>Zamówienie {order.orderNumber}</h1>
        <Button
          href="/konto-klienta/zamowienia/"
          variant="secondary"
          iconUsed="arrowLeft"
          className={styles.backButton}
        >
          Wróć do zamówień
        </Button>
      </header>

      <section
        className={styles.orderFacts}
        aria-label="Podsumowanie zamówienia"
      >
        <dl className={styles.factsGrid}>
          <DetailRow
            label="Kwota zamówienia"
            value={formatPrice(order.grandTotalCents)}
          />
          <DetailRow
            label="Liczba produktów"
            value={renderLineCount(order.items)}
          />
          <DetailRow
            label="Status płatności"
            value={isAwaitingPayment ? 'Oczekuje na płatność' : statusLabel}
          />
          <DetailRow
            label="Data zamówienia"
            value={formatCustomerOrderDateTime(order.createdAt)}
          />
          {isAwaitingPayment ? (
            <DetailRow
              label="Płatność aktywna do"
              value={formatCustomerOrderDateTime(order.payableUntil)}
            />
          ) : null}
        </dl>
      </section>
    </>
  );
}
