import type { PageBuilderBlock } from '../../shared/PageBuilder';
import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import PublicationsCarousel from './PublicationsCarousel';
import styles from './styles.module.scss';

type FeaturedPublicationsProps = Extract<
  PageBuilderBlock,
  { _type: 'featuredPublications' }
>;

export default function FeaturedPublications({
  heading,
  button,
  publications,
}: FeaturedPublicationsProps) {
  return (
    <section className={`${styles.featuredPublications} max-width-block`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel="h2"
          className={styles.heading}
        />
        <Button {...button} />
      </header>

      <PublicationsCarousel publications={publications} />
    </section>
  );
}
