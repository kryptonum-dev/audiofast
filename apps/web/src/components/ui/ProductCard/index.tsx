import Link from 'next/link';

import type { ProductType } from '@/src/global/types';
import { formatPrice } from '@/src/global/utils';
import { hasText } from '@/src/global/utils/stega-text';

import Image from '../../shared/Image';
import Button from '../Button';
import AddToComparisonButton from './AddToComparisonButton';
import ProductCardAddToCart from './ProductCardAddToCart';
import styles from './styles.module.scss';

interface ProductCardProps {
  product: ProductType;
  headingLevel?: 'h2' | 'h3';
  imageSizes?: string;
  showButton?: boolean;
  /** Shows "Dodaj do koszyka" for products sold online. Defaults to `showButton`. */
  showCartButton?: boolean;
  layout?: 'horizontal' | 'vertical';
  priority?: boolean;
  loading?: 'eager' | 'lazy';
  /** Draft only: `data-sanity` of the authored array item rendering this card. */
  dataSanity?: string;
}

export default function ProductCard({
  product,
  layout = 'horizontal',
  imageSizes = '400px',
  headingLevel = 'h3',
  showButton = true,
  showCartButton = showButton,
  priority = false,
  loading = 'lazy',
  dataSanity,
}: ProductCardProps) {
  const {
    slug,
    name,
    subtitle,
    basePriceCents,
    hasMultiplePrices,
    isSellableOnline,
    brand,
    mainImage,
    _id,
    categories,
  } = product;
  const Heading = headingLevel;
  const productHref = typeof slug === 'string' && slug.length > 0 ? slug : null;
  const brandName = brand?.name ?? '';
  const productName = name ?? '';
  const hasPrice = typeof basePriceCents === 'number' && basePriceCents > 0;

  // The whole tile stays clickable through the stretched title link
  // (.link::after); the action buttons sit above that overlay, outside the
  // link, so the markup has no interactive elements nested in <a>.
  const showLearnMore = showButton && productHref !== null;
  const showAddToCart =
    showCartButton &&
    productHref !== null &&
    isSellableOnline === true &&
    hasPrice;

  const titleText = (
    <>
      {hasText(brandName) && `${brandName} `}
      {name}
    </>
  );

  return (
    <article
      className={styles.productCard}
      data-layout={layout}
      data-sanity={dataSanity}
    >
      <div className={styles.imgBox}>
        <Image
          image={mainImage}
          sizes={imageSizes}
          fill
          priority={priority}
          loading={loading}
        />
        {brand?.logo && (
          <Image image={brand.logo} sizes="90px" loading={loading} />
        )}
      </div>
      <div className={styles.container}>
        <Heading className={styles.title}>
          {productHref ? (
            <Link href={productHref} className={styles.link}>
              {titleText}
            </Link>
          ) : (
            titleText
          )}
        </Heading>
        <p className={styles.subtitle}>{subtitle}</p>
        <div
          className={styles.priceContainer}
          data-with-cart={showAddToCart ? 'true' : undefined}
        >
          <span className={styles.price}>
            {hasMultiplePrices ? 'od ' : ''}
            {hasPrice ? formatPrice(basePriceCents) : 'Brak ceny'}
          </span>
          {productHref && (showAddToCart || showLearnMore) && (
            <div className={styles.actions}>
              {showAddToCart && (
                <ProductCardAddToCart
                  slug={productHref}
                  productName={productName}
                  brandName={brandName}
                  className={styles.actionButton}
                />
              )}
              {showLearnMore && (
                <Button
                  href={productHref}
                  text="Dowiedz się więcej"
                  variant={showAddToCart ? 'secondary' : 'primary'}
                  tabIndex={-1}
                  aria-hidden="true"
                  className={styles.actionButton}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <AddToComparisonButton
        productId={_id}
        productName={productName}
        categories={categories}
        productData={product}
      />
    </article>
  );
}
