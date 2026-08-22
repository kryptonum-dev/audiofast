import type { BrandType, PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import Button from '../../ui/Button';
import CategoryAccordion from './CategoryAccordion';
import styles from './styles.module.scss';

type BrandsByCategoriesSectionProps =
  PagebuilderType<'brandsByCategoriesSection'> & {
    index: number;
  };

export default function BrandsByCategoriesSection({
  heading,
  description,
  button,
  categoriesWithBrands,
  index,
}: BrandsByCategoriesSectionProps) {
  // Deduplicate brands within each category
  const categoriesWithUniqueBrands = categoriesWithBrands
    ?.filter((category) => category != null)
    .map((category) => {
      const seenBrandIds = new Set<string>();
      const uniqueBrands: BrandType[] = [];

      category.brands?.forEach((brand) => {
        if (
          brand &&
          typeof brand === 'object' &&
          '_id' in brand &&
          'slug' in brand &&
          'name' in brand &&
          brand._id &&
          brand.slug &&
          brand.name &&
          !seenBrandIds.has(brand._id)
        ) {
          seenBrandIds.add(brand._id);
          uniqueBrands.push(brand as BrandType);
        }
      });

      return {
        _id: category._id || '',
        name: category.name || '',
        brands: uniqueBrands,
      };
    });

  return (
    <section className={`${styles.brandsByCategoriesSection} max-width-block`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
          className={styles.heading}
        />
        <PortableText
          value={description}
          enablePortableTextStyles
          className={styles.description}
        />
        <Button {...button} iconUsed="phone" />
      </header>
      <div className={styles.categoriesContainer}>
        {categoriesWithUniqueBrands?.map((category) => (
          <CategoryAccordion key={category._id} category={category} />
        ))}
      </div>
    </section>
  );
}
