'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AddIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DragHandleIcon,
  TrashIcon,
} from '@sanity/icons';
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@sanity/ui';
import { Edit2, FolderPlus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PortableTextBlock, SanityDocument } from 'sanity';
import { useClient } from 'sanity';

import { CellEditor } from './cell-editor';
import {
  createEmptyCellValue,
  createEmptyGroup,
  createEmptyRow,
  generateKey,
  type TechnicalDataGroup,
  type TechnicalDataRow,
  type TechnicalDataValue,
} from './types';

type CellEditorState = {
  isOpen: boolean;
  groupIndex: number;
  rowIndex: number;
  valueIndex: number;
  content: PortableTextBlock[];
} | null;

type DeleteConfirmState = {
  type: 'row' | 'variant' | 'group';
  groupIndex?: number;
  index: number;
  name: string;
} | null;

type TechnicalDataViewProps = {
  document: {
    displayed: SanityDocument;
  };
};

/**
 * Generate CSS grid template columns for the table layout
 */
function getGridTemplateColumns(valueColumnCount: number): string {
  return `160px repeat(${valueColumnCount}, 1fr) 36px`;
}

/**
 * Render a rich text preview with basic formatting
 */
function RichTextPreview({ blocks }: { blocks: PortableTextBlock[] }) {
  if (!blocks || blocks.length === 0) {
    return <span style={{ color: 'var(--card-muted-fg-color)' }}>–</span>;
  }

  return (
    <div style={{ fontSize: '13px', lineHeight: 1.4 }}>
      {blocks.map((block, blockIndex) => {
        if (block._type !== 'block') return null;

        const isListItem = block.listItem;
        const listStyle =
          block.listItem === 'bullet'
            ? '• '
            : block.listItem === 'number'
              ? `${blockIndex + 1}. `
              : '';

        const children =
          (block.children as Array<{
            _key?: string;
            text?: string;
            marks?: string[];
          }>) || [];

        const content = children.map((child, childIndex) => {
          const text = child.text || '';
          if (!text) return null;

          const marks = child.marks || [];
          const isBold = marks.includes('strong');
          const isItalic = marks.includes('em');
          const isLink = marks.some((m) => m !== 'strong' && m !== 'em');

          let style: React.CSSProperties = {};
          if (isBold) style.fontWeight = 600;
          if (isItalic) style.fontStyle = 'italic';
          if (isLink) {
            style.color = 'var(--card-link-color)';
            style.textDecoration = 'underline';
          }

          return (
            <span key={child._key || childIndex} style={style}>
              {text}
            </span>
          );
        });

        if (isListItem) {
          return (
            <div
              key={block._key || blockIndex}
              style={{ paddingLeft: '0.5em' }}
            >
              <span style={{ color: 'var(--card-muted-fg-color)' }}>
                {listStyle}
              </span>
              {content}
            </div>
          );
        }

        return <div key={block._key || blockIndex}>{content}</div>;
      })}
    </div>
  );
}

/**
 * Sortable variant component for drag-and-drop reordering
 */
function SortableVariant({
  variant,
  index,
  variantKey,
  onNameChange,
  onRemove,
}: {
  variant: string;
  index: number;
  variantKey: string;
  onNameChange: (index: number, name: string) => void;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: variantKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      padding={3}
      border
      radius={2}
      tone={isDragging ? 'primary' : 'default'}
    >
      <Flex align="center" gap={2}>
        <Box
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            padding: '2px',
            flexShrink: 0,
          }}
        >
          <DragHandleIcon />
        </Box>
        <Box flex={1}>
          <TextInput
            value={variant}
            onChange={(e) => onNameChange(index, e.currentTarget.value)}
            placeholder={`Wariant ${index + 1}`}
            fontSize={1}
          />
        </Box>
        <Button
          icon={TrashIcon}
          mode="ghost"
          tone="critical"
          onClick={() => onRemove(index)}
          padding={2}
        />
      </Flex>
    </Card>
  );
}

/**
 * Sortable row component for drag-and-drop
 */
