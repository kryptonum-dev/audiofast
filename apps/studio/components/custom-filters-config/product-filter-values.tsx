"use client";

import { ChevronDownIcon, ChevronUpIcon, SearchIcon } from "@sanity/icons";
import {
  Box,
  Button,
  Card,
  Flex,
  Spinner,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SanityClient } from "sanity";

import type { FilterConfigItem } from "./types";

type ProductWithFilterValue = {
  _id: string;
  name: string;
  brandName?: string;
  imageUrl?: string;
  currentValue?: string;
  currentNumericValue?: number;
};

type ProductCounts = {
  total: number;
  withValue: number;
};

interface ProductFilterValuesProps {
  filter: FilterConfigItem;
  categoryId: string;
  client: SanityClient;
  onSaveProduct: (
    productId: string,
    filterName: string,
    value: string | undefined,
    numericValue: number | undefined,
  ) => Promise<void>;
}

const INITIAL_PRODUCTS_LIMIT = 10;

export function ProductFilterValues({
  filter,
  categoryId,
  client,
  onSaveProduct,
}: ProductFilterValuesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [products, setProducts] = useState<ProductWithFilterValue[]>([]);
  const [counts, setCounts] = useState<ProductCounts>({ total: 0, withValue: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [savingProductIds, setSavingProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllWithoutValue, setShowAllWithoutValue] = useState(false);

  // Load counts initially (even when collapsed)
  const loadCounts = useCallback(async () => {
    if (!filter.name) {
      setCounts({ total: 0, withValue: 0 });
      setIsLoadingCounts(false);
      return;
    }

    setIsLoadingCounts(true);
    try {
      const baseCategoryId = categoryId.startsWith("drafts.")
        ? categoryId.replace("drafts.", "")
        : categoryId;

      const isRangeFilter = filter.filterType === "range";

      // Lightweight query to just get counts
      const result = await client.fetch<
        Array<{
          hasValue: boolean;
        }>
      >(
        `*[_type == "product" && references($categoryId) && (isArchived != true) && !(_id in path("drafts.**"))] {
          "product": coalesce(
            *[_id == "drafts." + ^._id][0],
            @
          ) {
            customFilterValues
          }
        }.product {
          "hasValue": defined(customFilterValues) && count(customFilterValues[filterName == $filterName && (${isRangeFilter ? "defined(numericValue)" : "defined(value) && value != ''"})] ) > 0
        }`,
        { categoryId: baseCategoryId, filterName: filter.name },
      );

      const total = result.length;
      const withValue = result.filter((p) => p.hasValue).length;

      setCounts({ total, withValue });
    } catch (error) {
      console.error("Error loading counts:", error);
      setCounts({ total: 0, withValue: 0 });
    } finally {
      setIsLoadingCounts(false);
    }
  }, [filter.name, filter.filterType, categoryId, client]);

  // Load counts on mount and when filter changes
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Fetch full products when expanded - prefer drafts over published
  const loadProducts = useCallback(async () => {
    if (!isExpanded || !filter.name) return;

    setIsLoading(true);
    try {
      const baseCategoryId = categoryId.startsWith("drafts.")
        ? categoryId.replace("drafts.", "")
        : categoryId;

      const result = await client.fetch<
        Array<{
          _id: string;
          name: string;
          brandName?: string;
          imageUrl?: string;
          customFilterValues?: Array<{
            filterName: string;
            value?: string;
            numericValue?: number;
          }>;
        }>
      >(
        `*[_type == "product" && references($categoryId) && (isArchived != true) && !(_id in path("drafts.**"))] {
          "product": coalesce(
            *[_id == "drafts." + ^._id][0],
            @
          ) {
            _id,
            name,
            "brandName": brand->name,
            "imageUrl": previewImage.asset->url,
            customFilterValues
          }
        }.product | order(name asc)`,
        { categoryId: baseCategoryId },
      );

      const productsWithValues = result
        // Filter out products without names (incomplete drafts)
        .filter((product) => product.name)
        .map((product) => {
          const filterValue = product.customFilterValues?.find(
            (fv) => fv.filterName === filter.name,
          );
          const baseId = product._id.startsWith("drafts.")
            ? product._id.replace("drafts.", "")
            : product._id;
          return {
            _id: baseId,
            name: product.name,
            brandName: product.brandName,
            imageUrl: product.imageUrl,
            currentValue: filterValue?.value,
            currentNumericValue: filterValue?.numericValue,
          };
        });

      setProducts(productsWithValues);

      // Update counts from loaded data
      const isRangeFilter = filter.filterType === "range";
      const withValue = productsWithValues.filter(
        (p) =>
          (isRangeFilter && p.currentNumericValue !== undefined) ||
          (!isRangeFilter && p.currentValue),
      ).length;
      setCounts({ total: productsWithValues.length, withValue });
    } catch (error) {
      console.error("Error loading products:", error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [isExpanded, filter.name, filter.filterType, categoryId, client]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Reset show all when collapsing or changing filter
  useEffect(() => {
    if (!isExpanded) {
      setShowAllWithoutValue(false);
      setSearchQuery("");
    }
  }, [isExpanded]);

  const handleValueChange = useCallback(
    async (productId: string, newValue: string) => {
      // Optimistic update
      setProducts((prev) =>
        prev.map((p) =>
          p._id === productId
            ? {
                ...p,
                currentValue: newValue || undefined,
                currentNumericValue: undefined,
              }
            : p,
        ),
      );

      // Update counts optimistically
      setCounts((prev) => {
        const product = products.find((p) => p._id === productId);
        const hadValue = product?.currentValue;
        const willHaveValue = !!newValue;

        if (hadValue && !willHaveValue) {
          return { ...prev, withValue: Math.max(0, prev.withValue - 1) };
        } else if (!hadValue && willHaveValue) {
          return { ...prev, withValue: prev.withValue + 1 };
        }
        return prev;
      });

      setSavingProductIds((prev) => new Set([...prev, productId]));
      try {
        await onSaveProduct(
          productId,
          filter.name,
          newValue || undefined,
          undefined,
        );
      } catch (error) {
        // Revert on error - reload products and counts
        loadProducts();
        loadCounts();
      } finally {
        setSavingProductIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [filter.name, onSaveProduct, loadProducts, loadCounts, products],
  );

  const handleNumericValueChange = useCallback(
    async (productId: string, newValue: string) => {
      const numericValue = newValue ? parseFloat(newValue) : undefined;

      // Optimistic update
      setProducts((prev) =>
        prev.map((p) =>
          p._id === productId
            ? {
                ...p,
                currentNumericValue: numericValue,
                currentValue: undefined,
              }
            : p,
        ),
      );

      // Update counts optimistically
      setCounts((prev) => {
        const product = products.find((p) => p._id === productId);
        const hadValue = product?.currentNumericValue !== undefined;
        const willHaveValue = numericValue !== undefined;

        if (hadValue && !willHaveValue) {
          return { ...prev, withValue: Math.max(0, prev.withValue - 1) };
        } else if (!hadValue && willHaveValue) {
          return { ...prev, withValue: prev.withValue + 1 };
        }
        return prev;
      });

      setSavingProductIds((prev) => new Set([...prev, productId]));
      try {
        await onSaveProduct(productId, filter.name, undefined, numericValue);
      } catch (error) {
        // Revert on error - reload products and counts
        loadProducts();
        loadCounts();
      } finally {
        setSavingProductIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [filter.name, onSaveProduct, loadProducts, loadCounts, products],
  );

  const isRangeFilter = filter.filterType === "range";

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(query) ||
        p.brandName?.toLowerCase().includes(query),
    );
  }, [products, searchQuery]);

  // Split into with/without value
  const productsWithValue = useMemo(
    () =>
      filteredProducts.filter(
        (p) =>
          (isRangeFilter && p.currentNumericValue !== undefined) ||
          (!isRangeFilter && p.currentValue),
      ),
    [filteredProducts, isRangeFilter],
  );

  const productsWithoutValue = useMemo(
    () =>
      filteredProducts.filter(
        (p) =>
          (isRangeFilter && p.currentNumericValue === undefined) ||
          (!isRangeFilter && !p.currentValue),
      ),
    [filteredProducts, isRangeFilter],
  );

  // Limit products without value unless "show all" is clicked
  const displayedProductsWithoutValue = useMemo(() => {
    if (showAllWithoutValue || searchQuery.trim()) {
      return productsWithoutValue;
    }
    return productsWithoutValue.slice(0, INITIAL_PRODUCTS_LIMIT);
  }, [productsWithoutValue, showAllWithoutValue, searchQuery]);

  const hiddenProductsCount =
    productsWithoutValue.length - displayedProductsWithoutValue.length;

  if (!filter.name) {
    return null;
  }

  return (
    <Card tone="transparent" padding={2} radius={2}>
      <Stack space={3}>
        {/* Toggle button */}
        <Button
          mode="bleed"
          tone="default"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ width: "100%" }}
          padding={2}
        >
          <Flex
            align="center"
            justify="space-between"
            style={{ width: "100%" }}
          >
            <Flex align="center" gap={2}>
              {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              <Text size={1} weight="medium">
                Wartości produktów
              </Text>
            </Flex>
            {isLoadingCounts ? (
              <Spinner muted />
            ) : (
              <Text size={1} muted>
                {counts.withValue}/{counts.total} uzupełnionych
              </Text>
            )}
          </Flex>
        </Button>

        {/* Expanded content */}
        {isExpanded && (
          <Card padding={3} border radius={2}>
            {isLoading ? (
              <Flex align="center" justify="center" padding={4}>
                <Spinner muted />
                <Box marginLeft={3}>
                  <Text size={1} muted>
                    Ładowanie produktów...
                  </Text>
                </Box>
              </Flex>
            ) : products.length === 0 ? (
              <Text size={1} muted>
                Brak produktów w tej kategorii.
              </Text>
            ) : (
              <Stack space={4}>
                {/* Search input */}
                <TextInput
                  icon={SearchIcon}
                  placeholder="Szukaj produktu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  fontSize={1}
                />

                {/* No results message */}
                {filteredProducts.length === 0 && searchQuery && (
                  <Card padding={3} tone="transparent">
                    <Text size={1} muted>
                      Nie znaleziono produktów dla &ldquo;{searchQuery}&rdquo;
                    </Text>
                  </Card>
                )}

                {/* Products WITH values */}
                {productsWithValue.length > 0 && (
                  <Stack space={2}>
                    <Text size={1} weight="semibold" muted>
                      Z wartością ({productsWithValue.length})
                    </Text>
                    <Stack space={2}>
                      {productsWithValue.map((product) => (
                        <ProductRow
                          key={product._id}
                          product={product}
                          isRangeFilter={isRangeFilter}
                          unit={filter.unit}
                          isSaving={savingProductIds.has(product._id)}
                          onValueChange={handleValueChange}
                          onNumericValueChange={handleNumericValueChange}
                        />
                      ))}
                    </Stack>
                  </Stack>
                )}

                {/* Products WITHOUT values */}
                {displayedProductsWithoutValue.length > 0 && (
                  <Stack space={2}>
                    <Text size={1} weight="semibold" muted>
                      Bez wartości ({productsWithoutValue.length})
                    </Text>
                    <Stack space={2}>
                      {displayedProductsWithoutValue.map((product) => (
                        <ProductRow
                          key={product._id}
                          product={product}
                          isRangeFilter={isRangeFilter}
                          unit={filter.unit}
                          isSaving={savingProductIds.has(product._id)}
                          onValueChange={handleValueChange}
                          onNumericValueChange={handleNumericValueChange}
                        />
                      ))}
                    </Stack>

                    {/* Show all button */}
                    {hiddenProductsCount > 0 && !searchQuery && (
                      <Button
                        mode="ghost"
                        tone="primary"
                        onClick={() => setShowAllWithoutValue(true)}
                        style={{ width: "100%" }}
                        padding={3}
                      >
                        <Text size={1}>
                          Pokaż wszystkie ({hiddenProductsCount} więcej)
                        </Text>
                      </Button>
                    )}
                  </Stack>
                )}
              </Stack>
            )}
          </Card>
        )}
      </Stack>
    </Card>
  );
}

// Individual product row component with image
function ProductRow({
  product,
  isRangeFilter,
  unit,
  isSaving,
  onValueChange,
  onNumericValueChange,
}: {
  product: ProductWithFilterValue;
  isRangeFilter: boolean;
  unit?: string;
  isSaving: boolean;
  onValueChange: (productId: string, value: string) => void;
  onNumericValueChange: (productId: string, value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(
    isRangeFilter
      ? product.currentNumericValue?.toString() || ""
      : product.currentValue || "",
  );
  const [isDirty, setIsDirty] = useState(false);

  // Sync local value when product value changes externally
  useEffect(() => {
    if (!isDirty) {
      setLocalValue(
        isRangeFilter
          ? product.currentNumericValue?.toString() || ""
          : product.currentValue || "",
      );
    }
  }, [
    product.currentValue,
    product.currentNumericValue,
    isRangeFilter,
    isDirty,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.currentTarget.value);
    setIsDirty(true);
  };

  const handleBlur = () => {
    if (isDirty) {
      if (isRangeFilter) {
        onNumericValueChange(product._id, localValue);
      } else {
        onValueChange(product._id, localValue);
      }
      setIsDirty(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <Card
      padding={2}
      border
      radius={2}
      tone={isSaving ? "positive" : "default"}
    >
      <Flex align="center" gap={3}>
        {/* Product image */}
        <Box
          style={{
            width: "40px",
            height: "40px",
            flexShrink: 0,
            borderRadius: "4px",
            overflow: "hidden",
            backgroundColor: "var(--card-bg2-color)",
          }}
        >
          {product.imageUrl ? (
            <img
              src={`${product.imageUrl}?w=80&h=80&fit=max`}
              alt={product.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <Flex
              align="center"
              justify="center"
              style={{ width: "100%", height: "100%" }}
            >
              <Text size={0} muted>
                –
              </Text>
            </Flex>
          )}
        </Box>

        {/* Product name */}
        <Box flex={1}>
          <Text size={1} weight="medium">
            {product.brandName && (
              <span style={{ opacity: 0.6 }}>{product.brandName} </span>
            )}
            {product.name}
          </Text>
        </Box>

        {/* Value input */}
        <Box style={{ width: isRangeFilter ? "100px" : "180px" }}>
          <Flex align="center" gap={1}>
            <TextInput
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={isRangeFilter ? "Wartość" : "Wpisz..."}
              type={isRangeFilter ? "number" : "text"}
              fontSize={1}
              disabled={isSaving}
            />
            {isRangeFilter && unit && (
              <Text size={1} muted>
                {unit}
              </Text>
            )}
          </Flex>
        </Box>

        {/* Saving indicator */}
        {isSaving && <Spinner muted />}
      </Flex>
    </Card>
  );
}
