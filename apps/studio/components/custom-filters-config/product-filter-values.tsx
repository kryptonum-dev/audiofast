"use client";

import { ChevronDownIcon, ChevronUpIcon } from "@sanity/icons";
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
import { useCallback, useEffect, useState } from "react";
import type { SanityClient } from "sanity";

import type { FilterConfigItem } from "./types";

type ProductWithFilterValue = {
  _id: string;
  name: string;
  brandName?: string;
  currentValue?: string;
  currentNumericValue?: number;
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

export function ProductFilterValues({
  filter,
  categoryId,
  client,
  onSaveProduct,
}: ProductFilterValuesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [products, setProducts] = useState<ProductWithFilterValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingProductIds, setSavingProductIds] = useState<Set<string>>(
    new Set(),
  );

  // Fetch products when expanded - prefer drafts over published
  const loadProducts = useCallback(async () => {
    if (!isExpanded || !filter.name) return;

    setIsLoading(true);
    try {
      // Get base category ID (without drafts prefix)
      const baseCategoryId = categoryId.startsWith("drafts.")
        ? categoryId.replace("drafts.", "")
        : categoryId;

      // Query that prefers drafts over published documents
      // First get all product IDs in this category, then for each get draft or published
      const result = await client.fetch<
        Array<{
          _id: string;
          name: string;
          brandName?: string;
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
            customFilterValues
          }
        }.product | order(name asc)`,
        { categoryId: baseCategoryId },
      );

      const productsWithValues = result.map((product) => {
        const filterValue = product.customFilterValues?.find(
          (fv) => fv.filterName === filter.name,
        );
        // Use base ID (without drafts prefix) for consistency
        const baseId = product._id.startsWith("drafts.")
          ? product._id.replace("drafts.", "")
          : product._id;
        return {
          _id: baseId,
          name: product.name,
          brandName: product.brandName,
          currentValue: filterValue?.value,
          currentNumericValue: filterValue?.numericValue,
        };
      });

      setProducts(productsWithValues);
    } catch (error) {
      console.error("Error loading products:", error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [isExpanded, filter.name, categoryId, client]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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

      setSavingProductIds((prev) => new Set([...prev, productId]));
      try {
        await onSaveProduct(
          productId,
          filter.name,
          newValue || undefined,
          undefined,
        );
      } catch (error) {
        // Revert on error - reload products
        loadProducts();
      } finally {
        setSavingProductIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [filter.name, onSaveProduct, loadProducts],
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

      setSavingProductIds((prev) => new Set([...prev, productId]));
      try {
        await onSaveProduct(productId, filter.name, undefined, numericValue);
      } catch (error) {
        // Revert on error - reload products
        loadProducts();
      } finally {
        setSavingProductIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [filter.name, onSaveProduct, loadProducts],
  );

  const isRangeFilter = filter.filterType === "range";
  const productsWithValue = products.filter(
    (p) =>
      (isRangeFilter && p.currentNumericValue !== undefined) ||
      (!isRangeFilter && p.currentValue),
  );
  const productsWithoutValue = products.filter(
    (p) =>
      (isRangeFilter && p.currentNumericValue === undefined) ||
      (!isRangeFilter && !p.currentValue),
  );

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
            <Text size={1} muted>
              {productsWithValue.length}/{products.length} uzupełnionych
            </Text>
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
                {productsWithoutValue.length > 0 && (
                  <Stack space={2}>
                    <Text size={1} weight="semibold" muted>
                      Bez wartości ({productsWithoutValue.length})
                    </Text>
                    <Stack space={2}>
                      {productsWithoutValue.map((product) => (
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
              </Stack>
            )}
          </Card>
        )}
      </Stack>
    </Card>
  );
}

// Individual product row component
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
        <Box flex={1}>
          <Text size={1} weight="medium">
            {product.brandName && `${product.brandName} `}
            {product.name}
          </Text>
        </Box>
        <Box style={{ width: isRangeFilter ? "120px" : "200px" }}>
          <Flex align="center" gap={1}>
            <TextInput
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={isRangeFilter ? "Wartość" : "Wpisz wartość..."}
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
        {isSaving && <Spinner muted />}
      </Flex>
    </Card>
  );
}
