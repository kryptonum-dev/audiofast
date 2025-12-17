"use client";

import { CloseIcon } from "@sanity/icons";
import {
  Button,
  Card,
  Dialog,
  Flex,
  Select,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { useCallback, useState } from "react";

import type { FilterConfigItem } from "./types";

interface FilterEditorDialogProps {
  filter: FilterConfigItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (filter: FilterConfigItem) => void;
}

export function FilterEditorDialog({
  filter,
  isOpen,
  onClose,
  onSave,
}: FilterEditorDialogProps) {
  const [editingFilter, setEditingFilter] = useState<FilterConfigItem>(filter);
  const [errors, setErrors] = useState<{ name?: string; unit?: string }>({});

  const validateForm = useCallback(() => {
    const newErrors: { name?: string; unit?: string } = {};

    if (!editingFilter.name?.trim()) {
      newErrors.name = "Nazwa filtra jest wymagana";
    }

    if (editingFilter.filterType === "range" && !editingFilter.unit?.trim()) {
      newErrors.unit = "Jednostka jest wymagana dla filtrów typu zakres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [editingFilter]);

  const handleSave = useCallback(() => {
    if (validateForm()) {
      onSave(editingFilter);
      onClose();
    }
  }, [editingFilter, validateForm, onSave, onClose]);

  return (
    <Dialog header="Edytuj filtr" id="filter-editor" open={isOpen} onClose={onClose}>
      <Stack space={4} padding={4}>
        {/* Filter Name */}
        <Stack space={2}>
          <Text weight="semibold" size={1}>
            Nazwa filtra
          </Text>
          <TextInput
            placeholder="np. Impedancja, Długość kabla"
            value={editingFilter.name || ""}
            onChange={(e) => {
              setEditingFilter({
                ...editingFilter,
                name: e.currentTarget.value,
              });
              setErrors({ ...errors, name: undefined });
            }}
          />
          {errors.name && (
            <Card padding={2} tone="caution" radius={2}>
              <Text size={0}>{errors.name}</Text>
            </Card>
          )}
        </Stack>

        {/* Filter Type */}
        <Stack space={2}>
          <Text weight="semibold" size={1}>
            Typ filtra
          </Text>
          <Select
            value={editingFilter.filterType}
            onChange={(e) => {
              const newType = e.currentTarget.value as "dropdown" | "range";
              setEditingFilter({
                ...editingFilter,
                filterType: newType,
                // Clear unit if switching to dropdown
                unit: newType === "dropdown" ? undefined : editingFilter.unit,
              });
            }}
          >
            <option value="dropdown">Lista rozwijana (dropdown)</option>
            <option value="range">Zakres (suwak min-max)</option>
          </Select>
        </Stack>

        {/* Unit (only for range filters) */}
        {editingFilter.filterType === "range" && (
          <Stack space={2}>
            <Text weight="semibold" size={1}>
              Jednostka
            </Text>
            <TextInput
              placeholder='np. Ω, W, m, Hz'
              value={editingFilter.unit || ""}
              onChange={(e) => {
                setEditingFilter({
                  ...editingFilter,
                  unit: e.currentTarget.value,
                });
                setErrors({ ...errors, unit: undefined });
              }}
            />
            <Text size={0} muted>
              Wartości min/max będą obliczane automatycznie z produktów.
            </Text>
            {errors.unit && (
              <Card padding={2} tone="caution" radius={2}>
                <Text size={0}>{errors.unit}</Text>
              </Card>
            )}
          </Stack>
        )}

        {/* Actions */}
        <Flex gap={2} justify="flex-end">
          <Button mode="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button tone="positive" onClick={handleSave}>
            Zapisz
          </Button>
        </Flex>
      </Stack>
    </Dialog>
  );
}
