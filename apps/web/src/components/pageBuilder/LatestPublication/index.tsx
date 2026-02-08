import type { PagebuilderType, PortableTextProps } from '@/src/global/types';

import PortableText from '../../portableText';
import Image from '../../shared/Image';
import Button from '../../ui/Button';
import DateBox from '../../ui/DateBox';
import PublicationType from '../../ui/PublicationType';
import styles from './styles.module.scss';

type LatestPublicationProps = PagebuilderType<'latestPublication'> & {
  index: number;
};

export default function LatestPublication({
  heading,
  publication,
  index,
}: LatestPublicationProps) {
  const {
    _type,
    _createdAt,
    publishDate,
    slug,
    title,
    name,
    description,
    image,
    publicationType,
    openInNewTab,
  } = publication!;

  // Products use name field instead of portable text title
  const isProduct = _type === 'product';
  const TitleHeading = index === 0 ? 'h2' : 'h3';

  // Determine button text based on publication type
  const buttonText = isProduct
    ? 'Zobacz produkt'
    : _type === 'blog-article'
      ? 'Czytaj artykuł'
      : 'Przeczytaj recenzję';

  return (
    <section className={`${styles.latestPublication} max-width`}>
      <PortableText
        value={heading}
        headingLevel={index === 0 ? 'h1' : 'h2'}
        className={styles.heading}
      />
      <article className={styles.container}>
        <Image
          image={image}
          priority={index === 0}
          loading={index === 0 ? 'eager' : 'lazy'}
          sizes="(max-width: 37.4375rem) 94vw, (max-width: 56.1875rem) 83vw, 502px"
        />
        <header className={styles.header}>
          <DateBox date={publishDate || _createdAt} />
          <PublicationType publicationType={publicationType!} />
          {isProduct ? (
            <TitleHeading className={styles.title}>{name}</TitleHeading>
          ) : (
            <PortableText
              value={title}
              headingLevel={index === 0 ? 'h2' : 'h3'}
              className={styles.title}
            />
          )}

          {description && (
            <PortableText
              value={description as unknown as PortableTextProps}
              enablePortableTextStyles
              className={styles.description}
            />
          )}
          <Button href={slug} text={buttonText} openInNewTab={openInNewTab} />
        </header>
      </article>
    </section>
  );
}
