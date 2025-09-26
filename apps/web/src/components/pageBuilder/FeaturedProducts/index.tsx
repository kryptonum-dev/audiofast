import type { PageBuilderBlock } from '../../shared/PageBuilder';
import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import Carousels from './Carousels';
import styles from './styles.module.scss';

type FeaturedProductsProps = Extract<
  PageBuilderBlock,
  { _type: 'featuredProducts' }
>;

export default function FeaturedProducts({
  heading,
  description,
  button,
  newProducts,
  bestsellers,
}: FeaturedProductsProps) {
  return (
    <section className={`${styles.featuredProducts} max-width`}>
      <Carousels newProducts={newProducts} bestsellers={bestsellers}>
        <>
          <PortableText value={heading} headingLevel="h2" />
          <PortableText value={description} enablePortableTextStyles />
          <Button {...button} />
        </>
      </Carousels>
    </section>
  );
}
