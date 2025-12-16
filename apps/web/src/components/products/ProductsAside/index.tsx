'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type ActiveFilters,
  type BrandMetadata,
  type CategoryMetadata,
  computeAvailableFilters,
  type ProductFilterMetadata,
} from '@/src/global/filters';
import type { PortableTextProps } from '@/src/global/types';
import {
  centsToPLN,
  parseBrands,
  parsePrice,
  plnToCents,
} from '@/src/global/utils';

import PortableText from '../../portableText';
import Button from '../../ui/Button';
import Searchbar from '../../ui/Searchbar';
import PriceRange from '../PriceRange';
import ProductsAsideSkeleton from './ProductsAsideSkeleton';
import styles from './styles.module.scss';

type VisibleFilters = {
  search?: boolean;
  categories?: boolean;
  brands?: boolean;
  priceRange?: boolean;
};

type ProductsAsideProps = {
  // Static metadata (passed from cached server fetch)
  allProductsMetadata: ProductFilterMetadata[];
  allCategories: CategoryMetadata[];
  allBrands: BrandMetadata[];
  globalMaxPrice: number;

  // Page configuration
  basePath?: string;
  currentCategory?: string | null;
  heading?: PortableTextProps;
  visibleFilters?: VisibleFilters;
  hideBrandFilter?: boolean;
  headingLevel?: 'h2' | 'h3';
};