function SortableRow({
  row,
  groupIndex,
  rowIndex,
  valueColumnCount,
  onTitleChange,
  onCellClick,
  onRemove,
}: {
  row: TechnicalDataRow;
  groupIndex: number;
  rowIndex: number;
  valueColumnCount: number;
  onTitleChange: (groupIndex: number, rowIndex: number, title: string) => void;
  onCellClick: (groupIndex: number, rowIndex: number, valueIndex: number) => void;
  onRemove: (groupIndex: number, rowIndex: number) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row._key });

  // Auto-resize textarea on mount and when value changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [row.title]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      padding={2}
      border
      radius={2}
      tone={isDragging ? 'primary' : 'default'}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: getGridTemplateColumns(valueColumnCount),
          gap: '8px',
          alignItems: 'start',
        }}
      >
        {/* Drag handle + Row title */}
        <Flex align="center" gap={1}>
          <Box
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              padding: '2px',
              flexShrink: 0,
              marginTop: '6px',
            }}
          >
            <DragHandleIcon />
          </Box>
          <Box flex={1}>
            <textarea
              ref={textareaRef}
              value={row.title || ''}
              onChange={(e) => onTitleChange(groupIndex, rowIndex, e.target.value)}
              placeholder="Parametr"
              rows={1}
              style={{
                maxWidth: '88%',
                padding: '6px 8px',
                fontSize: '13px',
                fontFamily: 'inherit',
                border: '1px solid var(--card-border-color)',
                borderRadius: '3px',
                background: 'var(--card-bg-color)',
                color: 'inherit',
                resize: 'none',
                overflow: 'hidden',
                lineHeight: 1.4,
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />
          </Box>
        </Flex>

        {/* Value cells */}
        {row.values?.map((value, valueIndex) => (
          <Card
            key={value._key || valueIndex}
            padding={2}
            border
            radius={2}
            tone="default"
            style={{
              cursor: 'pointer',
              minHeight: '2.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '4px',
            }}
            onClick={() => onCellClick(groupIndex, rowIndex, valueIndex)}
          >
            <Box flex={1}>
              <RichTextPreview blocks={value.content || []} />
            </Box>
            <Edit2
              size={12}
              style={{ opacity: 0.4, flexShrink: 0, marginTop: '2px' }}
            />
          </Card>
        ))}

        {/* Remove button */}
        <Button
          icon={TrashIcon}
          mode="bleed"
          tone="critical"
          onClick={() => onRemove(groupIndex, rowIndex)}
          title="Usuń"
          padding={2}
          style={{ justifySelf: 'center', marginTop: '4px' }}
        />
      </div>
    </Card>
  );
}

/**
 * Technical Data View Component
 * Renders as a separate view tab in the Sanity document editor
 * Provides a table-like interface for managing technical specifications with groups
 */
