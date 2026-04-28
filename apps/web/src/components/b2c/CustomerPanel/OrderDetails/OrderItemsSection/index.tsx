import Image from '@/src/components/shared/Image';
import type { CustomerOrderDetailItem } from '@/src/global/b2c/customer-auth/server/order-detail';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type OrderItemsSectionProps = {
  items: CustomerOrderDetailItem[];
};

function ProductItem({ item }: { item: CustomerOrderDetailItem }) {
  const fallbackInitial = (item.brandName || item.productName || '?').charAt(0);

  return (
    <li
      className={styles.productItem}
      data-has-details={
        item.details.length > 0 || item.cpoContext ? 'true' : 'false'
      }
    >
      <div className={styles.productImageBox}>
        {item.productImage ? (
          <Image
            image={item.productImage}
            sizes="(max-width: 37.4375rem) 5.5rem, 7rem"
            fill
          />
        ) : (
          <span className={styles.imageFallback} aria-hidden="true">
            {fallbackInitial}
          </span>
        )}
      </div>
      <div className={styles.productName}>
        <span className={styles.productBrand}>{item.brandName}</span>
        <h3>{item.productName}</h3>
      </div>

      {(item.details.length > 0 || item.cpoContext) && (
        <ul className={styles.productDetails}>
          {item.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
          {item.cpoContext ? <li>{item.cpoContext}</li> : null}
        </ul>
      )}

      <div className={styles.productValue}>
        <span>Ilość: {item.quantity} szt.</span>
        <strong>{formatPrice(item.lineTotalCents)}</strong>
      </div>
    </li>
  );
}

export default function OrderItemsSection({ items }: OrderItemsSectionProps) {
  return (
    <section className={styles.section}>
      <h2>Produkty</h2>
      <ul className={styles.productList}>
        {items.map((item) => (
          <ProductItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