export default function ProductsAside({
  allProductsMetadata,
  allCategories,
  allBrands,
  globalMaxPrice,
  basePath = '/produkty/',
  currentCategory = null,
  heading,
  visibleFilters = {
    search: true,
    categories: true,
    brands: true,
    priceRange: true,
  },
  hideBrandFilter = false,
  headingLevel = 'h2',
}: ProductsAsideProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get category from URL params (for brand pages that use ?category=xxx)
  const categoryFromUrlParam = searchParams.get('category');

  // Normalize category slug for UI comparisons
  // Can be: prop (full path or clean slug) OR URL param (clean slug)
  const currentCategoryClean = currentCategory
    ? currentCategory.replace('/kategoria/', '').replace(/\//g, '')
    : categoryFromUrlParam
      ? categoryFromUrlParam.replace('/kategoria/', '').replace(/\//g, '')
      : null;

  // ----------------------------------------
  // Initialization State
  // ----------------------------------------
  // Show skeleton until client has hydrated and can read URL params
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // ----------------------------------------
  // Parse Active Filters from URL
  // ----------------------------------------
  const activeFilters = useMemo((): ActiveFilters => {
    const brandsParam = searchParams.get('brands');

    // Category can come from prop OR from URL search param (for brand pages)
    // Normalize to full path format for filter computation
    const categoryFromUrl = searchParams.get('category');
    const effectiveCategory =
      currentCategory ||
      (categoryFromUrl
        ? categoryFromUrl.startsWith('/kategoria/')
          ? categoryFromUrl
          : `/kategoria/${categoryFromUrl}/`
        : null);

    return {
      search: searchParams.get('search') || '',
      brands: brandsParam ? parseBrands(brandsParam) : [],
      minPrice: parsePrice(searchParams.get('minPrice') ?? undefined, 0),
      maxPrice: parsePrice(
        searchParams.get('maxPrice') ?? undefined,
        Infinity,
        Infinity,
      ),
      category: effectiveCategory,
      customFilters: [],
      isCPO: false,
    };
  }, [searchParams, currentCategory]);

  // ----------------------------------------
  // Compute Filter Counts (instant, ~1-2ms)
  // ----------------------------------------
  const computed = useMemo(() => {
    return computeAvailableFilters(allProductsMetadata, activeFilters);
  }, [allProductsMetadata, activeFilters]);

  // Merge computed counts with category metadata
  const categoriesWithCounts = useMemo(() => {
    return allCategories.map((cat) => ({
      ...cat,
      count: computed.categoryCounts.get(cat.slug || '') || 0,
    }));
  }, [allCategories, computed.categoryCounts]);

  // Merge computed counts with brand metadata
  const brandsWithCounts = useMemo(() => {
    return allBrands.map((brand) => {
      const brandSlug = brand.slug
        ? brand.slug.replace('/marki/', '').replace(/\/$/, '')
        : '';
      return {
        ...brand,
        count: computed.brandCounts.get(brandSlug) || 0,
      };
    });
  }, [allBrands, computed.brandCounts]);

  // Effective max price
  const maxPrice =
    computed.priceRange.max > 0 ? computed.priceRange.max : globalMaxPrice;
  // "All products" count - filtered by brand/price but NOT by category
  const allProductsCount = computed.allProductsCount;

  // ----------------------------------------
  // UI Configuration
  // ----------------------------------------
  const SectionHeading = headingLevel;
  const filters = {
    search: visibleFilters.search ?? true,
    categories: visibleFilters.categories ?? true,
    brands: hideBrandFilter ? false : (visibleFilters.brands ?? true),
    priceRange: visibleFilters.priceRange ?? true,
  };
  const needsFilterButtons =
    filters.search || filters.brands || filters.priceRange;

  // ----------------------------------------
  // Local Filter State (for "Apply" button workflow)
  // ----------------------------------------
  const [localFilters, setLocalFilters] = useState({
    search: activeFilters.search,
    brands: activeFilters.brands,
    minPrice: centsToPLN(activeFilters.minPrice),
    maxPrice: centsToPLN(
      activeFilters.maxPrice < Infinity ? activeFilters.maxPrice : maxPrice,
    ),
  });

  // Sync local state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    setLocalFilters({
      search: activeFilters.search,
      brands: activeFilters.brands,
      minPrice: centsToPLN(activeFilters.minPrice),
      maxPrice: centsToPLN(
        activeFilters.maxPrice < Infinity ? activeFilters.maxPrice : maxPrice,
      ),
    });
  }, [activeFilters, maxPrice]);

  // ----------------------------------------
  // Category Grouping & Expansion
  // ----------------------------------------
  const groupedCategories = useMemo(() => {
    // First, filter out categories with count of 0
    // (users shouldn't navigate to empty listings)
    const categoriesWithProducts = categoriesWithCounts.filter(
      (cat) => cat.count > 0,
    );

    // Group by parent category
    const grouped = categoriesWithProducts.reduce(
      (acc, category) => {
        const parentName =
          category.parentCategory?.name || 'Pozostałe kategorie';
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
      {} as Record<
        string,
        {
          slug: string;
          categories: Array<(typeof categoriesWithCounts)[number]>;
        }
      >,
    );

    return grouped;
  }, [categoriesWithCounts]);

  const getInitialExpandedParents = useCallback((): Set<string> => {
    const expanded = new Set<string>();
    if (currentCategoryClean) {
      Object.entries(groupedCategories).forEach(
        ([parentName, { categories: subCategories }]) => {
          const hasActiveChild = subCategories.some((cat) => {
            const cleanSlug =
              cat.slug?.replace('/kategoria/', '').replace(/\//g, '') || '';
            return cleanSlug === currentCategoryClean;
          });
          if (hasActiveChild) {
            expanded.add(parentName);
          }
        },
      );
    }
    return expanded;
  }, [currentCategoryClean, groupedCategories]);

  const [expandedParents, setExpandedParents] = useState<Set<string>>(() =>
    getInitialExpandedParents(),
  );

  useEffect(() => {
    setExpandedParents(getInitialExpandedParents());
  }, [currentCategoryClean, getInitialExpandedParents]);

  // ----------------------------------------
  // Brand Display Logic
  // ----------------------------------------
  const [showAllBrands, setShowAllBrands] = useState(false);

  const getBrandSlug = useCallback((brand: BrandMetadata): string => {
    if (!brand.slug) return brand._id;
    return brand.slug.replace('/marki/', '').replace(/\//g, '') || brand._id;
  }, []);

  // Merge with active brands that might have 0 count
  const allBrandsWithActive = useMemo(() => {
    const brandMap = new Map<string, (typeof brandsWithCounts)[number]>();

    brandsWithCounts.forEach((brand) => {
      const slug = getBrandSlug(brand);
      brandMap.set(slug, brand);
    });

    // Add active brands that aren't in results (0 count)
    activeFilters.brands.forEach((activeSlug) => {
      if (!brandMap.has(activeSlug)) {
        brandMap.set(activeSlug, {
          _id: activeSlug,
          name: activeSlug.charAt(0).toUpperCase() + activeSlug.slice(1),
          slug: `/marki/${activeSlug}/`,
          logo: null,
          count: 0,
        });
      }
    });

    return Array.from(brandMap.values());
  }, [brandsWithCounts, activeFilters.brands, getBrandSlug]);

  // Sort: selected first, then by count
  const sortedBrands = useMemo(() => {
    return [...allBrandsWithActive].sort((a, b) => {
      const aSlug = getBrandSlug(a);
      const bSlug = getBrandSlug(b);
      const aActive = activeFilters.brands.includes(aSlug);
      const bActive = activeFilters.brands.includes(bSlug);

      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      return (b.count ?? 0) - (a.count ?? 0);
    });
  }, [allBrandsWithActive, activeFilters.brands, getBrandSlug]);

  const BRANDS_INITIAL_LIMIT = 8;
  const initialLimit = Math.max(
    BRANDS_INITIAL_LIMIT,
    activeFilters.brands.length,
  );
  const visibleBrands = useMemo(
    () => (showAllBrands ? sortedBrands : sortedBrands.slice(0, initialLimit)),
    [showAllBrands, sortedBrands, initialLimit],
  );

  // ----------------------------------------
  // Mobile Menu State
  // ----------------------------------------
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // ----------------------------------------
  // URL Building Helpers
  // ----------------------------------------
  const buildSearchParamsString = useCallback(() => {
    const params = new URLSearchParams();

    if (activeFilters.search.trim()) {
      params.set('search', activeFilters.search.trim());
    }
    if (activeFilters.brands.length > 0) {
      params.set('brands', activeFilters.brands.join(','));
    }
    if (activeFilters.minPrice > 0) {
      params.set('minPrice', activeFilters.minPrice.toString());
    }
    if (
      activeFilters.maxPrice < Infinity &&
      activeFilters.maxPrice < maxPrice
    ) {
      params.set('maxPrice', activeFilters.maxPrice.toString());
    }

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }, [activeFilters, maxPrice]);

  const buildCategoryUrl = useCallback(
    (categorySlug: string | null) => {
      // Brand pages use ?category=xxx format, category pages use /kategoria/xxx/ path
      const isBrandPage = basePath.startsWith('/marki/');

      if (!categorySlug) {
        // "All Products" - remove category
        if (isBrandPage) {
          // For brand pages, just use basePath without category param
          return `${basePath}${buildSearchParamsString()}`;
        }
        const cleanBasePath = basePath.replace(/\/kategoria\/[^/]+\/?/, '');
        return `${cleanBasePath}${buildSearchParamsString()}`;
      }

      const cleanSlug = categorySlug
        .replace('/kategoria/', '')
        .replace(/\//g, '');

      if (isBrandPage) {
        // For brand pages, use ?category=xxx format
        const existingParams = buildSearchParamsString();
        if (existingParams) {
          // existingParams starts with '?', so we append with '&'
          return `${basePath}${existingParams}&category=${cleanSlug}`;
        }
        return `${basePath}?category=${cleanSlug}`;
      }

      // For category pages, use /kategoria/xxx/ path format
      const cleanBasePath = basePath.replace(/\/kategoria\/[^/]+\/?/, '');
      return `${cleanBasePath}/kategoria/${cleanSlug}/${buildSearchParamsString()}`;
    },
    [basePath, buildSearchParamsString],
  );

  // ----------------------------------------
  // Filter Actions
  // ----------------------------------------
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
    setLocalFilters((prev) => ({
      ...prev,
      brands: prev.brands.includes(brandSlug)
        ? prev.brands.filter((slug) => slug !== brandSlug)
        : [...prev.brands, brandSlug],
    }));
  };

  const applyFilters = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('page');

    if (localFilters.search.trim()) {
      params.set('search', localFilters.search.trim());
    } else {
      params.delete('search');
    }

    if (localFilters.brands.length > 0) {
      params.set('brands', localFilters.brands.join(','));
    } else {
      params.delete('brands');
    }

    const minPriceCents = plnToCents(localFilters.minPrice);
    const maxPriceCents = plnToCents(localFilters.maxPrice);

    if (minPriceCents > 0) {
      params.set('minPrice', minPriceCents.toString());
    } else {
      params.delete('minPrice');
    }

    if (maxPriceCents < maxPrice) {
      params.set('maxPrice', maxPriceCents.toString());
    } else {
      params.delete('maxPrice');
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    router.push(newUrl, { scroll: false });
    setIsOpen(false);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('search');
    params.delete('brands');
    params.delete('minPrice');
    params.delete('maxPrice');
    params.delete('page');

    setLocalFilters({
      search: '',
      brands: [],
      minPrice: 0,
      maxPrice: centsToPLN(maxPrice),
    });

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    router.push(newUrl, { scroll: false });
    setIsOpen(false);
  };

  // ----------------------------------------
  // Derived State
  // ----------------------------------------
  const hasAppliedFilters =
    activeFilters.search.trim() !== '' ||
    activeFilters.brands.length > 0 ||
    activeFilters.minPrice > 0 ||
    activeFilters.maxPrice < Infinity;

  const isAllProductsActive =
    !currentCategoryClean || currentCategoryClean === '';

  // ----------------------------------------
  // Render Skeleton Until Initialized
  // ----------------------------------------
  if (!isInitialized) {
    return <ProductsAsideSkeleton />;
  }

  // ----------------------------------------
  // Main Render
  // ----------------------------------------
  return (
    <>
      {/* Mobile Open Button */}
      <button
        type="button"
        className={styles.mobileOpenButton}
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-label="Otwórz filtry"
      >
        <MobileAsideIcon />
        <span>Filtry</span>
      </button>

      {/* Overlay (backdrop) */}
      <div
        className={styles.overlay}
        data-open={isOpen}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Aside */}
      <aside
        className={styles.sidebar}
        data-open={isOpen}
        role="dialog"
        aria-label="Filtry produktów"
        aria-modal={isOpen}
      >
        {/* Mobile Close Button */}
        <button
          type="button"
          className={styles.mobileCloseButton}
          onClick={() => setIsOpen(false)}
          aria-label="Zamknij filtry"
        >
          <X size={24} strokeWidth={1.5} />
        </button>

        {/* Optional Heading */}
        {heading && (
          <PortableText
            value={heading}
            headingLevel="h2"
            className={styles.heading}
          />
        )}

        {/* Search Input */}
        {filters.search && (
          <Searchbar
            mode="manual"
            value={localFilters.search}
            onChange={(value) =>
              setLocalFilters((prev) => ({ ...prev, search: value }))
            }
            onSubmit={applyFilters}
            placeholder="Szukaj"
          />
        )}

        {/* Categories */}
        {filters.categories && (
          <div className={styles.section}>
            <SectionHeading className={styles.sectionTitle}>
              Typ produktu
            </SectionHeading>
            <nav className={styles.categories}>
              {/* All Products Link */}
              <Link
                href={buildCategoryUrl(null)}
                className={`${styles.categoryItem} ${isAllProductsActive ? styles.active : ''}`}
                tabIndex={isAllProductsActive ? -1 : 0}
                scroll={false}
              >
                <span className={styles.categoryName}>Wszystkie produkty</span>
                <span className={styles.categoryCount}>
                  ({allProductsCount})
                </span>
              </Link>

              {/* Parent Categories with Sub Categories */}
              {Object.entries(groupedCategories).map(
                ([parentName, { categories: subCategories }]) => {
                  const isExpanded = expandedParents.has(parentName);
                  const hasActiveChild = subCategories.some((cat) => {
                    const cleanSlug =
                      cat.slug?.replace('/kategoria/', '').replace(/\//g, '') ||
                      '';
                    return cleanSlug === currentCategoryClean;
                  });

                  return (
                    <div key={parentName} className={styles.parentGroup}>
                      <button
                        type="button"
                        className={`${styles.parentItem} ${hasActiveChild ? styles.hasActive : ''}`}
                        onClick={() => toggleParent(parentName)}
                      >
                        <span className={styles.categoryName}>
                          {parentName}
                        </span>
                        <ChevronIcon direction={isExpanded ? 'up' : 'down'} />
                      </button>

                      {isExpanded && (
                        <div
                          className={styles.subCategories}
                          data-has-active={hasActiveChild}
                        >
                          {subCategories.map((category) => {
                            const categorySlug = category.slug || '';
                            const cleanSlug = categorySlug
                              .replace('/kategoria/', '')
                              .replace(/\//g, '');
                            const isActive = currentCategoryClean === cleanSlug;

                            return (
                              <Link
                                key={category._id}
                                href={buildCategoryUrl(categorySlug)}
                                className={`${styles.subCategoryItem} ${isActive ? styles.active : ''}`}
                                tabIndex={isActive ? -1 : 0}
                                scroll={false}
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
                },
              )}
            </nav>
          </div>
        )}

        {/* Brands */}
        {filters.brands && (
          <div className={styles.section}>
            <SectionHeading className={styles.sectionTitle}>
              Marki
            </SectionHeading>
            <div className={styles.checkboxGroup}>
              {visibleBrands.map((brand) => {
                const brandSlug = getBrandSlug(brand);
                const isChecked = localFilters.brands.includes(brandSlug);
                // Disable if no results AND not currently checked
                // (allow unchecking even if count is 0)
                const hasNoResults = (brand.count ?? 0) === 0;
                const isDisabled = hasNoResults && !isChecked;
                return (
                  <label
                    key={brand._id}
                    className={styles.checkboxLabel}
                    data-no-results={hasNoResults}
                    data-disabled={isDisabled}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => toggleBrand(brandSlug)}
                    />
                    <p className={styles.checkboxText}>
                      {brand.name}
                      {brand.count !== undefined && (
                        <span className={styles.brandCount}>
                          {' '}
                          ({brand.count})
                        </span>
                      )}
                    </p>
                  </label>
                );
              })}
            </div>
            {allBrandsWithActive.length > initialLimit && (
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
                      ({initialLimit}/{allBrandsWithActive.length})
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Price Range */}
        {filters.priceRange && (
          <PriceRange
            minValue={localFilters.minPrice}
            maxValue={localFilters.maxPrice}
            onMinChange={(value) =>
              setLocalFilters((prev) => ({ ...prev, minPrice: value }))
            }
            onMaxChange={(value) =>
              setLocalFilters((prev) => ({ ...prev, maxPrice: value }))
            }
            maxLimit={centsToPLN(maxPrice)}
          />
        )}

        {/* Filter Button */}
        {needsFilterButtons && (
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
        )}
      </aside>
    </>
  );
}

// ----------------------------------------
// Icons
// ----------------------------------------

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

const MobileAsideIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M4 8h4v4H4V8ZM6 4v4M6 12v8M10 14h4v4h-4v-4ZM12 4v10M12 18v2M16 5h4v4h-4V5ZM18 4v1M18 9v11" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
