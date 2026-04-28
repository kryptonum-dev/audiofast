import type { CustomerOrderDetail } from '@/src/global/b2c/customer-auth/server/order-detail';

import OrderCancellationSection from './OrderCancellationSection/index';
import OrderDataSection from './OrderDataSection/index';
import OrderDetailsHeader from './OrderDetailsHeader/index';
import OrderItemsSection from './OrderItemsSection/index';
import OrderRefundSection from './OrderRefundSection/index';
import styles from './styles.module.scss';
import TimelineSummarySection from './TimelineSummarySection/index';

type CustomerOrderDetailsProps = {
  order: CustomerOrderDetail;
};

export default function CustomerOrderDetails({
  order,
}: CustomerOrderDetailsProps) {
  const isCompanyInvoice = order.invoice.recipientType === 'company';

  return (
    <article className={styles.orderDetailPage}>
      <OrderDetailsHeader order={order} />
      <OrderItemsSection items={order.items} />
      <TimelineSummarySection order={order} />
      <OrderDataSection order={order} />
      <div
        className={styles.actionsRow}
        data-single-action={isCompanyInvoice ? 'true' : 'false'}
      >
        <OrderCancellationSection order={order} />
        {isCompanyInvoice ? null : <OrderRefundSection order={order} />}
      </div>
    </article>
  );
}