export function TechnicalDataView({ document }: TechnicalDataViewProps) {
  const client = useClient({ apiVersion: '2024-01-01' });
  const toast = useToast();

  // Get document info
  const documentId = document.displayed._id;
  const technicalData = document.displayed.technicalData as TechnicalDataValue;

  // Local state for editing
  const [variants, setVariants] = useState<string[]>([]);
  const [groups, setGroups] = useState<TechnicalDataGroup[]>([]);
  const [cellEditor, setCellEditor] = useState<CellEditorState>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Track if initial load is complete (to avoid saving on mount)
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize state from document data
  useEffect(() => {
    if (technicalData) {
      setVariants(technicalData.variants || []);
      // Handle groups structure
      if (technicalData.groups && technicalData.groups.length > 0) {
        setGroups(technicalData.groups);
      } else {
        // Create default empty group
        setGroups([createEmptyGroup(1)]);
      }
    } else {
      setVariants([]);
      setGroups([createEmptyGroup(1)]);
    }
    // Mark as initialized after a short delay
    setTimeout(() => {
      isInitialized.current = true;
    }, 100);
  }, [technicalData]);

  // Auto-save function
  const saveChanges = useCallback(async () => {
    if (!isInitialized.current) return;

    setIsSaving(true);
    try {
      const newTechnicalData: TechnicalDataValue = {
        variants: variants.length > 0 ? variants : null,
        groups: groups.map((group) => ({
          ...group,
          _key: group._key || generateKey(),
          rows: group.rows.map((row) => ({
            ...row,
            _key: row._key || generateKey(),
            values: row.values.map((val) => ({
              ...val,
              _key: val._key || generateKey(),
            })),
          })),
        })),
      };

      // Get the base document ID (without drafts. prefix)
      const baseId = documentId.startsWith('drafts.')
        ? documentId.replace('drafts.', '')
        : documentId;
      const draftId = `drafts.${baseId}`;

      // Use transaction to create draft if not exists, then patch
      const transaction = client.transaction();

      // Create draft from published if it doesn't exist
      const {
        _id: _unusedId,
        _type: _unusedType,
        ...restOfDocument
      } = document.displayed;
      transaction.createIfNotExists({
        ...restOfDocument,
        _id: draftId,
        _type: 'product',
      });

      // Then patch the technical data
      transaction.patch(draftId, (patch) =>
        patch.set({ technicalData: newTechnicalData })
      );

      await transaction.commit();
    } catch (error) {
      console.error('Error saving technical data:', error);
      toast.push({
        status: 'error',
        title: 'Błąd zapisu',
        description: 'Nie udało się zapisać danych technicznych.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [client, documentId, document.displayed, variants, groups, toast]);

  // Auto-save with debounce when data changes
  useEffect(() => {
    if (!isInitialized.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [variants, groups, saveChanges]);

  // Calculate number of value columns (at least 1 for single-model products)
  const valueColumnCount = useMemo(
    () => Math.max(1, variants.length),
    [variants.length]
  );

  // Sync all rows in all groups when variant count changes
  const syncGroupsToVariantCount = useCallback((newCount: number) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) => ({
        ...group,
        rows: group.rows.map((row) => {
          const currentValues = row.values || [];
          if (currentValues.length === newCount) return row;

          if (currentValues.length < newCount) {
            const newValues = [
              ...currentValues,
              ...Array.from({ length: newCount - currentValues.length }).map(
                () => createEmptyCellValue()
              ),
            ];
            return { ...row, values: newValues };
          } else {
            return { ...row, values: currentValues.slice(0, newCount) };
          }
        }),
      }))
    );
  }, []);

  // Variant management
  const handleAddVariant = useCallback(() => {
    const newVariants = [...variants, `Wariant ${variants.length + 1}`];
    setVariants(newVariants);
    syncGroupsToVariantCount(newVariants.length);
  }, [variants, syncGroupsToVariantCount]);

  const handleRequestRemoveVariant = useCallback(
    (index: number) => {
      setDeleteConfirm({
        type: 'variant',
        index,
        name: variants[index] || `Wariant ${index + 1}`,
      });
    },
    [variants]
  );

  const handleConfirmRemoveVariant = useCallback(
    (index: number) => {
      const newVariants = variants.filter((_, i) => i !== index);
      setVariants(newVariants);
      setGroups((prevGroups) =>
        prevGroups.map((group) => ({
          ...group,
          rows: group.rows.map((row) => ({
            ...row,
            values: row.values.filter((_, i) => i !== index),
          })),
        }))
      );
    },
    [variants]
  );

  const handleVariantNameChange = useCallback(
    (index: number, name: string) => {
      const newVariants = [...variants];
      newVariants[index] = name;
      setVariants(newVariants);
    },
    [variants]
  );

  // Variant keys for drag and drop (stable keys based on variant index)
  const [variantKeys, setVariantKeys] = useState<string[]>([]);

  // Generate stable keys for variants when they change in count
  useEffect(() => {
    if (variants.length !== variantKeys.length) {
      // Add new keys for added variants, keep existing keys for existing variants
      setVariantKeys((prevKeys) => {
        if (variants.length > prevKeys.length) {
          // Adding variants - add new keys
          const newKeys = [...prevKeys];
          for (let i = prevKeys.length; i < variants.length; i++) {
            newKeys.push(generateKey());
          }
          return newKeys;
        } else {
          // Removing variants - keep keys that still exist
          return prevKeys.slice(0, variants.length);
        }
      });
    }
  }, [variants.length, variantKeys.length]);

  // Handle variant drag and drop
  const handleVariantDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = variantKeys.indexOf(active.id as string);
        const newIndex = variantKeys.indexOf(over.id as string);

        if (oldIndex !== -1 && newIndex !== -1) {
          // Reorder variant keys
          const newVariantKeys = arrayMove(variantKeys, oldIndex, newIndex);
          setVariantKeys(newVariantKeys);

          // Reorder variants
          const newVariants = arrayMove(variants, oldIndex, newIndex);
          setVariants(newVariants);

          // Reorder values in all rows of all groups
          setGroups((prevGroups) =>
            prevGroups.map((group) => ({
              ...group,
              rows: group.rows.map((row) => ({
                ...row,
                values: arrayMove(row.values, oldIndex, newIndex),
              })),
            }))
          );
        }
      }
    },
    [variantKeys, variants]
  );

  // Group management
  const handleAddGroup = useCallback(() => {
    setGroups((prev) => [...prev, createEmptyGroup(valueColumnCount)]);
  }, [valueColumnCount]);

  const handleRequestRemoveGroup = useCallback(
    (groupIndex: number) => {
      setDeleteConfirm({
        type: 'group',
        index: groupIndex,
        name: groups[groupIndex]?.title || `Sekcja ${groupIndex + 1}`,
      });
    },
    [groups]
  );

  const handleConfirmRemoveGroup = useCallback((groupIndex: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== groupIndex));
  }, []);

  const handleGroupTitleChange = useCallback(
    (groupIndex: number, title: string) => {
      setGroups((prev) =>
        prev.map((group, i) =>
          i === groupIndex ? { ...group, title: title || null } : group
        )
      );
    },
    []
  );

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }, []);

  // Row management within groups
  const handleAddRow = useCallback(
    (groupIndex: number) => {
      setGroups((prev) =>
        prev.map((group, i) =>
          i === groupIndex
            ? { ...group, rows: [...group.rows, createEmptyRow(valueColumnCount)] }
            : group
        )
      );
    },
    [valueColumnCount]
  );

  const handleRequestRemoveRow = useCallback(
    (groupIndex: number, rowIndex: number) => {
      setDeleteConfirm({
        type: 'row',
        groupIndex,
        index: rowIndex,
        name: groups[groupIndex]?.rows[rowIndex]?.title || `Parametr ${rowIndex + 1}`,
      });
    },
    [groups]
  );

  const handleConfirmRemoveRow = useCallback(
    (groupIndex: number, rowIndex: number) => {
      setGroups((prev) =>
        prev.map((group, i) =>
          i === groupIndex
            ? { ...group, rows: group.rows.filter((_, ri) => ri !== rowIndex) }
            : group
        )
      );
    },
    []
  );

  const handleRowTitleChange = useCallback(
    (groupIndex: number, rowIndex: number, title: string) => {
      setGroups((prev) =>
        prev.map((group, gi) =>
          gi === groupIndex
            ? {
                ...group,
                rows: group.rows.map((row, ri) =>
                  ri === rowIndex ? { ...row, title } : row
                ),
              }
            : group
        )
      );
    },
    []
  );

  // Drag and drop within a group
  const handleDragEnd = useCallback(
    (groupIndex: number) => (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        setGroups((prevGroups) =>
          prevGroups.map((group, gi) => {
            if (gi !== groupIndex) return group;
            const oldIndex = group.rows.findIndex(
              (item) => item._key === active.id
            );
            const newIndex = group.rows.findIndex(
              (item) => item._key === over.id
            );
            return { ...group, rows: arrayMove(group.rows, oldIndex, newIndex) };
          })
        );
      }
    },
    []
  );

  // Cell editing
  const handleOpenCellEditor = useCallback(
    (groupIndex: number, rowIndex: number, valueIndex: number) => {
      const content =
        groups[groupIndex]?.rows[rowIndex]?.values[valueIndex]?.content || [];
      setCellEditor({ isOpen: true, groupIndex, rowIndex, valueIndex, content });
    },
    [groups]
  );

  const handleSaveCellContent = useCallback(
    (content: PortableTextBlock[]) => {
      if (!cellEditor) return;

      setGroups((prev) =>
        prev.map((group, gi) => {
          if (gi !== cellEditor.groupIndex) return group;
          return {
            ...group,
            rows: group.rows.map((row, ri) => {
              if (ri !== cellEditor.rowIndex) return row;
              return {
                ...row,
                values: row.values.map((val, vi) => {
                  if (vi !== cellEditor.valueIndex) return val;
                  return { ...val, content };
                }),
              };
            }),
          };
        })
      );

      setCellEditor(null);
    },
    [cellEditor]
  );

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'row' && deleteConfirm.groupIndex !== undefined) {
      handleConfirmRemoveRow(deleteConfirm.groupIndex, deleteConfirm.index);
    } else if (deleteConfirm.type === 'variant') {
      handleConfirmRemoveVariant(deleteConfirm.index);
    } else if (deleteConfirm.type === 'group') {
      handleConfirmRemoveGroup(deleteConfirm.index);
    }

    setDeleteConfirm(null);
  }, [
    deleteConfirm,
    handleConfirmRemoveRow,
    handleConfirmRemoveVariant,
    handleConfirmRemoveGroup,
  ]);

  return (
    <Card padding={4} sizing="border">
      <Stack space={5}>
        {/* Header */}
        <Flex align="center" justify="space-between">
          <Stack space={2}>
            <Text size={3} weight="bold">
              Dane techniczne
            </Text>
            <Text size={1} muted>
              Zarządzaj specyfikacją techniczną produktu. Przeciągaj wiersze i
              warianty, aby zmienić kolejność.
            </Text>
          </Stack>
          {isSaving && (
            <Text size={1} muted>
              Zapisywanie...
            </Text>
          )}
        </Flex>

        {/* Variants Section */}
        <Card padding={4} border radius={2} tone="primary">
          <Stack space={4}>
            <Flex align="center" justify="space-between">
              <Stack space={2}>
                <Text size={2} weight="semibold">
                  Warianty produktu
                </Text>
                <Text size={1} muted>
                  {variants.length === 0
                    ? 'Brak wariantów - produkt jednomodelowy (1 kolumna wartości)'
                    : `${variants.length} wariant${variants.length === 1 ? '' : variants.length < 5 ? 'y' : 'ów'}`}
                </Text>
              </Stack>
              <Button
                icon={AddIcon}
                text="Dodaj wariant"
                mode="ghost"
                tone="primary"
                onClick={handleAddVariant}
              />
            </Flex>

            {variants.length > 0 && variantKeys.length === variants.length && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleVariantDragEnd}
              >
                <SortableContext
                  items={variantKeys}
                  strategy={horizontalListSortingStrategy}
                >
                  <Grid columns={[1, 2, 3]} gap={3}>
                    {variants.map((variant, index) => (
                      <SortableVariant
                        key={variantKeys[index]}
                        variant={variant}
                        index={index}
                        variantKey={variantKeys[index]}
                        onNameChange={handleVariantNameChange}
                        onRemove={handleRequestRemoveVariant}
                      />
                    ))}
                  </Grid>
                </SortableContext>
              </DndContext>
            )}
          </Stack>
        </Card>

        {/* Groups Section */}
        <Stack space={4}>
          {/* Only show "Sekcje specyfikacji" header when there are multiple groups */}
          {groups.length > 1 && (
            <Flex align="center" justify="space-between">
              <Text size={2} weight="semibold">
                Sekcje specyfikacji
              </Text>
              <Button
                icon={FolderPlus}
                text="Dodaj sekcję"
                mode="ghost"
                tone="positive"
                onClick={handleAddGroup}
              />
            </Flex>
          )}

          {groups.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group._key);
            const rowKeys = group.rows.map((row) => row._key);

            // Only show section names when there are multiple groups
            const showSectionName = groups.length > 1;

            return (
              <Card key={group._key} padding={4} border radius={2}>
                <Stack space={4}>
                  {/* Group Header */}
                  <Flex align="center" gap={3}>
                    {/* Collapse button - only show when multiple groups */}
                    {showSectionName && (
                      <Button
                        icon={isCollapsed ? ChevronDownIcon : ChevronUpIcon}
                        mode="bleed"
                        onClick={() => toggleGroupCollapse(group._key)}
                        padding={2}
                      />
                    )}
                    
                    {/* Section name input - only show when multiple groups */}
                    {showSectionName ? (
                      <Box flex={1}>
                        <TextInput
                          value={group.title || ''}
                          onChange={(e) =>
                            handleGroupTitleChange(groupIndex, e.currentTarget.value)
                          }
                          placeholder="Nazwa sekcji (np. 'Specyfikacja techniczna')"
                          fontSize={2}
                        />
                      </Box>
                    ) : (
                      <Box flex={1}>
                        <Text size={2} weight="semibold">
                          Parametry techniczne
                        </Text>
                      </Box>
                    )}
                    
                    <Text size={1} muted>
                      {group.rows.length} parametr
                      {group.rows.length === 1
                        ? ''
                        : group.rows.length < 5
                          ? 'y'
                          : 'ów'}
                    </Text>
                    {groups.length > 1 && (
                      <Button
                        icon={TrashIcon}
                        mode="ghost"
                        tone="critical"
                        onClick={() => handleRequestRemoveGroup(groupIndex)}
                        padding={2}
                        title="Usuń sekcję"
                      />
                    )}
                  </Flex>

                  {/* Group Content */}
                  {!isCollapsed && (
                    <>
                      {/* Table Header */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            getGridTemplateColumns(valueColumnCount),
                          gap: '8px',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: 'var(--card-bg2-color)',
                          borderRadius: '4px',
                        }}
                      >
                        <Text size={1} weight="bold">
                          Parametr
                        </Text>
                        {variants.length > 0 ? (
                          variants.map((variant, index) => (
                            <Text
                              key={index}
                              size={1}
                              weight="bold"
                              align="center"
                            >
                              {variant || `Wariant ${index + 1}`}
                            </Text>
                          ))
                        ) : (
                          <Text size={1} weight="bold" align="center">
                            Wartość
                          </Text>
                        )}
                        <span />
                      </div>

                      {/* Sortable Table Rows */}
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd(groupIndex)}
                      >
                        <SortableContext
                          items={rowKeys}
                          strategy={verticalListSortingStrategy}
                        >
                          <Stack space={2}>
                            {group.rows.map((row, rowIndex) => (
                              <SortableRow
                                key={row._key}
                                row={row}
                                groupIndex={groupIndex}
                                rowIndex={rowIndex}
                                valueColumnCount={valueColumnCount}
                                onTitleChange={handleRowTitleChange}
                                onCellClick={handleOpenCellEditor}
                                onRemove={handleRequestRemoveRow}
                              />
                            ))}
                          </Stack>
                        </SortableContext>
                      </DndContext>

                      {group.rows.length === 0 && (
                        <Card padding={5} border radius={2} tone="transparent">
                          <Text size={1} muted align="center">
                            Brak parametrów w tej sekcji.
                          </Text>
                        </Card>
                      )}

                      {/* Add row button */}
                      <Button
                        icon={AddIcon}
                        text="Dodaj parametr"
                        mode="ghost"
                        onClick={() => handleAddRow(groupIndex)}
                        style={{ width: '100%' }}
                      />
                    </>
                  )}
                </Stack>
              </Card>
            );
          })}

          {/* Add group button */}
          <Button
            icon={FolderPlus}
            text="Dodaj sekcję"
            mode="ghost"
            tone="positive"
            onClick={handleAddGroup}
            style={{ width: '100%' }}
          />
        </Stack>

        {/* Cell Editor Dialog */}
        {cellEditor?.isOpen && (
          <Dialog
            id="cell-editor-dialog"
            header="Edytuj zawartość komórki"
            onClose={() => setCellEditor(null)}
            width={1}
          >
            <CellEditor
              initialContent={cellEditor.content}
              onSave={handleSaveCellContent}
              onCancel={() => setCellEditor(null)}
            />
          </Dialog>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <Dialog
            id="delete-confirm-dialog"
            header={
              deleteConfirm.type === 'row'
                ? 'Usuń parametr'
                : deleteConfirm.type === 'group'
                  ? 'Usuń sekcję'
                  : 'Usuń wariant'
            }
            onClose={() => setDeleteConfirm(null)}
            width={0}
          >
            <Box padding={4}>
              <Stack space={4}>
                <Text size={2}>
                  Czy na pewno chcesz usunąć{' '}
                  {deleteConfirm.type === 'row'
                    ? 'parametr'
                    : deleteConfirm.type === 'group'
                      ? 'sekcję'
                      : 'wariant'}{' '}
                  <strong>&ldquo;{deleteConfirm.name}&rdquo;</strong>?
                </Text>
                {deleteConfirm.type === 'variant' && (
                  <Text size={1} muted>
                    Spowoduje to usunięcie tej kolumny wartości ze wszystkich
                    parametrów.
                  </Text>
                )}
                {deleteConfirm.type === 'group' && (
                  <Text size={1} muted>
                    Spowoduje to usunięcie wszystkich parametrów w tej sekcji.
                  </Text>
                )}
                <Flex gap={3} justify="flex-end">
                  <Button
                    text="Anuluj"
                    mode="ghost"
                    onClick={() => setDeleteConfirm(null)}
                  />
                  <Button
                    text="Usuń"
                    tone="critical"
                    onClick={handleConfirmDelete}
                  />
                </Flex>
              </Stack>
            </Box>
          </Dialog>
        )}
      </Stack>
    </Card>
  );
}

export default TechnicalDataView;
