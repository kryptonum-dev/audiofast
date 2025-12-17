"use client";

import { EditIcon, TrashIcon } from "@sanity/icons";
import { Badge, Box, Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Grip, Hash, Sliders } from "lucide-react";

import type { FilterConfigItem, RangeFilterStats } from "./types";

interface SortableFilterItemProps {
  id: string;
  filter: FilterConfigItem;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (filter: FilterConfigItem) => void;
  rangeStats?: RangeFilterStats;
}

export function SortableFilterItem({
  id,
  filter,
  isEditing,
  onEdit,
  onDelete,
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

  const badgeColor = filter.filterType === "range" ? "primary" : "default";
  const icon =
    filter.filterType === "range" ? (
      <Sliders size={16} />
    ) : (
      <Hash size={16} />
    );

  return (
    <div ref={setNodeRef} style={style}>
      <Card border padding={3}>
        <Flex align="center" gap={3}>
          {/* Drag Handle */}
          <Box
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", opacity: 0.5 }}
          >
            <Grip size={20} />
          </Box>

          {/* Filter Info */}
          <Stack space={2} flex={1}>
            <Flex align="center" gap={2}>
              <Text weight="semibold" size={2}>
                {filter.name || "Filtr bez nazwy"}
              </Text>
              <Badge size={0} tone={badgeColor}>
                {filter.filterType === "range" ? `Zakres${filter.unit ? ` (${filter.unit})` : ""}` : "Lista"}
              </Badge>
            </Flex>
            {rangeStats && (
              <Text size={1} muted>
                Zakres: {rangeStats.min} - {rangeStats.max}
                {filter.unit ? ` ${filter.unit}` : ""} ({rangeStats.productCount}{" "}
                produktów)
              </Text>
            )}
          </Stack>

          {/* Actions */}
          <Flex gap={2}>
            <Button
              icon={EditIcon}
              mode="bleed"
              tone="primary"
              onClick={onEdit}
              title="Edytuj filtr"
            />
            <Button
              icon={TrashIcon}
              mode="bleed"
              tone="critical"
              onClick={onDelete}
              title="Usuń filtr"
            />
          </Flex>
        </Flex>
      </Card>
    </div>
  );
}
