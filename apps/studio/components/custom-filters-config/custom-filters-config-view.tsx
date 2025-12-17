"use client";

import { AddIcon } from "@sanity/icons";
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Stack,
  Text,
} from "@sanity/ui";
import { useMemo, useState, useCallback } from "react";
import type { StructureResolverContext } from "sanity/structure";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Filter, Sliders } from "lucide-react";

import type { FilterConfigItem, RangeFilterStats } from "./types";
import { SortableFilterItem } from "./filter-item";

interface CustomFiltersConfigViewProps {
  document: {
    _id: string;
    _type: string;
    customFilters?: FilterConfigItem[];
  };
  documentId: string;
  schemaType: string;
  context: StructureResolverContext;
}

export function CustomFiltersConfigView({
  document,
  context,
}: CustomFiltersConfigViewProps) {
  const client = context.getClient({ apiVersion: "2024-01-01" });
  const [filters, setFilters] = useState<FilterConfigItem[]>(
    document?.customFilters || [],
  );
  const [productStats, setProductStats] = useState<Map<string, RangeFilterStats>>(
    new Map(),
  );
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingFilter, setEditingFilter] = useState<FilterConfigItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8 as any,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filterKeys = useMemo(() => filters.map((f) => f._key), [filters]);

  // Load product statistics for range filters
  const loadProductStats = useCallback(async () => {
    if (filters.length === 0 || !document?._id) {
      setProductStats(new Map());
      return;
    }

    setIsLoadingStats(true);
    try {
      const categoryId = document._id;

      // Fetch products with filter values for this category
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
  }, [filters, document?._id, client]);

  // Load stats when component mounts or filters change
  useMemo(() => {
    loadProductStats();
  }, [loadProductStats]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filters.findIndex((f) => f._key === active.id);
      const newIndex = filters.findIndex((f) => f._key === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFilters = arrayMove(filters, oldIndex, newIndex);
        setFilters(newFilters);
        // Would need to save this back to Sanity
      }
    }
  };

  const handleAddFilter = useCallback(() => {
    const newKey = `filter-${Date.now()}`;
    const newFilter: FilterConfigItem = {
      _key: newKey,
      name: "",
      filterType: "dropdown",
    };
    setFilters([...filters, newFilter]);
    setEditingIndex(filters.length);
    setEditingFilter(newFilter);
  }, [filters]);

  const handleEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setEditingFilter(filters[index]);
  }, [filters]);

  const handleSaveEdit = useCallback(
    (updatedFilter: FilterConfigItem) => {
      if (editingIndex !== null) {
        const newFilters = [...filters];
        newFilters[editingIndex] = updatedFilter;
        setFilters(newFilters);
        setEditingIndex(null);
        setEditingFilter(null);
      }
    },
    [filters, editingIndex],
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
    <Card padding={4}>
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
          <Button
            icon={AddIcon}
            text="Dodaj filtr"
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
                    isEditing={editingIndex === index}
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
                Czy na pewno chcesz usunąć ten filtr? Akcja nie może być
                cofnięta.
              </Text>
              <Flex gap={2}>
                <Button
                  text="Anuluj"
                  mode="ghost"
                  onClick={() => setDeletingIndex(null)}
                />
                <Button
                  text="Usuń"
                  tone="critical"
                  onClick={confirmDelete}
                />
              </Flex>
            </Stack>
          </Card>
        )}
      </Stack>
    </Card>
  );
}
