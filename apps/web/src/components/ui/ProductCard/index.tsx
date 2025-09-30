import type { QueryHomePageResult } from '../../../global/sanity/sanity.types';
import Image from '../../shared/Image';
import Button from '../Button';
import styles from './styles.module.scss';

// Extract the product type from FeaturedProducts
type FeaturedProductsType = Extract<
  NonNullable<NonNullable<QueryHomePageResult>['pageBuilder']>[number],
  { _type: 'featuredProducts' }
>;

export type ProductType = NonNullable<
  FeaturedProductsType['newProducts']
>[number];

interface ProductCardProps {
  product: ProductType;
  headingLevel?: 'h2' | 'h3';
  imageSizes?: string;
  showButton?: boolean;
}

export default function ProductCard({
  product,
  imageSizes = '400px',
  headingLevel = 'h3',
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
          <Image image={mainImage} sizes={imageSizes} fill />
          <Image image={brand!.logo} sizes="90px" />
          <button
            className={styles.addToComparison}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('clicked');
            }}
          >
            <span>Dodaj do porównania</span>
            <PlusIcon />
          </button>
        </div>
        <div className={styles.container}>
          <Heading className={styles.title}>
            {brand!.name} {name}
          </Heading>
          <p className={styles.subtitle}>{subtitle}</p>
          <div className={styles.priceContainer}>
            <span className={styles.price}>{formatPrice(price)}</span>
            <Button tabIndex={-1} text="Dowiedz się więcej" variant="primary" />
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
