'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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
  initialSearch?: string;
};

export default function BlogAside({
  categories,
  totalCount,
  basePath = '/blog/',
  currentCategory = null,
  initialSearch = '',
}: BlogAsideProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(initialSearch);

  // Check if we're on the main blog page (no category selected)
  const isAllPostsActive = !currentCategory || currentCategory === '';

  const applySearch = () => {
    const params = new URLSearchParams();

    // Remove page param to reset pagination
    // Add search term if present
    if (localSearch.trim()) {
      params.set('search', localSearch.trim());
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  return (
    <aside className={styles.sidebar}>
      <Searchbar
        mode="manual"
        value={localSearch}
        onChange={(value) => setLocalSearch(value)}
        onSubmit={applySearch}
        placeholder="Szukaj"
      />
      <nav className={styles.categories}>
        <Pill
          label="Wszystkie publikacje"
          count={totalCount}
          isActive={isAllPostsActive}
          href="/blog/"
        />
        {categories.map((category) => {
          const categorySlug = category.slug
            ?.replace('/blog/kategoria/', '')
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
