import type { PublicationType as PublicationTypeProps } from '@/src/global/types';
import { portableTextToPlainString } from '@/src/global/utils';

import Image from '../../shared/Image';
import Button from '../Button';
import DateBox from '../DateBox';
import PublicationType from '../PublicationType';
import styles from './styles.module.scss';

type PublicationCardProps = {
  publication: PublicationTypeProps;
  layout?: 'vertical' | 'horizontal';
  headingLevel?: 'h2' | 'h3';
  imageSizes?: string;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
};

export default function PublicationCard({
  publication,
  layout = 'vertical',
  imageSizes = '400px',
  headingLevel = 'h3',
  priority = false,
  loading = 'lazy',
}: PublicationCardProps) {
  const {
    _createdAt,
    publishDate,
    slug,
    title,
    image,
    publicationType,
    openInNewTab,
  } = publication;

  const Heading = headingLevel;

  return (
    <article className={styles.publicationCard} data-layout={layout}>
      <a
        href={slug!}
        className={styles.link}
        {...(openInNewTab && { target: '_blank', rel: 'noopener noreferrer' })}
      >
        <Image
          image={image}
          sizes={imageSizes}
          priority={priority}
          loading={loading}
        />
        <div className={styles.content}>
          <PublicationType publicationType={publicationType!} />
          <DateBox date={publishDate || _createdAt} />
          <Heading className={styles.title}>
            {portableTextToPlainString(title)}
          </Heading>
          {layout === 'vertical' && (
            <Button tabIndex={-1} text="Czytaj artykuł" variant="primary" />
          )}
        </div>
      </a>
    </article>
  );
}
