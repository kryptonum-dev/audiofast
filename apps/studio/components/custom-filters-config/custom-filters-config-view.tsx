"use client";

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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SanityDocument } from "sanity";
import { useClient } from "sanity";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Filter } from "lucide-react";

import type { FilterConfigItem, RangeFilterStats } from "./types";
import { SortableFilterItem } from "./filter-item";

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

  // Local state for editing
  const [filters, setFilters] = useState<FilterConfigItem[]>([]);
  const [productStats, setProductStats] = useState<
    Map<string, RangeFilterStats>
  >(new Map());
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Track if initial load is complete (to avoid saving on mount)
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track dirty state to prevent props overwriting local changes
  const isDirty = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const latestFiltersRef = useRef<FilterConfigItem[]>([]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Initialize state from document data (only when not dirty)
  useEffect(() => {
    if (isDirty.current) {
      return;
    }

    const initialFilters = existingFilters || [];
    setFilters(initialFilters);
    latestFiltersRef.current = initialFilters;

    setTimeout(() => {
      isInitialized.current = true;
    }, 100);
  }, [existingFilters]);

  // Keep latestFiltersRef in sync with state changes
  useEffect(() => {
    latestFiltersRef.current = filters;
  }, [filters]);

  // Mark as dirty when state changes after initialization
  useEffect(() => {
    if (isInitialized.current) {
      isDirty.current = true;
    }
  }, [filters]);

  // Auto-save function
  const saveChanges = useCallback(async (): Promise<void> => {
    if (!isInitialized.current) return;

    setIsSaving(true);
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

      isDirty.current = false;
    } catch (error) {
      console.error("Error saving filters:", error);
      toast.push({
        status: "error",
        title: "Błąd zapisu",
        description: "Nie udało się zapisać konfiguracji filtrów.",
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [client, documentId, document.displayed, toast]);

  // Auto-save with debounce when data changes
  useEffect(() => {
    if (!isInitialized.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const savePromise = saveChanges();
      savePromiseRef.current = savePromise;
      savePromise.finally(() => {
        savePromiseRef.current = null;
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filters, saveChanges]);

  // Load product statistics for range filters
  const loadProductStats = useCallback(async () => {
    if (filters.length === 0 || !documentId) {
      setProductStats(new Map());
      return;
    }

    setIsLoadingStats(true);
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
        `*[_type == "product" && references($categoryId) && defined(customFilterValues)]{
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
    } finally {
      setIsLoadingStats(false);
    }
  }, [filters, documentId, client]);

  // Load stats when filters change
  useEffect(() => {
    if (isInitialized.current) {
      loadProductStats();
    }
  }, [loadProductStats]);

  const filterKeys = useMemo(() => filters.map((f) => f._key), [filters]);

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

  const handleAddFilter = useCallback(() => {
    const newKey = generateKey();
    const newFilter: FilterConfigItem = {
      _key: newKey,
      name: "",
      filterType: "dropdown",
    };
    setFilters([...filters, newFilter]);
  }, [filters]);

  const handleEdit = useCallback(
    (index: number) => {
      // For now, just show a placeholder - editing is done inline
      console.log("Edit filter at index:", index);
    },
    [],
  );

  const handleSaveEdit = useCallback(
    (updatedFilter: FilterConfigItem) => {
      const index = filters.findIndex((f) => f._key === updatedFilter._key);
      if (index !== -1) {
        const newFilters = [...filters];
        newFilters[index] = updatedFilter;
        setFilters(newFilters);
      }
    },
    [filters],
  );

  const handleDelete = useCallback((index: number) => {
    setDeletingIndex(index);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deletingIndex !== null) {
      const newFilters = filters.filter((_, i) => i !== deletingIndex);
      setFilters(newFilters);
      setDeletingIndex(null);
    }
  }, [deletingIndex, filters]);

  return (
    <Card padding={4} sizing="border">
      <Stack space={5}>
        {/* Header */}
        <Flex align="center" justify="space-between">
          <Stack space={2}>
            <Text size={3} weight="bold">
              Konfiguracja filtrów
            </Text>
            <Text size={1} muted>
              Zarządzaj filtrami dla tej kategorii. Przeciągaj aby zmienić
              kolejność.
            </Text>
          </Stack>
          <Flex align="center" gap={2}>
            {isSaving && (
              <Text size={1} muted>
                Zapisywanie...
              </Text>
            )}
            <Button
              icon={AddIcon}
              text="Dodaj filtr"
              mode="ghost"
              tone="primary"
              onClick={handleAddFilter}
            />
          </Flex>
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
                    isEditing={false}
                    onEdit={() => handleEdit(index)}
                    onDelete={() => handleDelete(index)}
                    onSave={handleSaveEdit}
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
              <Button text="Dodaj pierwszy filtr" onClick={handleAddFilter} />
            </Stack>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        {deletingIndex !== null && (
          <Card padding={3} tone="critical" border>
            <Stack space={3}>
              <Text weight="semibold">
                Czy na pewno chcesz usunąć filtr &ldquo;
                {filters[deletingIndex]?.name || "Bez nazwy"}&rdquo;? Akcja nie
                może być cofnięta.
              </Text>
              <Flex gap={2}>
                <Button
                  text="Anuluj"
                  mode="ghost"
                  onClick={() => setDeletingIndex(null)}
                />
                <Button text="Usuń" tone="critical" onClick={confirmDelete} />
              </Flex>
            </Stack>
          </Card>
        )}
      </Stack>
    </Card>
  );
}
