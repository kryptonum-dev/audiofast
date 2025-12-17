"use client";

import { CheckmarkCircleIcon, CloseCircleIcon, SyncIcon } from "@sanity/icons";
import {
  Badge,
  Box,
  Card,
  Flex,
  Spinner,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { Filter, Hash,Sliders } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SanityDocument } from "sanity";
import { useClient } from "sanity";

type FilterDefinition = {
  _key: string;
  name: string;
  filterType: "dropdown" | "range";
  unit?: string;
};

type CategoryWithFilters = {
  _id: string;
  name: string;
  filters: FilterDefinition[];
};

type FilterValue = {
  filterName: string;
  value?: string;
  numericValue?: number;
  // Track which category this filter belongs to (for display purposes)
  categoryId?: string;
  categoryName?: string;
};

type ProductFiltersViewProps = {
  document: {
    displayed: SanityDocument;
  };
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ProductFiltersView({ document }: ProductFiltersViewProps) {
  const client = useClient({ apiVersion: "2024-01-01" });
  const product = document?.displayed;

  const [categories, setCategories] = useState<CategoryWithFilters[]>([]);
  const [filterValues, setFilterValues] = useState<FilterValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Refs for debounced saving
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestValuesRef = useRef<FilterValue[]>([]);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    latestValuesRef.current = filterValues;
  }, [filterValues]);

  // Load categories and their filters
  const loadCategoriesAndFilters = useCallback(async () => {
    if (!product?._id) return;

    setIsLoading(true);
    try {
      const productId = (product._id as string).startsWith("drafts.")
        ? (product._id as string).replace("drafts.", "")
        : product._id;

      // Fetch the product's categories with their custom filters
      // Use coalesce to prefer drafts
      const result = await client.fetch<{
        categories: Array<{
          _id: string;
          name: string;
          customFilters?: FilterDefinition[];
        }>;
        customFilterValues?: Array<{
          filterName: string;
          value?: string;
          numericValue?: number;
        }>;
      }>(
        `{
          "product": coalesce(
            *[_id == "drafts." + $productId][0],
            *[_id == $productId][0]
          ) {
            "categories": categories[]-> {
              "category": coalesce(
                *[_id == "drafts." + ^._id][0],
                @
              ) {
                _id,
                name,
                customFilters
              }
            }.category,
            customFilterValues
          }
        }.product`,
        { productId },
      );

      if (result?.categories) {
        // Filter categories that have custom filters
        const categoriesWithFilters = result.categories
          .filter((cat) => cat?.customFilters && cat.customFilters.length > 0)
          .map((cat) => ({
            _id: cat._id,
            name: cat.name,
            filters: cat.customFilters || [],
          }));

        setCategories(categoriesWithFilters);

        // Set filter values from product
        if (result.customFilterValues) {
          setFilterValues(result.customFilterValues);
        }
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setIsLoading(false);
    }
  }, [product?._id, client]);

  useEffect(() => {
    loadCategoriesAndFilters();
  }, [loadCategoriesAndFilters]);

  // Save filter values to Sanity
  const saveToSanity = useCallback(async () => {
    if (!product?._id) return;

    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setSaveStatus("saving");

    try {
      const productId = (product._id as string).startsWith("drafts.")
        ? (product._id as string).replace("drafts.", "")
        : product._id;

      const draftProductId = `drafts.${productId}`;
      const valuesToSave = latestValuesRef.current;

      // Get the current product (prefer draft)
      const currentProduct = await client.fetch<SanityDocument | null>(
        `coalesce(
          *[_id == $draftId][0],
          *[_id == $publishedId][0]
        )`,
        { draftId: draftProductId, publishedId: productId },
      );

      if (!currentProduct) {
        throw new Error("Product not found");
      }

      const isDraft = currentProduct._id.startsWith("drafts.");

      // Prepare the filter values with _key
      const filterValuesWithKeys = valuesToSave
        .filter((fv) => fv.filterName && (fv.value || fv.numericValue !== undefined))
        .map((fv, index) => ({
          _key: `filter-${index}`,
          _type: "filterValue",
          filterName: fv.filterName,
          ...(fv.value !== undefined && { value: fv.value }),
          ...(fv.numericValue !== undefined && { numericValue: fv.numericValue }),
        }));

      if (isDraft) {
        // Patch the existing draft
        await client
          .patch(draftProductId)
          .set({ customFilterValues: filterValuesWithKeys })
          .commit();
      } else {
        // Create a draft from published and patch
        const { _rev, ...productWithoutRev } = currentProduct;
        await client.createIfNotExists({
          ...productWithoutRev,
          _id: draftProductId,
        });
        await client
          .patch(draftProductId)
          .set({ customFilterValues: filterValuesWithKeys })
          .commit();
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Error saving filter values:", error);
      setSaveStatus("error");
    } finally {
      isSavingRef.current = false;

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        saveToSanity();
      }
    }
  }, [product?._id, client]);

  // Debounced save trigger
  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToSanity();
    }, 800);
  }, [saveToSanity]);

  // Handle value change for a filter
  const handleValueChange = useCallback(
    (filterName: string, value: string | undefined, numericValue: number | undefined) => {
      setFilterValues((prev) => {
        const existing = prev.find((fv) => fv.filterName === filterName);
        if (existing) {
          return prev.map((fv) =>
            fv.filterName === filterName
              ? { ...fv, value, numericValue }
              : fv,
          );
        }
        return [...prev, { filterName, value, numericValue }];
      });
      triggerSave();
    },
    [triggerSave],
  );

  // Get all unique filters across all categories
  const allFilters = useMemo(() => {
    const filterMap = new Map<string, { filter: FilterDefinition; categoryName: string }>();

    categories.forEach((cat) => {
      cat.filters.forEach((filter) => {
        if (!filterMap.has(filter.name)) {
          filterMap.set(filter.name, { filter, categoryName: cat.name });
        }
      });
    });

    return Array.from(filterMap.values());
  }, [categories]);

  // Get current value for a filter
  const getFilterValue = useCallback(
    (filterName: string) => {
      return filterValues.find((fv) => fv.filterName === filterName);
    },
    [filterValues],
  );

  // Count filled filters
  const filledCount = useMemo(() => {
    return allFilters.filter((f) => {
      const value = getFilterValue(f.filter.name);
      if (f.filter.filterType === "range") {
        return value?.numericValue !== undefined;
      }
      return value?.value && value.value.trim() !== "";
    }).length;
  }, [allFilters, getFilterValue]);

  if (!product) {
    return (
      <Card padding={4}>
        <Text muted>Dokument nie został znaleziony.</Text>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card padding={5}>
        <Flex align="center" justify="center" gap={3}>
          <Spinner muted />
          <Text muted>Ładowanie filtrów...</Text>
        </Flex>
      </Card>
    );
  }

  if (categories.length === 0) {
    return (
      <Card padding={5}>
        <Flex direction="column" align="center" justify="center" gap={4}>
          <Box
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "var(--card-bg2-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Filter size={28} style={{ opacity: 0.4 }} />
          </Box>
          <Stack space={2}>
            <Text size={2} weight="semibold" align="center">
              Brak filtrów do uzupełnienia
            </Text>
            <Text size={1} muted align="center">
              Kategorie tego produktu nie mają zdefiniowanych filtrów.
              <br />
              Dodaj filtry w widoku kategorii.
            </Text>
          </Stack>
        </Flex>
      </Card>
    );
  }

  return (
    <Card padding={4}>
      <Stack space={5}>
        {/* Header */}
        <Flex align="center" justify="space-between">
          <Flex align="center" gap={3}>
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "var(--card-badge-default-bg-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Filter size={20} />
            </Box>
            <Stack space={2}>
              <Text size={2} weight="semibold">
                Filtry produktu
              </Text>
              <Text size={1} muted>
                Uzupełnij wartości filtrów dla tego produktu
              </Text>
            </Stack>
          </Flex>

          {/* Save status & progress */}
          <Flex align="center" gap={3}>
            <Badge tone={filledCount === allFilters.length ? "positive" : "default"}>
              {filledCount}/{allFilters.length} uzupełnionych
            </Badge>
            {saveStatus === "saving" && (
              <Flex align="center" gap={2}>
                <SyncIcon style={{ animation: "spin 1s linear infinite" }} />
                <Text size={1} muted>
                  Zapisuję...
                </Text>
              </Flex>
            )}
            {saveStatus === "saved" && (
              <Flex align="center" gap={2}>
                <CheckmarkCircleIcon style={{ color: "var(--card-positive-fg-color)" }} />
                <Text size={1} style={{ color: "var(--card-positive-fg-color)" }}>
                  Zapisano
                </Text>
              </Flex>
            )}
            {saveStatus === "error" && (
              <Flex align="center" gap={2}>
                <CloseCircleIcon style={{ color: "var(--card-critical-fg-color)" }} />
                <Text size={1} style={{ color: "var(--card-critical-fg-color)" }}>
                  Błąd zapisu
                </Text>
              </Flex>
            )}
          </Flex>
        </Flex>

        {/* Filters list */}
        <Stack space={3}>
          {allFilters.map(({ filter, categoryName }) => (
            <FilterInputRow
              key={filter.name}
              filter={filter}
              categoryName={categoryName}
              currentValue={getFilterValue(filter.name)}
              onValueChange={handleValueChange}
            />
          ))}
        </Stack>

        {/* Info footer */}
        <Card padding={3} tone="primary" border radius={2}>
          <Flex align="center" gap={2}>
            <Text size={1}>ℹ️</Text>
            <Text size={1} muted>
              Filtry pochodzą z kategorii:{" "}
              <strong>{categories.map((c) => c.name).join(", ")}</strong>
            </Text>
          </Flex>
        </Card>
      </Stack>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Card>
  );
}

