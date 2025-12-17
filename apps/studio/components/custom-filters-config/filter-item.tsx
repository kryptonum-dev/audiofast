"use client";

import { TrashIcon } from "@sanity/icons";
import {
  Box,
  Button,
  Card,
  Flex,
  Select,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Grip } from "lucide-react";
import type { SanityClient } from "sanity";

import { ProductFilterValues } from "./product-filter-values";
import type { FilterConfigItem, RangeFilterStats } from "./types";

interface SortableFilterItemProps {
  id: string;
  filter: FilterConfigItem;
  categoryId: string;
  client: SanityClient;
  onUpdate: (filter: FilterConfigItem) => void;
  onDelete: () => void;
  onSaveProductValue: (
    productId: string,
    filterName: string,
    value: string | undefined,
    numericValue: number | undefined,
  ) => Promise<void>;
  rangeStats?: RangeFilterStats;
}

export function SortableFilterItem({
  id,
  filter,
  categoryId,
  client,
  onUpdate,
  onDelete,
  onSaveProductValue,
  rangeStats,
}: SortableFilterItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleNameChange = (name: string) => {
    onUpdate({ ...filter, name });
  };

  const handleTypeChange = (filterType: "dropdown" | "range") => {
    onUpdate({
      ...filter,
      filterType,
      // Clear unit if switching to dropdown
      unit: filterType === "dropdown" ? undefined : filter.unit,
    });
  };

  const handleUnitChange = (unit: string) => {
    onUpdate({ ...filter, unit: unit || undefined });
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        border
        padding={3}
        radius={2}
        tone={isDragging ? "primary" : "default"}
      >
        <Stack space={3}>
          {/* Main row with drag handle, name input, and actions */}
          <Flex align="center" gap={3}>
            {/* Drag Handle */}
            <Box
              {...attributes}
              {...listeners}
              style={{ cursor: "grab", opacity: 0.5, flexShrink: 0 }}
            >
              <Grip size={20} />
            </Box>

            {/* Filter Name */}
            <Box flex={1}>
              <TextInput
                value={filter.name || ""}
                onChange={(e) => handleNameChange(e.currentTarget.value)}
                placeholder="Nazwa filtra (np. Impedancja)"
                fontSize={2}
              />
            </Box>

            {/* Filter Type Select */}
            <Box style={{ width: "180px", flexShrink: 0 }}>
              <Select
                value={filter.filterType}
                onChange={(e) =>
                  handleTypeChange(
                    e.currentTarget.value as "dropdown" | "range",
                  )
                }
                fontSize={1}
              >
                <option value="dropdown">Lista rozwijana</option>
                <option value="range">Zakres (min-max)</option>
              </Select>
            </Box>

            {/* Unit Input (only for range) */}
            {filter.filterType === "range" && (
              <Box style={{ width: "80px", flexShrink: 0 }}>
                <TextInput
                  value={filter.unit || ""}
                  onChange={(e) => handleUnitChange(e.currentTarget.value)}
                  placeholder="Jednostka"
                  fontSize={1}
                />
              </Box>
            )}

            {/* Delete button */}
            <Button
              icon={TrashIcon}
              mode="bleed"
              tone="critical"
              onClick={onDelete}
              title="Usuń filtr"
              padding={2}
            />
          </Flex>

          {/* Range stats info */}
          {filter.filterType === "range" && rangeStats && (
            <Text size={1} muted>
              Zakres z produktów: {rangeStats.min} - {rangeStats.max}
              {filter.unit ? ` ${filter.unit}` : ""} ({rangeStats.productCount}{" "}
              produktów)
            </Text>
          )}

          {/* Validation warning */}
          {!filter.name && (
            <Card padding={2} tone="caution" radius={2}>
              <Text size={1}>Wprowadź nazwę filtra</Text>
            </Card>
          )}

          {/* Product filter values section */}
          {filter.name && (
            <ProductFilterValues
              filter={filter}
              categoryId={categoryId}
              client={client}
              onSaveProduct={onSaveProductValue}
            />
          )}
        </Stack>
      </Card>
    </div>
  );
}
