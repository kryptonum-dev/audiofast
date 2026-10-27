import type { ScopedDataAttribute } from '@/global/sanity/data-attribute';
import type { PortableTextProps, ProductType } from '@/global/types';
import type {
  QueryBlogPostBySlugResult,
  QueryReviewBySlugResult,
} from '@/src/global/sanity/sanity.types';

import PortableText from '../../portableText';
import Image from '../../shared/Image';
import DateBox from '../../ui/DateBox';
import ProductCard from '../../ui/ProductCard';
import PublicationType from '../../ui/PublicationType';
import TableOfContent from '../../ui/TableOfContent';
import styles from './styles.module.scss';

type Props = (
  NonNullable<QueryBlogPostBySlugResult> | NonNullable<QueryReviewBySlugResult>
) & {
  /** Draft only: scoped to `content`, so nested custom-block arrays are draggable. */
  contentDataAttribute?: ScopedDataAttribute | null;
};

export function ArticleBody({
  headings,
  title,
  content,
  image,
  _createdAt,
  _type,
  contentDataAttribute,
  ...props
}: Props) {
  const publicationType =
    _type === 'blog-article' && 'category' in props
      ? props.category?.name
      : 'Recenzja';

  // Use publishDate for both blog articles and reviews
  // For reviews, publishDate contains coalesce(publishedDate, _createdAt) from the query
  const displayDate =
    'publishDate' in props ? props.publishDate || _createdAt : _createdAt;

  return (
    <article
      className={`${styles.container} content`}
      data-is-review={_type == 'review'}
    >
      {_type == 'review' && 'product' in props && props.product ? (
        <div className={styles.reviewHeader}>
          <TableOfContent
            headings={headings as unknown as PortableTextProps[]}
          />
          <ProductCard product={props.product as unknown as ProductType} />
        </div>
      ) : (
        <TableOfContent headings={headings as unknown as PortableTextProps[]} />
      )}
      <header className={styles.header}>
        <PublicationType publicationType={publicationType!} />
        <DateBox date={displayDate} />
        <PortableText
          value={title}
          className={styles.heading}
          headingLevel="h1"
        />
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
        dataAttribute={contentDataAttribute}
      />
    </article>
  );
}
