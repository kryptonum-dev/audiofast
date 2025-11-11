'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import type { BrandType, ProductCategoryType } from '@/src/global/types';
import { centsToPLN, plnToCents } from '@/src/global/utils';

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
  hideBrandFilter?: boolean; // Hide brand filter when on brand page
  useCategorySearchParam?: boolean; // Use ?category=X instead of /kategoria/X path
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
  hideBrandFilter = false,
  useCategorySearchParam = false,
}: ProductsAsideProps) {
  // Use actual max price from products if initialMaxPrice is not provided
  const effectiveMaxPrice = initialMaxPrice ?? maxPrice;
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Consolidated local state for all filters (not applied until "Filtruj" is clicked)
  // Single state object = single state update = fewer re-renders
  // Prices are stored in PLN for display, converted to cents when applying to URL
  const [filters, setFilters] = useState({
    search: initialSearch,
    brands: initialBrands, // Clean slugs from parseBrands (e.g., "aurender", "dcs")
    minPrice: centsToPLN(initialMinPrice),
    maxPrice: centsToPLN(effectiveMaxPrice),
  });

  // Group categories by parent to determine initial expanded state
  const groupedCategories = useMemo(() => {
    return categories.reduce(
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
      {} as Record<string, { slug: string; categories: ProductCategoryType[] }>
    );
  }, [categories]);

  // Auto-expand parent categories that contain the active subcategory
  const getInitialExpandedParents = useCallback((): Set<string> => {
    const expanded = new Set<string>();

    if (currentCategory) {
      // Find parent that contains the active category
      Object.entries(groupedCategories).forEach(
        ([parentName, { categories: subCategories }]) => {
          const hasActiveChild = subCategories.some((cat) => {
            const cleanSlug =
              cat.slug?.replace('/kategoria/', '').replace(/\//g, '') || '';
            return cleanSlug === currentCategory;
          });

          if (hasActiveChild) {
            expanded.add(parentName);
          }
        }
      );
    }

    return expanded;
  }, [currentCategory, groupedCategories]);

  const [expandedParents, setExpandedParents] = useState<Set<string>>(() =>
    getInitialExpandedParents()
  );
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Sync local state with props when they change (e.g., when filters are cleared via URL)
  // Single useEffect = single state update = single re-render (instead of 4)
  useEffect(() => {
    setFilters({
      search: initialSearch,
      brands: initialBrands,
      minPrice: centsToPLN(initialMinPrice),
      maxPrice: centsToPLN(initialMaxPrice ?? maxPrice),
    });
  }, [
    initialSearch,
    initialBrands,
    initialMinPrice,
    initialMaxPrice,
    maxPrice,
  ]);

  // Update expanded parents when currentCategory changes
  useEffect(() => {
    setExpandedParents(getInitialExpandedParents());
  }, [currentCategory, getInitialExpandedParents]);

  // ESC key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Extract brand slug from full path like "/marki/aurender/" -> "aurender"
  const getBrandSlug = useCallback((brand: BrandType): string => {
    if (!brand.slug) return brand._id;
    return brand.slug.replace('/marki/', '').replace(/\//g, '') || brand._id;
  }, []);

  // Build search params string to preserve filters when switching categories
  // Keeps: search, brands, minPrice, maxPrice
  // Excludes: custom category-specific filters (handled by URL structure)
  // If useCategorySearchParam is true, also includes category in the params
  const buildSearchParamsString = useCallback(
    (categorySlug?: string) => {
      const params = new URLSearchParams();

      // Add category if using search param mode
      if (useCategorySearchParam && categorySlug) {
        params.set('category', categorySlug);
      }

      // Add search term if present
      if (initialSearch.trim()) {
        params.set('search', initialSearch.trim());
      }

      // Add selected brands
      if (initialBrands.length > 0) {
        params.set('brands', initialBrands.join(','));
      }

      // Add price range if not default
      if (initialMinPrice > 0) {
        params.set('minPrice', initialMinPrice.toString());
      }
      if (initialMaxPrice !== undefined && initialMaxPrice < maxPrice) {
        params.set('maxPrice', initialMaxPrice.toString());
      }

      const queryString = params.toString();
      return queryString ? `?${queryString}` : '';
    },
    [
      useCategorySearchParam,
      initialSearch,
      initialBrands,
      initialMinPrice,
      initialMaxPrice,
      maxPrice,
    ]
  );

  // Helper to build category URL
  // If useCategorySearchParam is true: basePath?category=slug
  // If useCategorySearchParam is false: basePath/kategoria/slug
  const buildCategoryUrl = useCallback(
    (categorySlug: string | null) => {
      if (!categorySlug) {
        // "All Products" link - strip any /kategoria/* from basePath
        const cleanBasePath = basePath.replace(/\/kategoria\/[^/]+\/?/, '');
        return `${cleanBasePath}${buildSearchParamsString()}`;
      }

      // Clean slug (remove /kategoria/ prefix if present)
      const cleanSlug = categorySlug
        .replace('/kategoria/', '')
        .replace(/\//g, '');

      if (useCategorySearchParam) {
        // Brand page mode: use search param
        return `${basePath}${buildSearchParamsString(cleanSlug)}`;
      } else {
        // Products page mode: use path
        // Strip any existing /kategoria/* from basePath before appending new category
        const cleanBasePath = basePath.replace(/\/kategoria\/[^/]+\/?/, '');
        return `${cleanBasePath}/kategoria/${cleanSlug}/${buildSearchParamsString()}`;
      }
    },
    [basePath, buildSearchParamsString, useCategorySearchParam]
  );

  // Merge brands from query with active brands from URL
  // This ensures brands with 0 count still appear if they're checked
  const allBrands = useMemo(() => {
    const brandMap = new Map<string, BrandType>();

    // Add all brands from query (with their actual counts)
    brands.forEach((brand) => {
      const slug = getBrandSlug(brand);
      brandMap.set(slug, brand);
    });

    // Add active brands that aren't in query results (they have 0 count in current context)
    initialBrands.forEach((activeSlug) => {
      if (!brandMap.has(activeSlug)) {
        // Brand is active but has 0 products with current filters
        // Create a placeholder brand entry
        brandMap.set(activeSlug, {
          _id: activeSlug,
          name: activeSlug.charAt(0).toUpperCase() + activeSlug.slice(1), // Capitalize slug as name
          slug: `/marki/${activeSlug}/`,
          logo: {
            id: null,
            preview: null,
            alt: null,
            naturalWidth: null,
            naturalHeight: null,
            hotspot: null,
            crop: null,
          }, // Placeholder brand without logo
          count: 0,
        });
      }
    });

    return Array.from(brandMap.values());
  }, [brands, initialBrands, getBrandSlug]);

  // Sort brands: selected brands first, then by count (descending)
  const sortedBrands = useMemo(() => {
    return [...allBrands].sort((a, b) => {
      const aSlug = getBrandSlug(a);
      const bSlug = getBrandSlug(b);
      const aActive = initialBrands.includes(aSlug);
      const bActive = initialBrands.includes(bSlug);

      // If one is active (in URL) and the other isn't, active comes first
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      // If both have same active state, sort by count (descending)
      const aCount = a.count ?? 0;
      const bCount = b.count ?? 0;
      return bCount - aCount;
    });
  }, [allBrands, initialBrands, getBrandSlug]);

  // Calculate initial limit: at least 8, but show all active brands if more than 8 are active
  const BRANDS_INITIAL_LIMIT = 8;
  const activeBrandsCount = initialBrands.length;
  const initialLimit = Math.max(BRANDS_INITIAL_LIMIT, activeBrandsCount);

  const visibleBrands = useMemo(
    () => (showAllBrands ? sortedBrands : sortedBrands.slice(0, initialLimit)),
    [showAllBrands, sortedBrands, initialLimit]
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
    setFilters((prev) => ({
      ...prev,
      brands: prev.brands.includes(brandSlug)
        ? prev.brands.filter((slug) => slug !== brandSlug)
        : [...prev.brands, brandSlug],
    }));
  };

  const applyFilters = () => {
    // Start with current URL params to preserve custom filters
    const params = new URLSearchParams(window.location.search);

    // Remove page param to reset pagination
    params.delete('page');

    // Keep category param if using search param mode
    // (It's already in params from current URL)

    // Update sidebar-managed filters
    // Search
    if (filters.search.trim()) {
      params.set('search', filters.search.trim());
    } else {
      params.delete('search');
    }

    // Brands
    if (filters.brands.length > 0) {
      params.set('brands', filters.brands.join(','));
    } else {
      params.delete('brands');
    }

    // Price range (convert PLN back to cents for URL)
    const minPriceCents = plnToCents(filters.minPrice);
    const maxPriceCents = plnToCents(filters.maxPrice);

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

    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });

    // Close mobile menu after applying filters
    setIsOpen(false);
  };

  const clearFilters = () => {
    // Start with current URL params to preserve custom filters
    const params = new URLSearchParams(window.location.search);

    // Remove only sidebar-managed filters
    params.delete('search');
    params.delete('brands');
    params.delete('minPrice');
    params.delete('maxPrice');
    params.delete('page');

    // If using category search param mode (brand pages), also clear category
    // This won't affect the category subpage because there category is in the path, not search params
    if (useCategorySearchParam) {
      params.delete('category');
    }

    // Custom filters (category-specific) are preserved automatically
    // because we only delete the sidebar params and 'category' search param

    // Reset local state for sidebar filters (convert cents to PLN)
    setFilters({
      search: '',
      brands: [],
      minPrice: 0,
      maxPrice: centsToPLN(maxPrice),
    });

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

    startTransition(() => {
      router.push(newUrl, { scroll: false });
    });

    // Close mobile menu after clearing filters
    setIsOpen(false);
  };

  // Check if filters are applied in URL params (not just local state)
  const hasAppliedFilters =
    initialSearch.trim() !== '' ||
    initialBrands.length > 0 ||
    initialMinPrice > 0 ||
    (initialMaxPrice !== undefined && initialMaxPrice < maxPrice) ||
    (useCategorySearchParam &&
      currentCategory !== null &&
      currentCategory !== '');

  // Check if we're on the main products page (no category selected)
  const isAllProductsActive = !currentCategory || currentCategory === '';

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

        {/* Search Input */}
        <Searchbar
          mode="manual"
          value={filters.search}
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, search: value }))
          }
          onSubmit={applyFilters}
          placeholder="Szukaj"
        />

        {/* Categories */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Typ produktu</h3>
          <nav className={styles.categories}>
            {/* All Products Link */}
            <Link
              href={buildCategoryUrl(null)}
              className={`${styles.categoryItem} ${isAllProductsActive ? styles.active : ''}`}
              tabIndex={isAllProductsActive ? -1 : 0}
              scroll={false}
            >
              <span className={styles.categoryName}>Wszystkie produkty</span>
              <span className={styles.categoryCount}>({totalCount})</span>
            </Link>

            {/* Parent Categories with Sub Categories */}
            {Object.entries(groupedCategories).map(
              ([parentName, { categories: subCategories }]) => {
                const isExpanded = expandedParents.has(parentName);

                // Extract clean slug from category path for comparison
                // e.g., "/kategoria/glosniki-podlogowe/" -> "glosniki-podlogowe"
                const hasActiveChild = subCategories.some((cat) => {
                  const cleanSlug =
                    cat.slug?.replace('/kategoria/', '').replace(/\//g, '') ||
                    '';
                  return cleanSlug === currentCategory;
                });

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
                      <div
                        className={styles.subCategories}
                        data-has-active={hasActiveChild}
                      >
                        {subCategories.map((category) => {
                          const categorySlug = category.slug || '';
                          // Extract clean slug for comparison
                          const cleanSlug = categorySlug
                            .replace('/kategoria/', '')
                            .replace(/\//g, '');
                          const isActive = currentCategory === cleanSlug;

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
              }
            )}
          </nav>
        </div>

        {/* Brands */}
        {!hideBrandFilter && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Marki</h3>
            <div className={styles.checkboxGroup}>
              {visibleBrands.map((brand) => {
                const brandSlug = getBrandSlug(brand);
                const hasNoResults = (brand.count ?? 0) === 0;
                return (
                  <label
                    key={brand._id}
                    className={styles.checkboxLabel}
                    data-no-results={hasNoResults}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={filters.brands.includes(brandSlug)}
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
            {allBrands.length > initialLimit && (
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
                      ({initialLimit}/{allBrands.length})
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Price Range */}
        <PriceRange
          minValue={filters.minPrice}
          maxValue={filters.maxPrice}
          onMinChange={(value) =>
            setFilters((prev) => ({ ...prev, minPrice: value }))
          }
          onMaxChange={(value) =>
            setFilters((prev) => ({ ...prev, maxPrice: value }))
          }
          maxLimit={centsToPLN(maxPrice)}
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
    </>
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
