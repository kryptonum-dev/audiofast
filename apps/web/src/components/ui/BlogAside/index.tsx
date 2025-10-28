import Pill from '../Pill';
import Searchbar from '../Searchbar';
import styles from './styles.module.scss';

type BlogAsideProps = {
  categories: {
    _id: string;
    name: string | null;
    slug: string | null;
    count: number;
  }[];
  totalCount: number;
  basePath?: string;
  currentCategory?: string | null;
};

export default function BlogAside({
  categories,
  totalCount,
  basePath = '/blog/',
  currentCategory = null,
}: BlogAsideProps) {
  // Check if we're on the main blog page (no category selected)
  const isAllPostsActive = !currentCategory || currentCategory === '';

  return (
    <aside className={styles.sidebar}>
      <Searchbar basePath={basePath} />
      <nav className={styles.categories}>
        <Pill
          label="Wszystkie publikacje"
          count={totalCount}
          isActive={isAllPostsActive}
          href="/blog/"
        />
        {categories.map((category) => {
          const categorySlug = category.slug
            ?.replace('/blog/', '')
            .replace('/', '');

          // Check if this category is active
          const isActive = currentCategory === categorySlug;

          return (
            <Pill
              key={category._id}
              label={category.name!}
              count={category.count}
              isActive={isActive}
              href={`/blog/kategoria/${categorySlug}/`}
            />
          );
        })}
      </nav>
    </aside>
  );
}
