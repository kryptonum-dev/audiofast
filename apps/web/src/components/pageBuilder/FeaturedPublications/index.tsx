import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import PublicationsCarousel from './PublicationsCarousel';
import styles from './styles.module.scss';

type FeaturedPublicationsProps = PagebuilderType<'featuredPublications'> & {
  index: number;
  publicationLayout?: 'vertical' | 'horizontal';
  customId?: string;
};

export default function FeaturedPublications({
  customId,
  heading,
  publications,
  index,
  publicationLayout = 'horizontal',
}: FeaturedPublicationsProps) {
  return (
    <section
      id={customId}
      className={`${styles.featuredPublications} max-width-block`}
    >
      <header className={styles.header}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
          className={styles.heading}
        />
      </header>
      <PublicationsCarousel
        publications={publications!}
        index={index}
        publicationLayout={publicationLayout}
      />
    </section>
  );
}
