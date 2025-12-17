"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AddIcon } from "@sanity/icons";
import {
  Box,
  Button,
  Card,
  Flex,
  Stack,
  Text,
  useToast,
} from "@sanity/ui";
import { Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SanityDocument } from "sanity";
import { useClient } from "sanity";

import { SortableFilterItem } from "./filter-item";
import type { FilterConfigItem, RangeFilterStats } from "./types";

type CustomFiltersConfigViewProps = {
  document: {
    displayed: SanityDocument;
  };
};

function generateKey(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Custom Filters Config View Component
 * Renders as a separate view tab in the Sanity document editor for sub-categories
 * Provides a sortable list interface for managing custom filter definitions
 * with real-time optimistic updates and background saving.
 * Also allows setting filter values for products directly in this view.
 */
export function CustomFiltersConfigView({
  document,
}: CustomFiltersConfigViewProps) {
  const client = useClient({ apiVersion: "2024-01-01" });
  const toast = useToast();

  // Get document info
  const documentId = document.displayed._id;
  const existingFilters = document.displayed.customFilters as
    | FilterConfigItem[]
    | undefined;

  // Local state for editing (optimistic updates)
  const [filters, setFilters] = useState<FilterConfigItem[]>([]);
  const [productStats, setProductStats] = useState<
    Map<string, RangeFilterStats>
  >(new Map());
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );

  // Track if initial load is complete (to avoid saving on mount)
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of latest filters for saving (avoids stale closures)
  const latestFiltersRef = useRef<FilterConfigItem[]>([]);

  // Pending save queue for conflict resolution
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Initialize state from document data
  useEffect(() => {
    // Only initialize once or when document changes from external source
    if (!isInitialized.current) {
      const initialFilters = existingFilters || [];
      setFilters(initialFilters);
      latestFiltersRef.current = initialFilters;

      setTimeout(() => {
        isInitialized.current = true;
      }, 100);
    }
  }, [existingFilters]);

  // Keep latestFiltersRef in sync with state changes
  useEffect(() => {
    latestFiltersRef.current = filters;
  }, [filters]);

  // Background save function with retry logic
  const saveToSanity = useCallback(async (): Promise<void> => {
    // If already saving, mark as pending and return
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setSaveStatus("saving");

    try {
      const currentFilters = latestFiltersRef.current;

      // Ensure all filters have keys
      const filtersWithKeys = currentFilters.map((filter) => ({
        ...filter,
        _key: filter._key || generateKey(),
      }));

      // Get the base document ID (without drafts. prefix)
      const baseId = documentId.startsWith("drafts.")
        ? documentId.replace("drafts.", "")
        : documentId;
      const draftId = `drafts.${baseId}`;

      // Use transaction to create draft if not exists, then patch
      const transaction = client.transaction();

      const {
        _id: _unusedId,
        _type: _unusedType,
        ...restOfDocument
      } = document.displayed;
      transaction.createIfNotExists({
        ...restOfDocument,
        _id: draftId,
        _type: "productCategorySub",
      });

      transaction.patch(draftId, (patch) =>
        patch.set({ customFilters: filtersWithKeys }),
      );

      await transaction.commit();

      setSaveStatus("saved");
    } catch (error) {
      console.error("Error saving filters:", error);
      setSaveStatus("error");
      toast.push({
        status: "error",
        title: "Błąd zapisu",
        description: "Nie udało się zapisać. Spróbuj ponownie.",
      });
    } finally {
      isSavingRef.current = false;

      // If there's a pending save, execute it
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        // Small delay to batch rapid changes
        setTimeout(() => {
          saveToSanity();
        }, 100);
      }
    }
  }, [client, documentId, document.displayed, toast]);

  // Debounced auto-save when filters change
  useEffect(() => {
    if (!isInitialized.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save (300ms delay for smooth typing experience)
    saveTimeoutRef.current = setTimeout(() => {
      saveToSanity();
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filters, saveToSanity]);

  // Load product statistics for range filters
  const loadProductStats = useCallback(async () => {
    if (filters.length === 0 || !documentId) {
      setProductStats(new Map());
      return;
    }

    try {
      const categoryId = documentId.startsWith("drafts.")
        ? documentId.replace("drafts.", "")
        : documentId;

      const products = await client.fetch<
        Array<{
          _id: string;
          name: string;
          customFilterValues?: Array<{
            filterName: string;
            value?: string;
            numericValue?: number;
          }>;
        }>
      >(
        `*[_type == "product" && references($categoryId) && (isArchived != true) && defined(customFilterValues)]{
          _id,
          name,
          customFilterValues[]{filterName, value, numericValue}
        }`,
        { categoryId },
      );

      const statsMap = new Map<string, RangeFilterStats>();

      filters.forEach((filter) => {
        if (filter.filterType === "range") {
          const numericValues = products
            .flatMap(
              (p) =>
                p.customFilterValues?.find(
                  (fv) => fv.filterName === filter.name,
                )?.numericValue,
            )
            .filter((v): v is number => v !== undefined && v !== null);

          if (numericValues.length >= 2) {
            statsMap.set(filter.name, {
              filterName: filter.name,
              min: Math.min(...numericValues),
              max: Math.max(...numericValues),
              productCount: numericValues.length,
            });
          }
        }
      });

      setProductStats(statsMap);
    } catch (error) {
      console.error("Error loading product stats:", error);
      setProductStats(new Map());
    }
  }, [filters, documentId, client]);

  // Load stats when filters change (debounced)
  useEffect(() => {
    if (isInitialized.current) {
      const timeout = setTimeout(() => {
        loadProductStats();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [loadProductStats]);

  const filterKeys = useMemo(() => filters.map((f) => f._key), [filters]);

  // Handle drag end - reorder filters
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = filters.findIndex((f) => f._key === active.id);
        const newIndex = filters.findIndex((f) => f._key === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          setFilters(arrayMove(filters, oldIndex, newIndex));
        }
      }
    },
    [filters],
  );

  // Add new filter
  const handleAddFilter = useCallback(() => {
    const newKey = generateKey();
    const newFilter: FilterConfigItem = {
      _key: newKey,
      name: "",
      filterType: "dropdown",
    };
    setFilters([...filters, newFilter]);
  }, [filters]);

  // Update a filter (optimistic - instant UI update)
  const handleUpdateFilter = useCallback(
    (updatedFilter: FilterConfigItem) => {
      setFilters((prevFilters) =>
        prevFilters.map((f) =>
          f._key === updatedFilter._key ? updatedFilter : f,
        ),
      );
    },
    [],
  );

  // Request delete (shows confirmation)
  const handleRequestDelete = useCallback((index: number) => {
    setDeletingIndex(index);
  }, []);

  // Confirm delete
  const handleConfirmDelete = useCallback(() => {
    if (deletingIndex !== null) {
      setFilters((prevFilters) =>
        prevFilters.filter((_, i) => i !== deletingIndex),
      );
      setDeletingIndex(null);
    }
  }, [deletingIndex]);

  // Cancel delete
  const handleCancelDelete = useCallback(() => {
    setDeletingIndex(null);
  }, []);

  // Save product filter value
  const handleSaveProductValue = useCallback(
    async (
      productId: string,
      filterName: string,
      value: string | undefined,
      numericValue: number | undefined,
    ): Promise<void> => {
      try {
        // Get base product ID
        const baseProductId = productId.startsWith("drafts.")
          ? productId.replace("drafts.", "")
          : productId;
        const draftProductId = `drafts.${baseProductId}`;

        // First, fetch the current product to get existing filter values
        const currentProduct = await client.fetch<{
          _id: string;
          _type: string;
          customFilterValues?: Array<{
            _key: string;
            filterName: string;
            value?: string;
            numericValue?: number;
          }>;
        }>(
          `*[_id == $productId || _id == $draftProductId][0]{
            _id,
            _type,
            customFilterValues
          }`,
          { productId: baseProductId, draftProductId },
        );

        if (!currentProduct) {
          throw new Error("Product not found");
        }

        // Build the new customFilterValues array
        let newFilterValues = [
          ...(currentProduct.customFilterValues || []),
        ];

        // Find existing value for this filter
        const existingIndex = newFilterValues.findIndex(
          (fv) => fv.filterName === filterName,
        );

        // If both value and numericValue are empty, remove the filter value
        if (value === undefined && numericValue === undefined) {
          if (existingIndex !== -1) {
            newFilterValues.splice(existingIndex, 1);
          }
        } else {
          const newFilterValue = {
            _key: existingIndex !== -1 ? newFilterValues[existingIndex]._key : generateKey(),
            filterName,
            value,
            numericValue,
          };

          if (existingIndex !== -1) {
            newFilterValues[existingIndex] = newFilterValue;
          } else {
            newFilterValues.push(newFilterValue);
          }
        }

        // Use transaction to create draft if not exists, then patch
        const transaction = client.transaction();

        // Create draft from published if needed
        transaction.createIfNotExists({
          _id: draftProductId,
          _type: "product",
        });

        // Patch the product's customFilterValues
        transaction.patch(draftProductId, (patch) =>
          patch.set({
            customFilterValues:
              newFilterValues.length > 0 ? newFilterValues : [],
          }),
        );

        await transaction.commit();

        // Refresh stats after saving
        loadProductStats();
      } catch (error) {
        console.error("Error saving product filter value:", error);
        toast.push({
          status: "error",
          title: "Błąd zapisu",
          description: "Nie udało się zapisać wartości filtra dla produktu.",
        });
        throw error;
      }
    },
    [client, toast, loadProductStats],
  );

  return (
    <Card padding={4} sizing="border">
      <Stack space={5}>
        {/* Header */}
        <Flex align="center" justify="space-between">
          <Stack space={2}>
            <Flex align="center" gap={2}>
              <Text size={3} weight="bold">
                Konfiguracja filtrów
              </Text>
              {saveStatus === "saving" && (
                <Text size={1} muted>
                  Zapisywanie...
                </Text>
              )}
              {saveStatus === "saved" && filters.length > 0 && (
                <Text size={1} muted style={{ color: "green" }}>
                  ✓ Zapisano
                </Text>
              )}
              {saveStatus === "error" && (
                <Text size={1} style={{ color: "red" }}>
                  ✕ Błąd zapisu
                </Text>
              )}
            </Flex>
            <Text size={1} muted>
              Zarządzaj filtrami i przypisuj wartości produktom. Zmiany zapisują
              się automatycznie.
            </Text>
          </Stack>
          <Button
            icon={AddIcon}
            text="Dodaj filtr"
            mode="ghost"
            tone="primary"
            onClick={handleAddFilter}
          />
        </Flex>

        {/* Filter List (Sortable) */}
        {filters.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filterKeys}
              strategy={verticalListSortingStrategy}
            >
              <Stack space={3}>
                {filters.map((filter, index) => (
                  <SortableFilterItem
                    key={filter._key}
                    id={filter._key}
                    filter={filter}
                    categoryId={documentId}
                    client={client}
                    onUpdate={handleUpdateFilter}
                    onDelete={() => handleRequestDelete(index)}
                    onSaveProductValue={handleSaveProductValue}
                    rangeStats={productStats.get(filter.name)}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        ) : (
          /* Empty State */
          <Card padding={5} tone="transparent" border>
            <Stack space={3}>
              <Box>
                <Filter size={32} opacity={0.5} />
              </Box>
              <Text muted>Brak zdefiniowanych filtrów dla tej kategorii.</Text>
              <Button
                text="Dodaj pierwszy filtr"
                mode="ghost"
                onClick={handleAddFilter}
              />
            </Stack>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        {deletingIndex !== null && (
          <Card padding={3} tone="critical" border radius={2}>
            <Stack space={3}>
              <Text weight="semibold">
                Czy na pewno chcesz usunąć filtr &ldquo;
                {filters[deletingIndex]?.name || "Bez nazwy"}&rdquo;?
              </Text>
              <Text size={1} muted>
                Produkty z wartościami tego filtra zachowają swoje dane, ale
                filtr nie będzie już wyświetlany na stronie.
              </Text>
              <Flex gap={2}>
                <Button
                  text="Anuluj"
                  mode="ghost"
                  onClick={handleCancelDelete}
                />
                <Button
                  text="Usuń filtr"
                  tone="critical"
                  onClick={handleConfirmDelete}
                />
              </Flex>
            </Stack>
          </Card>
        )}

        {/* Info card */}
        {filters.length > 0 && (
          <Card padding={3} tone="primary" border radius={2}>
            <Stack space={2}>
              <Text size={1} weight="semibold">
                Wskazówki:
              </Text>
              <Text size={1} muted>
                • <strong>Lista rozwijana</strong> - użytkownik wybiera jedną
                wartość z listy (np. kolor, materiał)
              </Text>
              <Text size={1} muted>
                • <strong>Zakres</strong> - użytkownik wybiera przedział
                wartości (np. impedancja 4-16Ω, moc 10-100W)
              </Text>
              <Text size={1} muted>
                • Kliknij &ldquo;Wartości produktów&rdquo; aby przypisać wartości
                do produktów w tej kategorii
              </Text>
            </Stack>
          </Card>
        )}
      </Stack>
    </Card>
  );
}
