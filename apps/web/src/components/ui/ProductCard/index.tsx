import type { ProductType } from '@/src/global/types';

import Image from '../../shared/Image';
import Button from '../Button';
import styles from './styles.module.scss';

interface ProductCardProps {
  product: ProductType;
  headingLevel?: 'h2' | 'h3';
  imageSizes?: string;
  showButton?: boolean;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
}

export default function ProductCard({
  product,
  imageSizes = '400px',
  headingLevel = 'h3',
  showButton = true,
  priority = false,
  loading = 'lazy',
}: ProductCardProps) {
  const { slug, name, subtitle, price, brand, mainImage } = product;

  const Heading = headingLevel;

  // Format price for display
  const formatPrice = (price: number | null) => {
    if (!price) return 'Cena na zapytanie';
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <article className={styles.productCard}>
      <a href={slug!} className={styles.link}>
        <div className={styles.imgBox}>
          <Image
            image={mainImage}
            sizes={imageSizes}
            fill
            priority={priority}
            loading={loading}
          />
          <Image image={brand!.logo} sizes="90px" loading={loading} />
          {showButton && (
            <button
              className={styles.addToComparison}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <span>Dodaj do porównania</span>
              <PlusIcon />
            </button>
          )}
        </div>
        <div className={styles.container}>
          <Heading className={styles.title}>
            {brand!.name} {name}
          </Heading>
          <p className={styles.subtitle}>{subtitle}</p>
          <div className={styles.priceContainer}>
            <span className={styles.price}>{formatPrice(price)}</span>
            {showButton && (
              <Button
                tabIndex={-1}
                text="Dowiedz się więcej"
                variant="primary"
              />
            )}
          </div>
        </div>
      </a>
    </article>
  );
}

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={25} fill="none">
    <g
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.875}
      clipPath="url(#a)"
    >
      <path d="M9 12.5h6M12 9.5v6M12 3.5c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 .5h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
