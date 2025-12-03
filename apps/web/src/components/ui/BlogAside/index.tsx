"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import Pill from "../Pill";
import Searchbar from "../Searchbar";
import styles from "./styles.module.scss";

export type ArticleByYearItem = {
  _id: string;
  name: string;
  slug: string;
  _createdAt: string;
  year: string;
};

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
  articlesByYear?: ArticleByYearItem[];
};

export default function BlogAside({
  categories,
  totalCount,
  basePath = "/blog/",
  currentCategory = null,
  initialSearch = "",
  articlesByYear = [],
}: BlogAsideProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());

  // Check if we're on the main blog page (no category selected)
  const isAllPostsActive = !currentCategory || currentCategory === "";

  // Group articles by year
  const groupedArticles = articlesByYear.reduce(
    (acc, article) => {
      const year = article.year;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(article);
      return acc;
    },
    {} as Record<string, ArticleByYearItem[]>,
  );

  // Sort years in descending order
  const sortedYears = Object.keys(groupedArticles).sort(
    (a, b) => parseInt(b) - parseInt(a),
  );

  const toggleYear = (year: string) => {
    const newExpandedYears = new Set(expandedYears);
    if (newExpandedYears.has(year)) {
      newExpandedYears.delete(year);
    } else {
      newExpandedYears.add(year);
    }
    setExpandedYears(newExpandedYears);
  };

  const applySearch = () => {
    const params = new URLSearchParams();

    // Remove page param to reset pagination
    // Add search term if present
    if (localSearch.trim()) {
      params.set("search", localSearch.trim());
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
            ?.replace("/blog/kategoria/", "")
            .replace("/", "");

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

      {sortedYears.length > 0 && (
        <div className={styles.yearNavigation}>
          <h2 className={styles.yearNavigationTitle}>Przeglądaj według lat</h2>
          <div className={styles.yearsList}>
            {sortedYears.map((year) => (
              <div key={year} className={styles.yearItem}>
                <button
                  className={styles.yearButton}
                  onClick={() => toggleYear(year)}
                  aria-expanded={expandedYears.has(year)}
                  type="button"
                >
                  <span className={styles.yearLabel}>{year}</span>
                  <span className={styles.yearCount}>
                    ({groupedArticles[year]?.length || 0})
                  </span>
                  <svg
                    className={`${styles.yearIcon} ${expandedYears.has(year) ? styles.yearIconExpanded : ""}`}
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {expandedYears.has(year) && groupedArticles[year] && (
                  <ul className={styles.articlesList}>
                    {groupedArticles[year]!.map((article) => (
                      <li key={article._id} className={styles.articleItem}>
                        <a href={article.slug} className={styles.articleLink}>
                          {article.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
