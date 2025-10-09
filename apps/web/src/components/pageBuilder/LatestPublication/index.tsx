import type { PagebuilderType } from '@/src/global/types';

import Image from '../../shared/Image';
import PortableText from '../../shared/PortableText';
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
  const { _createdAt, slug, name, description, image, publicationType } =
    publication!;

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
          <DateBox _createdAt={_createdAt} />
          <PublicationType publicationType={publicationType!} />
          <PortableText
            value={name}
            headingLevel={index === 0 ? 'h2' : 'h3'}
            className={styles.title}
          />
          <PortableText
            value={description}
            enablePortableTextStyles
            className={styles.description}
          />
          <Button href={slug} text="Przeczytaj artykuł" />
        </header>
      </article>
    </section>
  );
}
