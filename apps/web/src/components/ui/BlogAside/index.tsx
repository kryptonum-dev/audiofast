'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import Button from '../Button';
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
  availableYears: string[];
  basePath?: string;
  currentCategory?: string | null;
};

export default function BlogAside({
  categories,
  totalCount,
  availableYears,
  basePath = '/blog/',
  currentCategory = null,
}: BlogAsideProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(
    searchParams.get('search') || '',
  );

  // Get current year filter from URL
  const currentYear = searchParams.get('year') || '';

  // Check if we're on the main blog page (no category selected)
  const isAllPostsActive = !currentCategory || currentCategory === '';

  // Build URL with preserved params
  const buildUrl = useCallback(
    (updates: {
      year?: string | null;
      search?: string | null;
      page?: null;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      // Always reset page when changing filters
      params.delete('page');

      // Handle year
      if (updates.year === null) {
        params.delete('year');
      } else if (updates.year !== undefined) {
        params.set('year', updates.year);
      }

      // Handle search
      if (updates.search === null) {
        params.delete('search');
      } else if (updates.search !== undefined) {
        if (updates.search.trim()) {
          params.set('search', updates.search.trim());
        } else {
          params.delete('search');
        }
      }

      const queryString = params.toString();
      return queryString ? `${basePath}?${queryString}` : basePath;
    },
    [basePath, searchParams],
  );

  const handleYearClick = (year: string) => {
    const newUrl =
      currentYear === year ? buildUrl({ year: null }) : buildUrl({ year });

    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const applySearch = () => {
    const newUrl = buildUrl({ search: localSearch });

    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });
  };

  const clearAllFilters = () => {
    setLocalSearch('');
    startTransition(() => {
      router.push(basePath, { scroll: false });
    });
  };

  const hasActiveFilters = currentYear || localSearch;

  return (
    <aside className={styles.sidebar}>
      <Searchbar
        mode="manual"
        value={localSearch}
        onChange={(value) => setLocalSearch(value)}
        onSubmit={applySearch}
        placeholder="Szukaj"
      />

      {/* Categories section */}
      <nav className={styles.categories}>
        <Pill
          label="Wszystkie publikacje"
          count={totalCount}
          isActive={isAllPostsActive && !currentYear}
          href="/blog/"
        />
        {categories.map((category) => {
          const categorySlug = category.slug
            ?.replace('/blog/kategoria/', '')
            .replace('/', '');

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

      {/* Year filter section */}
      {availableYears.length > 0 && (
        <div className={styles.yearFilter}>
          <h2 className={styles.sectionTitle}>Filtruj według roku</h2>
          <div className={styles.yearPills}>
            {availableYears.map((year) => (
              <button
                key={year}
                type="button"
                className={`${styles.yearPill} ${currentYear === year ? styles.yearPillActive : ''}`}
                onClick={() => handleYearClick(year)}
                aria-pressed={currentYear === year}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}
      {hasActiveFilters && (
        <Button
          text="Wyczyść filtry"
          variant="primary"
          onClick={clearAllFilters}
          className={styles.clearFilters}
          iconUsed="clearFilters"
        />
      )}
    </aside>
  );
}
