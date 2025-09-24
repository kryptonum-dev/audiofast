import Image from '../../shared/Image';
import type { PageBuilderBlock } from '../../shared/PageBuilder';
import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import styles from './styles.module.scss';

type LatestPublicationProps = Extract<
  PageBuilderBlock,
  { _type: 'latestPublication' }
>;

export default function LatestPublication({
  heading,
  publication,
}: LatestPublicationProps) {
  const { _type, _createdAt, slug, name, title, description, image } =
    publication;

  // Get the publication type label
  const publicationTypeLabel =
    _type === 'review'
      ? 'Recenzja'
      : ('_type' in publication && publication._type === 'blog-article'
          ? (publication as { category?: { name?: string } }).category?.name
          : null) || 'Artykuł';

  // Format the creation date
  const formattedDate = new Date(_createdAt).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className={`${styles.latestPublication} max-width`}>
      <PortableText
        value={heading}
        headingLevel="h2"
        className={styles.heading}
      />
      <article className={styles.container}>
        <Image image={image} sizes="502px" />
        <header className={styles.header}>
          <span className={styles.date}>
            <CalendarIcon />
            <time dateTime={_createdAt}>{formattedDate}</time>
          </span>
          <span className={styles.publicationType}>{publicationTypeLabel}</span>
          <PortableText
            value={title}
            headingLevel="h3"
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

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={17} fill="none">
    <g
      stroke="#000"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={0.875}
      clipPath="url(#a)"
    >
      <path d="M2.666 5.288a1.333 1.333 0 0 1 1.333-1.334h8a1.333 1.333 0 0 1 1.334 1.334v8a1.333 1.333 0 0 1-1.334 1.333H4a1.333 1.333 0 0 1-1.333-1.333v-8ZM10.669 2.62v2.667M5.332 2.62v2.667M2.666 7.955h10.667" />
      <path d="M5.332 10.62h1.333v1.334H5.332v-1.333Z" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 .62h16v16H0z" />
      </clipPath>
    </defs>
  </svg>
);
