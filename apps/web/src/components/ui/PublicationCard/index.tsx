import type { PortableTextBlock } from '@portabletext/react';

import type { QueryHomePageResult } from '@/global/sanity/sanity.types';
import { portableTextToPlainString } from '@/src/global/utils';

import Image from '../../shared/Image';
import Button from '../Button';
import DateBox from '../DateBox';
import PublicationType from '../PublicationType';
import styles from './styles.module.scss';

// Extract the publication type from FeaturedPublications
type FeaturedPublicationsType = Extract<
  NonNullable<NonNullable<QueryHomePageResult>['pageBuilder']>[number],
  { _type: 'featuredPublications' }
>;

export type PublicationType = NonNullable<
  FeaturedPublicationsType['publications']
>[number];

interface PublicationCardProps {
  publication: PublicationType;
  layout?: 'vertical' | 'horizontal';
  headingLevel?: 'h2' | 'h3';
  imageSizes?: string;
}

export default function PublicationCard({
  publication,
  layout = 'vertical',
  imageSizes = '400px',
  headingLevel = 'h3',
}: PublicationCardProps) {
  const { _createdAt, slug, name, image, publicationType } = publication;

  const Heading = headingLevel;

  return (
    <article className={styles.publicationCard} data-layout={layout}>
      <a href={`/${slug}`} className={styles.link}>
        <Image image={image} sizes={imageSizes} />
        <div className={styles.content}>
          <PublicationType publicationType={publicationType!} />
          <DateBox _createdAt={_createdAt} />
          <Heading className={styles.title}>
            {portableTextToPlainString(name! as PortableTextBlock[])}
          </Heading>
          {layout === 'vertical' && (
            <Button href={slug} text="Czytaj artykuł" variant="primary" />
          )}
        </div>
      </a>
    </article>
  );
}
