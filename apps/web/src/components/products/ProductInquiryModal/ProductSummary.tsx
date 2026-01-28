import Image from '@/components/shared/Image';
import { formatPrice } from '@/src/global/utils';

import type { ProductContext } from '.';
import styles from './styles.module.scss';

interface ProductSummaryProps {
  product: ProductContext;
}

export default function ProductSummary({ product }: ProductSummaryProps) {
  const { configurationOptions } = product;
  
  // Calculate if there are any price additions
  const totalAdditions = configurationOptions.reduce(
    (sum, opt) => sum + opt.priceDelta,
    0
  );

  const hasConfiguration = configurationOptions.length > 0;

  return (
    <div 
      className={styles.productSummary}
      data-has-config={hasConfiguration}
    >
      {/* Product Header */}
      <div className={styles.productHeader}>
        <div className={styles.productImage}>
          <Image
            image={product.image}
            sizes="88px"
            alt={`${product.brandName} ${product.name}`}
          />
        </div>
        <div className={styles.productInfo}>
          <span className={styles.brandName}>{product.brandName}</span>
          <span className={styles.productName}>{product.name}</span>
        </div>
      </div>

      {/* Configuration Options with Prices */}
      {hasConfiguration && (
        <div className={styles.configurationSection}>
          <span className={styles.configurationLabel}>Wybrana konfiguracja</span>
          <div className={styles.configurationList}>
            {configurationOptions.map((option, index) => (
              <div key={index} className={styles.configurationItem}>
                <div className={styles.configItemLeft}>
                  <span className={styles.configItemLabel}>{option.label}</span>
                  <span className={styles.configItemValue}>{option.value}</span>
                </div>
                {option.priceDelta > 0 && (
                  <span className={styles.configItemPrice}>
                    +{formatPrice(option.priceDelta)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Breakdown */}
      <div className={styles.priceSection}>
        {totalAdditions > 0 && (
          <>
            <div className={styles.priceRow}>
              <span className={styles.priceLabel}>Cena bazowa</span>
              <span className={styles.priceValue}>
                {formatPrice(product.basePrice)}
              </span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.priceLabel}>Dodatki</span>
              <span className={styles.priceValue}>
                +{formatPrice(totalAdditions)}
              </span>
            </div>
            <div className={styles.priceDivider} />
          </>
        )}
        <div className={styles.priceRowTotal}>
          <span className={styles.priceLabelTotal}>Razem</span>
          <span className={styles.priceTotal}>
            {formatPrice(product.totalPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}