// Individual filter input row
function FilterInputRow({
  filter,
  categoryName,
  currentValue,
  onValueChange,
}: {
  filter: FilterDefinition;
  categoryName: string;
  currentValue?: FilterValue;
  onValueChange: (
    filterName: string,
    value: string | undefined,
    numericValue: number | undefined,
  ) => void;
}) {
  const isRangeFilter = filter.filterType === "range";

  const [localValue, setLocalValue] = useState(
    isRangeFilter
      ? currentValue?.numericValue?.toString() || ""
      : currentValue?.value || "",
  );
  const [isDirty, setIsDirty] = useState(false);

  // Sync local value when prop changes
  useEffect(() => {
    if (!isDirty) {
      setLocalValue(
        isRangeFilter
          ? currentValue?.numericValue?.toString() || ""
          : currentValue?.value || "",
      );
    }
  }, [currentValue, isRangeFilter, isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.currentTarget.value);
    setIsDirty(true);
  };

  const handleBlur = () => {
    if (isDirty) {
      if (isRangeFilter) {
        const numValue = localValue ? parseFloat(localValue) : undefined;
        onValueChange(filter.name, undefined, numValue);
      } else {
        onValueChange(filter.name, localValue || undefined, undefined);
      }
      setIsDirty(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  const hasValue = isRangeFilter
    ? currentValue?.numericValue !== undefined
    : currentValue?.value && currentValue.value.trim() !== "";

  return (
    <Card
      padding={3}
      border
      radius={2}
      tone={hasValue ? "positive" : "default"}

    >
      <Flex align="center" gap={4}>
        {/* Icon */}
        <Box
          style={{
            width: 36,
            height: 36,
            borderRadius: "8px",
            backgroundColor: hasValue
              ? "var(--card-positive-bg-color)"
              : "var(--card-bg2-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isRangeFilter ? (
            <Sliders size={18} style={{ opacity: hasValue ? 1 : 0.5 }} />
          ) : (
            <Hash size={18} style={{ opacity: hasValue ? 1 : 0.5 }} />
          )}
        </Box>

        {/* Filter info */}
        <Box flex={1}>
          <Text size={2} weight="medium">
            {filter.name}
          </Text>
          <Flex align="center" gap={2} style={{ marginTop: "8px" }}>
            <Badge mode="outline" fontSize={0}>
              {isRangeFilter ? "Zakres" : "Lista"}
            </Badge>
            <Text size={0} muted>
              z kategorii: {categoryName}
            </Text>
          </Flex>
        </Box>

        {/* Input */}
        <Box style={{ width: isRangeFilter ? 120 : 200 }}>
          <Flex align="center" gap={2}>
            <TextInput
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={isRangeFilter ? "Wartość" : "Wpisz wartość..."}
              type={isRangeFilter ? "number" : "text"}
              fontSize={1}
            />
            {isRangeFilter && filter.unit && (
              <Text size={1} muted style={{ flexShrink: 0 }}>
                {filter.unit}
              </Text>
            )}
          </Flex>
        </Box>

        {/* Status indicator */}
        <Box style={{ width: 24, flexShrink: 0 }}>
          {hasValue ? (
            <CheckmarkCircleIcon
              style={{ color: "var(--card-positive-fg-color)", fontSize: 20 }}
            />
          ) : (
            <Box
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: "2px solid var(--card-muted-fg-color)",
                opacity: 0.3,
              }}
            />
          )}
        </Box>
      </Flex>
    </Card>
  );
}
