import Link from 'next/link';

import Image from '@/components/shared/Image';
import type { CartState } from '@/src/global/b2c/cart/types';

import { renderPrice } from './helpers';
import styles from './styles.module.scss';

type CheckoutOrderPreviewProps = {
  cart: CartState;
};

export default function CheckoutOrderPreview({
  cart,
}: CheckoutOrderPreviewProps) {
  return (
    <section className={styles.orderPreviewCard}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionHeading}>Koszyk ({cart.lines.length})</h2>
        <Link href="/koszyk/" className="link">
          Zmień koszyk
        </Link>
      </div>

      <ul className={styles.orderPreviewList}>
        {cart.lines.map((line) => (
          <li key={line.lineId} className={styles.orderPreviewItem}>
            <div className={styles.orderPreviewMedia}>
              <Image image={line.product.image} sizes="96px" />
            </div>

            <div className={styles.orderPreviewMeta}>
              <span className={styles.orderPreviewName}>
                {line.productName}
              </span>
              <span className={styles.orderPreviewQuantity}>
                {line.quantity} szt.
              </span>
            </div>

            <span className={styles.orderPreviewPrice}>
              {renderPrice(line.unitPriceCents * line.quantity)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
