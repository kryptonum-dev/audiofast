'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { BrandType, ProductCategoryType } from '@/src/global/types';

import Button from '../../ui/Button';
import Searchbar from '../../ui/Searchbar';
import PriceRange from '../PriceRange';
import styles from './styles.module.scss';

type ProductsAsideProps = {
  categories: ProductCategoryType[];
  brands: BrandType[];
  totalCount: number;
  maxPrice: number;
  basePath?: string;
  currentCategory?: string | null;
  initialSearch?: string;
  initialBrands?: string[];
  initialMinPrice?: number;
  initialMaxPrice?: number;
};

export default function ProductsAside({
  categories,
  brands,
  totalCount,
  maxPrice,
  basePath = '/produkty/',
  currentCategory = null,
  initialSearch = '',
  initialBrands = [],
  initialMinPrice = 0,
  initialMaxPrice,
}: ProductsAsideProps) {
  // Use actual max price from products if initialMaxPrice is not provided
  const effectiveMaxPrice = initialMaxPrice ?? maxPrice;
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Local state for filters (not applied until "Filtruj" is clicked)
  const [searchValue, setSearchValue] = useState(initialSearch);
  // initialBrands now comes as clean slugs from parseBrands (e.g., "aurender", "dcs")
  const [selectedBrands, setSelectedBrands] = useState<string[]>(initialBrands);
  const [minPriceState, setMinPrice] = useState<number>(initialMinPrice);
  const [maxPriceState, setMaxPrice] = useState<number>(effectiveMaxPrice);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    new Set()
  );
  const [showAllBrands, setShowAllBrands] = useState(false);

  // Extract brand slug from full path like "/marki/aurender/" -> "aurender"
  const getBrandSlug = (brand: BrandType): string => {
    if (!brand.slug) return brand._id;
    return brand.slug.replace('/marki/', '').replace(/\//g, '') || brand._id;
  };

  // Sort brands: active brands from URL params first, then the rest
  const sortedBrands = [...brands].sort((a, b) => {
    const aSlug = getBrandSlug(a);
    const bSlug = getBrandSlug(b);
    const aActive = initialBrands.includes(aSlug);
    const bActive = initialBrands.includes(bSlug);

    // If one is active (in URL) and the other isn't, active comes first
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // If both active or both not active, maintain original order
    return 0;
  });

  // Calculate initial limit: at least 8, but show all active brands if more than 8 are active
  const BRANDS_INITIAL_LIMIT = 8;
  const activeBrandsCount = initialBrands.length;
  const initialLimit = Math.max(BRANDS_INITIAL_LIMIT, activeBrandsCount);

  const visibleBrands = showAllBrands
    ? sortedBrands
    : sortedBrands.slice(0, initialLimit);

  // Group categories by parent
  const groupedCategories = categories.reduce(
    (acc, category) => {
      const parentName = category.parentCategory?.name || 'Pozostałe kategorie';
      const parentSlug = category.parentCategory?.slug || 'inne';

      if (!acc[parentName]) {
        acc[parentName] = {
          slug: parentSlug,
          categories: [],
        };
      }
      acc[parentName].categories.push(category);
      return acc;
    },
    {} as Record<string, { slug: string; categories: ProductCategoryType[] }>
  );

  const toggleParent = (parentName: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentName)) {
        next.delete(parentName);
      } else {
        next.add(parentName);
      }
      return next;
    });
  };

  const toggleBrand = (brandSlug: string) => {
    setSelectedBrands((prev) => {
      if (prev.includes(brandSlug)) {
        return prev.filter((slug) => slug !== brandSlug);
      }
      return [...prev, brandSlug];
    });
  };

  const applyFilters = () => {
    const params = new URLSearchParams();

    // Add search term
    if (searchValue.trim()) {
      params.set('search', searchValue.trim());
    }

    // Add selected brands
    if (selectedBrands.length > 0) {
      params.set('brands', selectedBrands.join(','));
    }

    // Add price range
    if (minPriceState > 0) {
      params.set('minPrice', minPriceState.toString());
    }
    if (maxPriceState < maxPrice) {
      params.set('maxPrice', maxPriceState.toString());
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    startTransition(() => {
      router.push(newUrl);
    });
  };

  const clearFilters = () => {
    setSearchValue('');
    setSelectedBrands([]);
    setMinPrice(0);
    setMaxPrice(maxPrice);
    startTransition(() => {
      router.push(basePath);
    });
  };

  // Check if filters are applied in URL params (not just local state)
  const hasAppliedFilters =
    initialSearch.trim() !== '' ||
    initialBrands.length > 0 ||
    initialMinPrice > 0 ||
    (initialMaxPrice !== undefined && initialMaxPrice < maxPrice);

  // Check if we're on the main products page (no category selected)
  const isAllProductsActive = !currentCategory || currentCategory === '';

  return (
    <aside className={styles.sidebar}>
      {/* Search Input */}
      <Searchbar
        mode="manual"
        value={searchValue}
        onChange={setSearchValue}
        onSubmit={applyFilters}
        placeholder="Szukaj"
      />

      {/* Categories */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Typ produktu</h3>
        <nav className={styles.categories}>
          {/* All Products Link */}
          <Link
            href="/produkty/"
            className={`${styles.categoryItem} ${isAllProductsActive ? styles.active : ''}`}
            tabIndex={isAllProductsActive ? -1 : 0}
          >
            <span className={styles.categoryName}>Wszystkie produkty</span>
            <span className={styles.categoryCount}>({totalCount})</span>
          </Link>

          {/* Parent Categories with Sub Categories */}
          {Object.entries(groupedCategories).map(
            ([parentName, { categories: subCategories }]) => {
              const isExpanded = expandedParents.has(parentName);
              const hasActiveChild = subCategories.some(
                (cat) => cat.slug === currentCategory
              );

              return (
                <div key={parentName} className={styles.parentGroup}>
                  <button
                    type="button"
                    className={`${styles.parentItem} ${hasActiveChild ? styles.hasActive : ''}`}
                    onClick={() => toggleParent(parentName)}
                  >
                    <span className={styles.categoryName}>{parentName}</span>
                    <ChevronIcon direction={isExpanded ? 'up' : 'down'} />
                  </button>

                  {isExpanded && (
                    <div className={styles.subCategories}>
                      {subCategories.map((category) => {
                        const categorySlug = category.slug || '';
                        const isActive = currentCategory === categorySlug;

                        return (
                          <Link
                            key={category._id}
                            href={`/produkty${categorySlug}`}
                            className={`${styles.subCategoryItem} ${isActive ? styles.active : ''}`}
                            tabIndex={isActive ? -1 : 0}
                          >
                            <span className={styles.categoryName}>
                              {category.name}
                            </span>
                            <span className={styles.categoryCount}>
                              ({category.count})
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </nav>
      </div>

      {/* Brands */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Marki</h3>
        <div className={styles.checkboxGroup}>
          {visibleBrands.map((brand) => {
            const brandSlug = getBrandSlug(brand);
            return (
              <label key={brand._id} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selectedBrands.includes(brandSlug)}
                  onChange={() => toggleBrand(brandSlug)}
                />
                <span className={styles.checkboxText}>{brand.name}</span>
              </label>
            );
          })}
        </div>
        {brands.length > initialLimit && (
          <button
            type="button"
            className={styles.loadAllButton}
            onClick={() => setShowAllBrands(!showAllBrands)}
          >
            {showAllBrands ? (
              <>
                <ChevronIcon direction="up" />
                Zwiń
              </>
            ) : (
              <>
                <ChevronIcon direction="down" />
                Wczytaj wszystkie
                <span className={styles.count}>
                  ({initialLimit}/{brands.length})
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Price Range */}
      <PriceRange
        minValue={minPriceState}
        maxValue={maxPriceState}
        onMinChange={setMinPrice}
        onMaxChange={setMaxPrice}
        maxLimit={maxPrice}
      />

      {/* Filter Button */}
      <div className={styles.filterActions}>
        <Button
          text="Filtruj"
          variant="primary"
          onClick={applyFilters}
          className={styles.filterButton}
          iconUsed="applyFilters"
        />
        {hasAppliedFilters && (
          <Button
            text="Wyczyść filtry"
            variant="secondary"
            onClick={clearFilters}
            className={styles.clearButton}
            iconUsed="clearFilters"
          />
        )}
      </div>
    </aside>
  );
}

const ChevronIcon = ({ direction }: { direction: 'up' | 'down' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    style={{
      transform: direction === 'up' ? 'rotate(180deg)' : 'none',
    }}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M6 9l6 6 6-6"
    />
  </svg>
);
