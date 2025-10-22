import type { PortableTextProps } from '@/global/types';
import type { QueryBlogPostBySlugResult } from '@/src/global/sanity/sanity.types';

import PortableText from '../../portableText';
import DateBox from '../../ui/DateBox';
import PublicationType from '../../ui/PublicationType';
import TableOfContent from '../../ui/TableOfContent';
import Image from '../Image';
import styles from './styles.module.scss';

type Props = NonNullable<QueryBlogPostBySlugResult>;

export function ArticleBody({
  headings,
  name,
  description,
  content,
  image,
  category,
  _createdAt,
  _type,
}: Props) {
  const publicationType =
    _type === 'blog-article' ? category?.name : 'Recenzja';
  return (
    <article className={`${styles.container} content`}>
      <TableOfContent headings={headings as unknown as PortableTextProps[]} />
      <header className={styles.header}>
        <PublicationType publicationType={publicationType!} />
        <DateBox _createdAt={_createdAt} />
        <PortableText
          value={name}
          className={styles.heading}
          headingLevel="h1"
        />
        <PortableText value={description} className={styles.description} />
        <Image
          image={image}
          priority
          loading="eager"
          sizes="(max-width: 37.4375rem) 96vw, (max-width: 56.125rem) 83vw, (max-width: 69.3125rem) 768px, 704px"
        />
      </header>
      <PortableText
        enablePortableTextStyles
        addHeadingIds
        value={content}
        className={`${styles.body} content-body`}
      />
    </article>
  );
}
