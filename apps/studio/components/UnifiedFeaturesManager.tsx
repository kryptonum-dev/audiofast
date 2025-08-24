// eslint-disable-next-line simple-import-sort/imports
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AddIcon,
  CogIcon,
  EllipsisHorizontalIcon,
  TrashIcon,
  DragHandleIcon,
} from '@sanity/icons';
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Flex,
  Grid,
  Heading,
  Menu,
  MenuButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@sanity/ui';
import { useDocumentOperation } from 'sanity';
import PricingOverview from './FeaturesPricingTable';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type FeatureOption = {
  _key?: string;
  label: string;
  value: string;
  basePriceModifier: number;
  featureOverrides?: FeatureOverride[];
  isAvailable: boolean;
  overridesEnabled?: boolean;
  secondOption?: {
    enabled?: boolean;
    kind?: 'numeric' | 'choice';
    numeric?: {
      unit?: string;
      min?: number;
      max?: number;
      step?: number;
      perUnitPrice?: number;
      // Primary-scoped per-unit overrides live with primary option overrides (reuse featureOverrides)
    };
    choices?: Array<{ label: string; value: string; price?: number }>;
    optional?: boolean; // If true, users can select none of the choices
  };
};

type ProductFeature = {
  _key?: string;
  featureName: string;
  options: FeatureOption[];
};

type FeatureOverride = {
  targetFeature: string;
  targetOption: string;
  newPrice?: number; // For base price override
  newIncrementPrice?: number; // For increment per-unit price override
  // Optional: when overriding nested "choice" price, identify the sub-option
  targetSecondChoice?: string;
};

// SortableOption component for drag-and-drop functionality
interface SortableOptionProps {
  option: FeatureOption;
  optionIndex: number;
  featureIndex: number;
  feature: ProductFeature;
  children: React.ReactNode;
  isDragDisabled?: boolean;
  dragOverInfo?: {
    featureIndex: number;
    oldIndex: number;
    newIndex: number;
  } | null;
}

function SortableOption({
  option,
  optionIndex,
  featureIndex,
  feature,
  children,
  isDragDisabled = false,
  dragOverInfo,
}: SortableOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: option._key || `${featureIndex}-${optionIndex}`,
    disabled: isDragDisabled,
  });

  // Check if this is the drop target position
  const isDropTarget =
    dragOverInfo &&
    dragOverInfo.featureIndex === featureIndex &&
    optionIndex === dragOverInfo.newIndex &&
    dragOverInfo.oldIndex !== dragOverInfo.newIndex;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        padding={3}
        tone="transparent"
        border
        style={{
          cursor: 'default',
          position: 'relative',
        }}>
        {!isDragDisabled && (
          <Flex
            align="center"
            justify="flex-end"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 100,
            }}>
            <Button
              mode="bleed"
              icon={DragHandleIcon}
              tone="default"
              {...attributes}
              {...listeners}
              style={{ cursor: 'grab' }}
              title="Przeciągnij aby zmienić kolejność"
            />
          </Flex>
        )}
        {children}
        {/* Visual feedback for drag operations - blue dashed border */}
        {isDropTarget && (
          <Box
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              border: '2px dashed #3b82f6',
              borderRadius: '4px',
              pointerEvents: 'none',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
            }}
          />
        )}
      </Card>
    </div>
  );
}

// Pricing table data computation moved to FeaturesPricingTable

interface UnifiedFeaturesManagerProps {
  document: {
    displayed: {
      features?: ProductFeature[];
      name?: string;
      _id?: string;
    };
  };
}

export function UnifiedFeaturesManager(props: UnifiedFeaturesManagerProps) {
  const rawDocumentId = props.document.displayed._id || '';
  // Remove 'drafts.' prefix if present for useDocumentOperation
  const documentId = rawDocumentId.replace(/^drafts\./, '');
  const { patch } = useDocumentOperation(documentId, 'product');

  const features = useMemo(
    () => (props.document.displayed.features as ProductFeature[]) || [],
    [props.document.displayed.features]
  );
  const productName = props.document.displayed.name;
  const primaryFeatureKey = (props.document.displayed as any)
    ?.primaryFeatureKey as string | undefined;
  // placeholder to satisfy linter (no-op)
  const [activeTab, setActiveTab] = useState('manage');
  const [showAddFeatureDialog, setShowAddFeatureDialog] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState('');
  // Step 2 state: primary selection and scoped overrides
  const [activePrimaryOption, setActivePrimaryOption] = useState<string>('');
  // Drag and drop state
  const [showReorderConfirmation, setShowReorderConfirmation] = useState(false);
  const [pendingReorder, setPendingReorder] = useState<{
    featureIndex: number;
    oldIndex: number;
    newIndex: number;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{
    featureIndex: number;
    oldIndex: number;
    newIndex: number;
  } | null>(null);
  // Remove option state
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{
    featureIndex: number;
    optionIndex: number;
  } | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Keep activePrimaryOption synced to the first option of the selected Primary
  useEffect(() => {
    if (!primaryFeatureKey) {
      setActivePrimaryOption('');
      return;
    }
    const pf = features.find((f) => f._key === primaryFeatureKey);
    if (!pf) return;
    const first = pf.options?.[0]?.value || '';
    const stillValid = pf.options?.some((o) => o.value === activePrimaryOption);
    if (!stillValid) setActivePrimaryOption(first);
  }, [primaryFeatureKey, features, activePrimaryOption]);

  // Default primary option value (first item)
  const defaultPrimaryValue = useMemo(() => {
    if (!primaryFeatureKey) return '';
    const pf = features.find((f) => f._key === primaryFeatureKey);
    return pf?.options?.[0]?.value || '';
  }, [primaryFeatureKey, features]);

  // Pricing conversion functions
  const convertPricingOnReorder = useCallback(
    (
      featureIndex: number,
      oldIndex: number,
      newIndex: number
    ): ProductFeature[] => {
      const updatedFeatures = [...features];
      const feature = updatedFeatures[featureIndex];

      // Reorder the options
      const reorderedOptions = arrayMove(feature.options, oldIndex, newIndex);

      // If the default position is changing (either direction)
      if (
        (newIndex === 0 && oldIndex !== 0) ||
        (oldIndex === 0 && newIndex !== 0)
      ) {
        const newDefaultOption = reorderedOptions[0];
        const oldDefaultOption = feature.options[0];

        // Convert pricing for all secondary features
        const allFeatures = [...updatedFeatures];

        // For each feature that can be affected by primary overrides
        allFeatures.forEach((targetFeature, targetFeatureIndex) => {
          if (targetFeature._key === feature._key) return; // Skip the feature being reordered

          targetFeature.options.forEach((targetOption, targetOptionIndex) => {
            // Find current override from new default option to this target
            const currentOverride = newDefaultOption.featureOverrides?.find(
              (ov) =>
                ov.targetFeature === targetFeature.featureName &&
                ov.targetOption === targetOption.value &&
                !ov.targetSecondChoice
            );

            // Set new base price (from override or keep current base)
            const newBasePriceModifier =
              currentOverride?.newPrice ?? targetOption.basePriceModifier;
            allFeatures[targetFeatureIndex].options[
              targetOptionIndex
            ].basePriceModifier = newBasePriceModifier;

            // Update overrides for the old default option (which is now non-default)
            if (!oldDefaultOption.featureOverrides) {
              oldDefaultOption.featureOverrides = [];
            }

            // Remove the override from new default since it's now base price
            if (currentOverride) {
              newDefaultOption.featureOverrides =
                newDefaultOption.featureOverrides?.filter(
                  (ov) =>
                    !(
                      ov.targetFeature === targetFeature.featureName &&
                      ov.targetOption === targetOption.value &&
                      !ov.targetSecondChoice
                    )
                );
            }

            // Add override to old default option
            const existingOldOverride =
              oldDefaultOption.featureOverrides.findIndex(
                (ov) =>
                  ov.targetFeature === targetFeature.featureName &&
                  ov.targetOption === targetOption.value &&
                  !ov.targetSecondChoice
              );

            if (existingOldOverride >= 0) {
              oldDefaultOption.featureOverrides[existingOldOverride].newPrice =
                targetOption.basePriceModifier;
            } else {
              oldDefaultOption.featureOverrides.push({
                targetFeature: targetFeature.featureName,
                targetOption: targetOption.value,
                newPrice: targetOption.basePriceModifier,
              });
            }
          });
        });

        // Update the reordered feature's options with the old default option changes
        const oldDefaultInReordered = reorderedOptions.find(
          (opt) => opt._key === oldDefaultOption._key
        );
        if (oldDefaultInReordered) {
          oldDefaultInReordered.featureOverrides =
            oldDefaultOption.featureOverrides;
        }

        // Update the new default option's overrides
        const newDefaultInReordered = reorderedOptions.find(
          (opt) => opt._key === newDefaultOption._key
        );
        if (newDefaultInReordered) {
          newDefaultInReordered.featureOverrides =
            newDefaultOption.featureOverrides;
        }
      }

      updatedFeatures[featureIndex].options = reorderedOptions;
      return updatedFeatures;
    },
    [features]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Reset drag state
      setActiveId(null);
      setDragOverInfo(null);

      if (!over || active.id === over.id) return;

      // Parse the drag identifiers to get feature and option indices
      const activeId = active.id.toString();
      const overId = over.id.toString();

      // Find which feature this belongs to and the old/new indices
      let featureIndex = -1;
      let oldIndex = -1;
      let newIndex = -1;

      features.forEach((feature, fIdx) => {
        feature.options.forEach((option, oIdx) => {
          const optionId = option._key || `${fIdx}-${oIdx}`;
          if (optionId === activeId) {
            featureIndex = fIdx;
            oldIndex = oIdx;
          }
          if (optionId === overId) {
            newIndex = oIdx;
          }
        });
      });

      if (featureIndex === -1 || oldIndex === -1 || newIndex === -1) return;

      // Check if this reorder would change the default AND it's the primary feature
      const isPrimaryFeature =
        features[featureIndex]._key === primaryFeatureKey;
      const wouldChangeDefault =
        (newIndex === 0 && oldIndex !== 0) || // Making a non-default the new default
        (oldIndex === 0 && newIndex !== 0); // Moving current default away from first position

      if (wouldChangeDefault && isPrimaryFeature) {
        // Show confirmation dialog only for primary feature
        setPendingReorder({ featureIndex, oldIndex, newIndex });
        setShowReorderConfirmation(true);
      } else {
        // Simple reorder without pricing changes (for secondary features or non-default changes)
        const updatedFeatures = [...features];
        updatedFeatures[featureIndex].options = arrayMove(
          updatedFeatures[featureIndex].options,
          oldIndex,
          newIndex
        );
        patch.execute([{ set: { features: updatedFeatures } }]);
      }
    },
    [features, patch, primaryFeatureKey]
  );

  const confirmReorder = useCallback(() => {
    if (!pendingReorder) return;

    const updatedFeatures = convertPricingOnReorder(
      pendingReorder.featureIndex,
      pendingReorder.oldIndex,
      pendingReorder.newIndex
    );

    patch.execute([{ set: { features: updatedFeatures } }]);
    setShowReorderConfirmation(false);
    setPendingReorder(null);
  }, [pendingReorder, convertPricingOnReorder, patch]);

  const cancelReorder = useCallback(() => {
    setShowReorderConfirmation(false);
    setPendingReorder(null);
  }, []);

  // Remove option logic
  const handleRemoveOption = useCallback(
    (featureIndex: number, optionIndex: number) => {
      const feature = features[featureIndex];
      if (!feature || !feature.options[optionIndex]) return;

      // Check if this is the only option in the feature
      if (feature.options.length === 1) {
        alert(
          'Nie można usunąć jedynej opcji w cesze. Usuń całą cechę zamiast tego.'
        );
        return;
      }

      setPendingRemoval({ featureIndex, optionIndex });
      setShowRemoveConfirmation(true);
    },
    [features]
  );

  const confirmRemoveOption = useCallback(() => {
    if (!pendingRemoval) return;

    const { featureIndex, optionIndex } = pendingRemoval;
    const updatedFeatures = [...features];
    const feature = updatedFeatures[featureIndex];
    const removedOption = feature.options[optionIndex];

    // If removing the default option (index 0), we need to handle pricing conversion
    if (optionIndex === 0 && feature.options.length > 1) {
      // The new default will be the option at index 1 (which becomes index 0)
      const newDefaultOption = feature.options[1];

      // Convert pricing for all secondary features if this is the primary feature
      if (feature._key === primaryFeatureKey) {
        updatedFeatures.forEach((targetFeature, targetFeatureIndex) => {
          if (targetFeature._key === feature._key) return; // Skip the current feature

          targetFeature.options.forEach((targetOption, targetOptionIndex) => {
            // Find current override from new default option to this target
            const currentOverride = newDefaultOption.featureOverrides?.find(
              (ov) =>
                ov.targetFeature === targetFeature.featureName &&
                ov.targetOption === targetOption.value &&
                !ov.targetSecondChoice
            );

            // Set new base price (from override or keep current base)
            const newBasePriceModifier =
              currentOverride?.newPrice ?? targetOption.basePriceModifier;
            updatedFeatures[targetFeatureIndex].options[
              targetOptionIndex
            ].basePriceModifier = newBasePriceModifier;

            // Add override to removed option for reference (though it will be deleted)
            if (!removedOption.featureOverrides) {
              removedOption.featureOverrides = [];
            }

            // Remove the override from new default since it's now base price
            if (currentOverride && newDefaultOption.featureOverrides) {
              newDefaultOption.featureOverrides =
                newDefaultOption.featureOverrides.filter(
                  (ov) =>
                    !(
                      ov.targetFeature === targetFeature.featureName &&
                      ov.targetOption === targetOption.value &&
                      !ov.targetSecondChoice
                    )
                );
            }
          });
        });
      }
    }

    // Remove the option
    updatedFeatures[featureIndex].options.splice(optionIndex, 1);

    // Clean up any overrides that target the removed option
    updatedFeatures.forEach((feat) => {
      feat.options.forEach((opt) => {
        if (opt.featureOverrides) {
          opt.featureOverrides = opt.featureOverrides.filter(
            (ov) =>
              !(
                ov.targetFeature === feature.featureName &&
                ov.targetOption === removedOption.value
              )
          );
        }
      });
    });

    patch.execute([{ set: { features: updatedFeatures } }]);
    setShowRemoveConfirmation(false);
    setPendingRemoval(null);
  }, [pendingRemoval, features, primaryFeatureKey, patch]);

  const cancelRemoveOption = useCallback(() => {
    setShowRemoveConfirmation(false);
    setPendingRemoval(null);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        setDragOverInfo(null);
        return;
      }

      const activeId = active.id.toString();
      const overId = over.id.toString();

      // Find which feature this belongs to and the old/new indices
      let featureIndex = -1;
      let oldIndex = -1;
      let newIndex = -1;

      // First pass: find the active item (what we're dragging)
      features.forEach((feature, fIdx) => {
        feature.options.forEach((option, oIdx) => {
          const optionId = option._key || `${fIdx}-${oIdx}`;
          if (optionId === activeId) {
            featureIndex = fIdx;
            oldIndex = oIdx;
          }
        });
      });

      // Second pass: find the target within the same feature only
      if (featureIndex !== -1) {
        const targetFeature = features[featureIndex];
        targetFeature.options.forEach((option, oIdx) => {
          const optionId = option._key || `${featureIndex}-${oIdx}`;
          if (optionId === overId) {
            newIndex = oIdx;
          }
        });
      }

      if (
        featureIndex !== -1 &&
        oldIndex !== -1 &&
        newIndex !== -1 &&
        oldIndex !== newIndex
      ) {
        setDragOverInfo({ featureIndex, oldIndex, newIndex });
      } else {
        setDragOverInfo(null);
      }
    },
    [features]
  );

  // Get the currently dragged item for the overlay
  const activeDragItem = useMemo(() => {
    if (!activeId) return null;

    for (const feature of features) {
      for (
        let optionIndex = 0;
        optionIndex < feature.options.length;
        optionIndex++
      ) {
        const option = feature.options[optionIndex];
        const optionId =
          option._key || `${features.indexOf(feature)}-${optionIndex}`;
        if (optionId === activeId) {
          return { option, optionIndex, feature };
        }
      }
    }
    return null;
  }, [activeId, features]);

  // Table data now computed inside FeaturesPricingTable component

  // Only features without secondOption enabled are selectable as Primary
  const selectablePrimaryFeatures = useMemo(
    () =>
      features.filter(
        (f) => !f.options?.some((o) => Boolean(o.secondOption?.enabled))
      ),
    [features]
  );

  // Add new feature
  const handleAddFeature = useCallback(() => {
    if (!newFeatureName.trim()) return;

    const newFeature: ProductFeature = {
      _key: `feature-${Date.now()}`,
      featureName: newFeatureName.trim(),
      options: [],
    };

    patch.execute([{ set: { features: [...features, newFeature] } }]);
    setNewFeatureName('');
    setShowAddFeatureDialog(false);
  }, [newFeatureName, features, patch]);

  // Add option to feature
  const handleAddOption = useCallback(
    (featureIndex: number) => {
      const updatedFeatures = [...features];
      const newOption: FeatureOption = {
        _key: `option-${Date.now()}`,
        label: 'Nowa opcja',
        value: `option-${Date.now()}`,
        basePriceModifier: 0,
        isAvailable: true,
      };

      updatedFeatures[featureIndex].options.push(newOption);
      patch.execute([{ set: { features: updatedFeatures } }]);
    },
    [features, patch]
  );

  // Remove feature
  const handleRemoveFeature = useCallback(
    (featureIndex: number) => {
      const updatedFeatures = features.filter(
        (_, index) => index !== featureIndex
      );
      patch.execute([{ set: { features: updatedFeatures } }]);
    },
    [features, patch]
  );

  // Update option
  const handleUpdateOption = useCallback(
    (
      featureIndex: number,
      optionIndex: number,
      field: keyof FeatureOption,
      value: any
    ) => {
      const updatedFeatures = [...features];
      updatedFeatures[featureIndex].options[optionIndex] = {
        ...updatedFeatures[featureIndex].options[optionIndex],
        [field]: value,
      };

      patch.execute([{ set: { features: updatedFeatures } }]);
    },
    [features, patch]
  );

  // Step 1: no cross-feature override handlers

  // Step 1: no cross-feature target helpers

  if (features.length === 0 && activeTab === 'table') {
    setActiveTab('manage');
  }

  return (
    <Container width={5}>
      <Stack space={6} paddingY={4}>
        <Stack space={3} paddingX={4}>
          <Heading size={3}>
            Menedżer cech: {productName || 'Nowy produkt'}
          </Heading>
          <Text muted>
            Zarządzaj cechami produktu i ich cenami w jednym miejscu.
          </Text>
        </Stack>

        {/* Tab Buttons */}
        <Flex gap={2} align="center" style={{ padding: '8px 18px' }}>
          <Button
            text="Zarządzanie cechami"
            tone={activeTab === 'manage' ? 'primary' : 'default'}
            mode={activeTab === 'manage' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('manage')}
          />
          <Button
            text="Przegląd cen"
            tone={activeTab === 'table' ? 'primary' : 'default'}
            mode={activeTab === 'table' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('table')}
            disabled={features.length === 0}
          />
          {/* Primary selector */}
          <Box style={{ maxWidth: 'fit-content' }}>
            <Select
              value={primaryFeatureKey || ''}
              onChange={(e) => {
                const key = e.currentTarget.value || undefined;
                if (key) {
                  // Clear any second options on the newly selected primary feature
                  let updatedFeatures = features.map((f) => {
                    if (f._key !== key) return f;
                    return {
                      ...f,
                      options: f.options.map((o) => ({
                        ...o,
                        secondOption: undefined,
                      })),
                    };
                  });

                  // Move the primary feature to the first position
                  const primaryFeatureIndex = updatedFeatures.findIndex(
                    (f) => f._key === key
                  );
                  if (primaryFeatureIndex > 0) {
                    const primaryFeature = updatedFeatures[primaryFeatureIndex];
                    // Remove from current position and add to the beginning
                    updatedFeatures.splice(primaryFeatureIndex, 1);
                    updatedFeatures.unshift(primaryFeature);
                  }

                  patch.execute([
                    {
                      set: {
                        primaryFeatureKey: key,
                        features: updatedFeatures,
                      },
                    },
                  ]);
                } else {
                  patch.execute([{ set: { primaryFeatureKey: key } }]);
                }
                setActivePrimaryOption('');
              }}
              fontSize={1}
              style={{ width: 'auto' }}>
              <option value="">Brak cechy głównej</option>
              {selectablePrimaryFeatures.map((f) => (
                <option key={f._key} value={f._key}>
                  {f.featureName}
                </option>
              ))}
            </Select>
          </Box>
        </Flex>

        <div>
          {activeTab === 'manage' && (
            <Stack space={4}>
              <Flex align="center" justify="space-between" paddingX={4}>
                <Heading size={2}>Zarządzanie cechami</Heading>
                <Button
                  text="Dodaj cechę"
                  tone="primary"
                  icon={AddIcon}
                  onClick={() => setShowAddFeatureDialog(true)}
                />
              </Flex>

              {features.length === 0 ? (
                <Card padding={4} tone="transparent">
                  <Stack space={3} style={{ textAlign: 'center' }}>
                    <CogIcon
                      style={{
                        fontSize: '2rem',
                        margin: '0 auto',
                        opacity: 0.3,
                      }}
                    />
                    <Text muted>
                      Brak cech produktu. Dodaj pierwszą cechę aby rozpocząć.
                    </Text>
                  </Stack>
                </Card>
              ) : (
                <Stack space={3}>
                  {features.map((feature, featureIndex) => (
                    <Card key={feature._key} padding={4} border>
                      <Stack space={3}>
                        <Flex align="center" justify="space-between">
                          <Text weight="semibold" size={2}>
                            {feature.featureName}
                          </Text>
                          <Flex gap={1}>
                            <Button
                              text="Dodaj opcję"
                              mode="ghost"
                              tone="primary"
                              icon={AddIcon}
                              onClick={() => handleAddOption(featureIndex)}
                            />
                            <MenuButton
                              id={`feature-menu-${featureIndex}`}
                              button={
                                <Button
                                  icon={EllipsisHorizontalIcon}
                                  mode="ghost"
                                />
                              }
                              menu={
                                <Menu>
                                  <MenuItem
                                    text="Usuń cechę"
                                    tone="critical"
                                    icon={TrashIcon}
                                    onClick={() =>
                                      handleRemoveFeature(featureIndex)
                                    }
                                  />
                                </Menu>
                              }
                            />
                          </Flex>
                        </Flex>

                        {/* If this is the primary feature, show option chips to scope overrides */}
                        {primaryFeatureKey === feature._key &&
                          feature.options.length > 0 && (
                            <Flex
                              gap={1}
                              wrap="wrap"
                              style={{ padding: '4px 0' }}>
                              {feature.options.map((opt, idx) => (
                                <Badge
                                  key={opt._key}
                                  tone={
                                    (activePrimaryOption ||
                                      feature.options[0]?.value) === opt.value
                                      ? 'primary'
                                      : 'default'
                                  }
                                  onClick={() =>
                                    setActivePrimaryOption(opt.value)
                                  }
                                  style={{ cursor: 'pointer' }}>
                                  {opt.label}
                                  {idx === 0 ? ' (domyślna)' : ''}
                                </Badge>
                              ))}
                            </Flex>
                          )}

                        {feature.options.length === 0 ? (
                          <Text muted size={1}>
                            Brak opcji. Dodaj pierwszą opcję.
                          </Text>
                        ) : (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}>
                            <SortableContext
                              items={feature.options.map(
                                (option, idx) =>
                                  option._key || `${featureIndex}-${idx}`
                              )}
                              strategy={verticalListSortingStrategy}>
                              <Grid columns={[1, 2, 3]} gap={2}>
                                {feature.options.map((option, optionIndex) => (
                                  <SortableOption
                                    key={option._key}
                                    option={option}
                                    optionIndex={optionIndex}
                                    featureIndex={featureIndex}
                                    feature={feature}
                                    dragOverInfo={dragOverInfo}>
                                    <Stack space={2}>
                                      <TextInput
                                        value={option.label}
                                        onChange={(e) =>
                                          handleUpdateOption(
                                            featureIndex,
                                            optionIndex,
                                            'label',
                                            e.currentTarget.value
                                          )
                                        }
                                        placeholder="Nazwa opcji"
                                        fontSize={1}
                                      />
                                      <TextInput
                                        value={option.basePriceModifier.toString()}
                                        onChange={(e) =>
                                          handleUpdateOption(
                                            featureIndex,
                                            optionIndex,
                                            'basePriceModifier',
                                            parseInt(e.currentTarget.value) || 0
                                          )
                                        }
                                        placeholder="Cena bazowa"
                                        fontSize={1}
                                      />
                                      <Flex
                                        justify="space-between"
                                        align="center">
                                        <Badge
                                          mode={
                                            option.isAvailable
                                              ? 'outline'
                                              : 'default'
                                          }
                                          tone={
                                            option.isAvailable
                                              ? 'positive'
                                              : 'critical'
                                          }>
                                          {option.isAvailable
                                            ? 'Dostępna'
                                            : 'Niedostępna'}
                                        </Badge>
                                        <Flex gap={1} align="center">
                                          {optionIndex === 0 && (
                                            <Badge
                                              tone="primary"
                                              marginRight={2}>
                                              Domyślna
                                            </Badge>
                                          )}
                                          <Button
                                            mode="ghost"
                                            tone="critical"
                                            icon={TrashIcon}
                                            title="Usuń opcję"
                                            onClick={() =>
                                              handleRemoveOption(
                                                featureIndex,
                                                optionIndex
                                              )
                                            }
                                            style={{
                                              minWidth: 'auto',
                                              cursor: 'pointer',
                                            }}
                                          />
                                        </Flex>
                                      </Flex>
                                      {/* Base override (normal option price) - SHOW THIS ONE but hide when numeric second option */}
                                      {primaryFeatureKey &&
                                        features[featureIndex]._key !==
                                          primaryFeatureKey &&
                                        activePrimaryOption &&
                                        activePrimaryOption !==
                                          defaultPrimaryValue &&
                                        !(
                                          option.secondOption?.enabled &&
                                          option.secondOption?.kind ===
                                            'numeric'
                                        ) && (
                                          <Box style={{ marginTop: 8 }}>
                                            <Flex align="center" gap={2}>
                                              <Text size={1} muted>
                                                Nadpisz cenę dla
                                                {(() => {
                                                  const pf = features.find(
                                                    (f) =>
                                                      f._key ===
                                                      primaryFeatureKey
                                                  );
                                                  const label =
                                                    pf?.options.find(
                                                      (o) =>
                                                        o.value ===
                                                        activePrimaryOption
                                                    )?.label;
                                                  return ` (${label || activePrimaryOption})`;
                                                })()}
                                              </Text>
                                              <Switch
                                                checked={(() => {
                                                  const pf = features.find(
                                                    (f) =>
                                                      f._key ===
                                                      primaryFeatureKey
                                                  );
                                                  const po = pf?.options.find(
                                                    (o) =>
                                                      o.value ===
                                                      activePrimaryOption
                                                  );
                                                  const ov =
                                                    po?.featureOverrides?.find(
                                                      (ov) =>
                                                        ov.targetFeature ===
                                                          features[featureIndex]
                                                            .featureName &&
                                                        ov.targetOption ===
                                                          option.value &&
                                                        ov.targetSecondChoice ===
                                                          undefined
                                                    );
                                                  return (
                                                    ov?.newPrice !== undefined
                                                  );
                                                })()}
                                                onChange={(e) => {
                                                  const updated = [...features];
                                                  const pfIdx =
                                                    updated.findIndex(
                                                      (f) =>
                                                        f._key ===
                                                        primaryFeatureKey
                                                    );
                                                  if (pfIdx < 0) return;
                                                  const pf = updated[pfIdx];
                                                  const poIdx =
                                                    pf.options.findIndex(
                                                      (o) =>
                                                        o.value ===
                                                        activePrimaryOption
                                                    );
                                                  if (poIdx < 0) return;
                                                  const po = pf.options[poIdx];
                                                  const overrides =
                                                    po.featureOverrides || [];
                                                  const idx =
                                                    overrides.findIndex(
                                                      (ov) =>
                                                        ov.targetFeature ===
                                                          updated[featureIndex]
                                                            .featureName &&
                                                        ov.targetOption ===
                                                          option.value &&
                                                        ov.targetSecondChoice ===
                                                          undefined
                                                    );
                                                  if (e.currentTarget.checked) {
                                                    const def =
                                                      option.basePriceModifier;
                                                    if (idx === -1) {
                                                      overrides.push({
                                                        targetFeature:
                                                          updated[featureIndex]
                                                            .featureName,
                                                        targetOption:
                                                          option.value,
                                                        newPrice: def,
                                                      });
                                                    }
                                                  } else if (idx >= 0) {
                                                    delete overrides[idx]
                                                      .newPrice;
                                                    if (
                                                      overrides[idx]
                                                        .newPrice ===
                                                        undefined &&
                                                      overrides[idx]
                                                        .newIncrementPrice ===
                                                        undefined
                                                    ) {
                                                      overrides.splice(idx, 1);
                                                    }
                                                  }
                                                  pf.options[
                                                    poIdx
                                                  ].featureOverrides =
                                                    overrides;
                                                  patch.execute([
                                                    {
                                                      set: {
                                                        features: updated,
                                                      },
                                                    },
                                                  ]);
                                                }}
                                              />
                                            </Flex>
                                            <TextInput
                                              disabled={(() => {
                                                const pf = features.find(
                                                  (f) =>
                                                    f._key === primaryFeatureKey
                                                );
                                                const po = pf?.options.find(
                                                  (o) =>
                                                    o.value ===
                                                    activePrimaryOption
                                                );
                                                const ov =
                                                  po?.featureOverrides?.find(
                                                    (ov) =>
                                                      ov.targetFeature ===
                                                        features[featureIndex]
                                                          .featureName &&
                                                      ov.targetOption ===
                                                        option.value &&
                                                      ov.targetSecondChoice ===
                                                        undefined
                                                  );
                                                return (
                                                  ov?.newPrice === undefined
                                                );
                                              })()}
                                              value={(() => {
                                                const pf = features.find(
                                                  (f) =>
                                                    f._key === primaryFeatureKey
                                                );
                                                const po = pf?.options.find(
                                                  (o) =>
                                                    o.value ===
                                                    activePrimaryOption
                                                );
                                                const ov =
                                                  po?.featureOverrides?.find(
                                                    (ov) =>
                                                      ov.targetFeature ===
                                                        features[featureIndex]
                                                          .featureName &&
                                                      ov.targetOption ===
                                                        option.value &&
                                                      ov.targetSecondChoice ===
                                                        undefined
                                                  );

                                                return (
                                                  ov?.newPrice ?? ''
                                                ).toString();
                                              })()}
                                              onChange={(e) => {
                                                const updated = [...features];
                                                const pfIdx = updated.findIndex(
                                                  (f) =>
                                                    f._key === primaryFeatureKey
                                                );
                                                if (pfIdx < 0) return;
                                                const pf = updated[pfIdx];
                                                const poIdx =
                                                  pf.options.findIndex(
                                                    (o) =>
                                                      o.value ===
                                                      activePrimaryOption
                                                  );
                                                if (poIdx < 0) return;
                                                const po = pf.options[poIdx];
                                                const overrides =
                                                  po.featureOverrides || [];
                                                const idx = overrides.findIndex(
                                                  (ov) =>
                                                    ov.targetFeature ===
                                                      updated[featureIndex]
                                                        .featureName &&
                                                    ov.targetOption ===
                                                      option.value &&
                                                    ov.targetSecondChoice ===
                                                      undefined
                                                );
                                                const next =
                                                  parseInt(
                                                    e.currentTarget.value
                                                  ) || 0;
                                                if (idx >= 0)
                                                  overrides[idx].newPrice =
                                                    next;
                                                pf.options[
                                                  poIdx
                                                ].featureOverrides = overrides;
                                                patch.execute([
                                                  {
                                                    set: { features: updated },
                                                  },
                                                ]);
                                              }}
                                              placeholder={
                                                'Nadpisz cenę dla tej opcji'
                                              }
                                              fontSize={1}
                                            />
                                          </Box>
                                        )}

                                      {/* Second Option editor - hidden for primary feature */}
                                      {features[featureIndex]._key !==
                                        primaryFeatureKey && (
                                        <Box style={{ marginTop: 8 }}>
                                          <Flex
                                            align="center"
                                            paddingBottom={2}
                                            gap={2}>
                                            <Text size={1} muted>
                                              Druga opcja (opcjonalnie)
                                            </Text>
                                            <Switch
                                              checked={Boolean(
                                                option.secondOption?.enabled
                                              )}
                                              onChange={(e) => {
                                                const updated = [...features];
                                                const opt =
                                                  updated[featureIndex].options[
                                                    optionIndex
                                                  ];
                                                opt.secondOption =
                                                  opt.secondOption || {};
                                                opt.secondOption.enabled =
                                                  e.currentTarget.checked;
                                                if (!opt.secondOption.enabled) {
                                                  // clear config when disabling
                                                  opt.secondOption.kind =
                                                    undefined;
                                                  opt.secondOption.numeric =
                                                    undefined as any;
                                                  opt.secondOption.choices =
                                                    undefined as any;
                                                }
                                                patch.execute([
                                                  {
                                                    set: { features: updated },
                                                  },
                                                ]);
                                              }}
                                            />
                                          </Flex>
                                          {option.secondOption?.enabled && (
                                            <Stack space={2}>
                                              <Select
                                                value={
                                                  option.secondOption?.kind ||
                                                  ''
                                                }
                                                onChange={(e) => {
                                                  const updated = [...features];
                                                  const opt =
                                                    updated[featureIndex]
                                                      .options[optionIndex];
                                                  opt.secondOption =
                                                    opt.secondOption || {};
                                                  opt.secondOption.kind = e
                                                    .currentTarget.value as any;
                                                  if (
                                                    opt.secondOption.kind ===
                                                    'numeric'
                                                  ) {
                                                    opt.secondOption.numeric =
                                                      opt.secondOption
                                                        .numeric || {
                                                        unit: 'm',
                                                        min: 0,
                                                        max: 10,
                                                        step: 0.5,
                                                        perUnitPrice: 0,
                                                      };
                                                    opt.secondOption.choices =
                                                      undefined as any;
                                                  } else if (
                                                    opt.secondOption.kind ===
                                                    'choice'
                                                  ) {
                                                    opt.secondOption.choices =
                                                      opt.secondOption
                                                        .choices || [];
                                                    opt.secondOption.numeric =
                                                      undefined as any;
                                                  }
                                                  patch.execute([
                                                    {
                                                      set: {
                                                        features: updated,
                                                      },
                                                    },
                                                  ]);
                                                }}
                                                fontSize={1}>
                                                <option value="">
                                                  Wybierz rodzaj...
                                                </option>
                                                <option value="numeric">
                                                  Inkrementalna (np. długość)
                                                </option>
                                                <option value="choice">
                                                  Wybór (lista opcji)
                                                </option>
                                              </Select>

                                              {/* Numeric editor */}
                                              {option.secondOption?.kind ===
                                                'numeric' && (
                                                <Stack space={2}>
                                                  <Text
                                                    size={1}
                                                    muted
                                                    style={{
                                                      marginBottom: '12px',
                                                      marginTop: '6px',
                                                    }}>
                                                    Pola definiują zakres i
                                                    sposób liczenia. Cena =
                                                    (wartość - Min)/Krok * Cena
                                                    za jednostkę.
                                                  </Text>
                                                  <Grid
                                                    columns={[1, 2, 2]}
                                                    gap={3}>
                                                    <Stack space={3}>
                                                      <Text
                                                        size={1}
                                                        weight="medium">
                                                        Etykieta pola
                                                      </Text>

                                                      <TextInput
                                                        placeholder="np. Długość"
                                                        value={(
                                                          (
                                                            option.secondOption
                                                              ?.numeric as any
                                                          )?.label ?? ''
                                                        ).toString()}
                                                        onChange={(e) => {
                                                          const updated = [
                                                            ...features,
                                                          ];
                                                          const opt =
                                                            updated[
                                                              featureIndex
                                                            ].options[
                                                              optionIndex
                                                            ];
                                                          (
                                                            opt.secondOption!
                                                              .numeric as any
                                                          ).label =
                                                            e.currentTarget.value;
                                                          patch.execute([
                                                            {
                                                              set: {
                                                                features:
                                                                  updated,
                                                              },
                                                            },
                                                          ]);
                                                        }}
                                                      />
                                                    </Stack>
                                                    <Stack space={3}>
                                                      <Text
                                                        size={1}
                                                        weight="medium">
                                                        Jednostka
                                                      </Text>

                                                      <TextInput
                                                        placeholder="np. m, cm, mm"
                                                        value={
                                                          option.secondOption
                                                            ?.numeric?.unit ||
                                                          ''
                                                        }
                                                        onChange={(e) => {
                                                          const updated = [
                                                            ...features,
                                                          ];
                                                          const opt =
                                                            updated[
                                                              featureIndex
                                                            ].options[
                                                              optionIndex
                                                            ];
                                                          opt.secondOption!.numeric!.unit =
                                                            e.currentTarget.value;
                                                          patch.execute([
                                                            {
                                                              set: {
                                                                features:
                                                                  updated,
                                                              },
                                                            },
                                                          ]);
                                                        }}
                                                      />
                                                    </Stack>
                                                    <Stack space={3}>
                                                      <Text
                                                        size={1}
                                                        weight="medium">
                                                        Wartość minimalna
                                                      </Text>

                                                      <TextInput
                                                        type="number"
                                                        placeholder="0"
                                                        value={(
                                                          option.secondOption
                                                            ?.numeric?.min ?? ''
                                                        ).toString()}
                                                        onChange={(e) => {
                                                          const updated = [
                                                            ...features,
                                                          ];
                                                          const opt =
                                                            updated[
                                                              featureIndex
                                                            ].options[
                                                              optionIndex
                                                            ];
                                                          const rawMin =
                                                            e.currentTarget
                                                              .value;
                                                          if (rawMin === '') {
                                                            delete opt
                                                              .secondOption!
                                                              .numeric!.min;
                                                          } else {
                                                            opt.secondOption!.numeric!.min =
                                                              parseFloat(
                                                                rawMin
                                                              );
                                                          }
                                                          patch.execute([
                                                            {
                                                              set: {
                                                                features:
                                                                  updated,
                                                              },
                                                            },
                                                          ]);
                                                        }}
                                                      />
                                                    </Stack>
                                                    <Stack space={3}>
                                                      <Text
                                                        size={1}
                                                        weight="medium">
                                                        Wartość maksymalna
                                                      </Text>

                                                      <TextInput
                                                        type="number"
                                                        placeholder="10"
                                                        value={(
                                                          option.secondOption
                                                            ?.numeric?.max ?? ''
                                                        ).toString()}
                                                        onChange={(e) => {
                                                          const updated = [
                                                            ...features,
                                                          ];
                                                          const opt =
                                                            updated[
                                                              featureIndex
                                                            ].options[
                                                              optionIndex
                                                            ];
                                                          const rawMax =
                                                            e.currentTarget
                                                              .value;
                                                          if (rawMax === '') {
                                                            delete opt
                                                              .secondOption!
                                                              .numeric!.max;
                                                          } else {
                                                            opt.secondOption!.numeric!.max =
                                                              parseFloat(
                                                                rawMax
                                                              );
                                                          }
                                                          patch.execute([
                                                            {
                                                              set: {
                                                                features:
                                                                  updated,
                                                              },
                                                            },
                                                          ]);
                                                        }}
                                                      />
                                                    </Stack>
                                                    <Stack space={3}>
                                                      <Text
                                                        size={1}
                                                        weight="medium">
                                                        Krok/Increment
                                                      </Text>

                                                      <TextInput
                                                        type="number"
                                                        placeholder="0.5"
                                                        value={(
                                                          option.secondOption
                                                            ?.numeric?.step ??
                                                          ''
                                                        ).toString()}
                                                        onChange={(e) => {
                                                          const updated = [
                                                            ...features,
                                                          ];
                                                          const opt =
                                                            updated[
                                                              featureIndex
                                                            ].options[
                                                              optionIndex
                                                            ];
                                                          const rawStep =
                                                            e.currentTarget
                                                              .value;
                                                          if (rawStep === '') {
                                                            delete opt
                                                              .secondOption!
                                                              .numeric!.step;
                                                          } else {
                                                            opt.secondOption!.numeric!.step =
                                                              parseFloat(
                                                                rawStep
                                                              );
                                                          }
                                                          patch.execute([
                                                            {
                                                              set: {
                                                                features:
                                                                  updated,
                                                              },
                                                            },
                                                          ]);
                                                        }}
                                                      />
                                                    </Stack>
                                                    <Stack space={3}>
                                                      <Text
                                                        size={1}
                                                        weight="medium">
                                                        Cena za jednostkę
                                                      </Text>

                                                      <TextInput
                                                        type="number"
                                                        placeholder="100"
                                                        value={(
                                                          option.secondOption
                                                            ?.numeric
                                                            ?.perUnitPrice ?? ''
                                                        ).toString()}
                                                        onChange={(e) => {
                                                          const updated = [
                                                            ...features,
                                                          ];
                                                          const opt =
                                                            updated[
                                                              featureIndex
                                                            ].options[
                                                              optionIndex
                                                            ];
                                                          const rawUnitPrice =
                                                            e.currentTarget
                                                              .value;
                                                          if (
                                                            rawUnitPrice === ''
                                                          ) {
                                                            delete opt
                                                              .secondOption!
                                                              .numeric!
                                                              .perUnitPrice;
                                                          } else {
                                                            opt.secondOption!.numeric!.perUnitPrice =
                                                              parseInt(
                                                                rawUnitPrice
                                                              ) || 0;
                                                          }
                                                          patch.execute([
                                                            {
                                                              set: {
                                                                features:
                                                                  updated,
                                                              },
                                                            },
                                                          ]);
                                                        }}
                                                      />
                                                    </Stack>
                                                  </Grid>

                                                  {/* Primary-scoped override for per-unit price (only when primary selected and non-default) */}
                                                  {primaryFeatureKey &&
                                                    features[featureIndex]
                                                      ._key !==
                                                      primaryFeatureKey &&
                                                    activePrimaryOption &&
                                                    activePrimaryOption !==
                                                      defaultPrimaryValue && (
                                                      <Box
                                                        style={{
                                                          marginTop: 8,
                                                        }}>
                                                        <Flex
                                                          align="center"
                                                          gap={2}>
                                                          <Text size={1} muted>
                                                            Nadpisz cenę za
                                                            jednostkę dla
                                                            {(() => {
                                                              const pf =
                                                                features.find(
                                                                  (f) =>
                                                                    f._key ===
                                                                    primaryFeatureKey
                                                                );
                                                              const label =
                                                                pf?.options.find(
                                                                  (o) =>
                                                                    o.value ===
                                                                    activePrimaryOption
                                                                )?.label;
                                                              return ` (${label || activePrimaryOption})`;
                                                            })()}
                                                          </Text>
                                                          <Switch
                                                            checked={(() => {
                                                              const pf =
                                                                features.find(
                                                                  (f) =>
                                                                    f._key ===
                                                                    primaryFeatureKey
                                                                );
                                                              const po =
                                                                pf?.options.find(
                                                                  (o) =>
                                                                    o.value ===
                                                                    activePrimaryOption
                                                                );
                                                              const override =
                                                                po?.featureOverrides?.find(
                                                                  (ov) =>
                                                                    ov.targetFeature ===
                                                                      features[
                                                                        featureIndex
                                                                      ]
                                                                        .featureName &&
                                                                    ov.targetOption ===
                                                                      option.value
                                                                );
                                                              return (
                                                                override?.newIncrementPrice !==
                                                                undefined
                                                              );
                                                            })()}
                                                            onChange={(e) => {
                                                              const updated = [
                                                                ...features,
                                                              ];
                                                              const pfIdx =
                                                                updated.findIndex(
                                                                  (f) =>
                                                                    f._key ===
                                                                    primaryFeatureKey
                                                                );
                                                              if (pfIdx < 0)
                                                                return;
                                                              const pf =
                                                                updated[pfIdx];
                                                              const poIdx =
                                                                pf.options.findIndex(
                                                                  (o) =>
                                                                    o.value ===
                                                                    activePrimaryOption
                                                                );
                                                              if (poIdx < 0)
                                                                return;
                                                              const po =
                                                                pf.options[
                                                                  poIdx
                                                                ];
                                                              const overrides =
                                                                po.featureOverrides ||
                                                                [];
                                                              const idx =
                                                                overrides.findIndex(
                                                                  (ov) =>
                                                                    ov.targetFeature ===
                                                                      updated[
                                                                        featureIndex
                                                                      ]
                                                                        .featureName &&
                                                                    ov.targetOption ===
                                                                      option.value
                                                                );

                                                              if (
                                                                e.currentTarget
                                                                  .checked
                                                              ) {
                                                                const defaultValue =
                                                                  option
                                                                    .secondOption
                                                                    ?.numeric
                                                                    ?.perUnitPrice ||
                                                                  0;
                                                                if (
                                                                  idx === -1
                                                                ) {
                                                                  const newOverride: FeatureOverride =
                                                                    {
                                                                      targetFeature:
                                                                        updated[
                                                                          featureIndex
                                                                        ]
                                                                          .featureName,
                                                                      targetOption:
                                                                        option.value,
                                                                    };
                                                                  newOverride.newIncrementPrice =
                                                                    defaultValue;
                                                                  overrides.push(
                                                                    newOverride
                                                                  );
                                                                } else {
                                                                  overrides[
                                                                    idx
                                                                  ].newIncrementPrice =
                                                                    defaultValue;
                                                                }
                                                              } else {
                                                                if (idx >= 0) {
                                                                  delete overrides[
                                                                    idx
                                                                  ]
                                                                    .newIncrementPrice;
                                                                  if (
                                                                    !overrides[
                                                                      idx
                                                                    ]
                                                                      .newPrice &&
                                                                    !overrides[
                                                                      idx
                                                                    ]
                                                                      .newIncrementPrice
                                                                  ) {
                                                                    overrides.splice(
                                                                      idx,
                                                                      1
                                                                    );
                                                                  }
                                                                }
                                                              }
                                                              pf.options[
                                                                poIdx
                                                              ].featureOverrides =
                                                                overrides;
                                                              patch.execute([
                                                                {
                                                                  set: {
                                                                    features:
                                                                      updated,
                                                                  },
                                                                },
                                                              ]);
                                                            }}
                                                          />
                                                        </Flex>
                                                        <TextInput
                                                          disabled={(() => {
                                                            const pf =
                                                              features.find(
                                                                (f) =>
                                                                  f._key ===
                                                                  primaryFeatureKey
                                                              );
                                                            const po =
                                                              pf?.options.find(
                                                                (o) =>
                                                                  o.value ===
                                                                  activePrimaryOption
                                                              );
                                                            const ov =
                                                              po?.featureOverrides?.find(
                                                                (ov) =>
                                                                  ov.targetFeature ===
                                                                    features[
                                                                      featureIndex
                                                                    ]
                                                                      .featureName &&
                                                                  ov.targetOption ===
                                                                    option.value
                                                              );
                                                            return (
                                                              ov?.newIncrementPrice ===
                                                              undefined
                                                            );
                                                          })()}
                                                          value={(() => {
                                                            const pf =
                                                              features.find(
                                                                (f) =>
                                                                  f._key ===
                                                                  primaryFeatureKey
                                                              );
                                                            const po =
                                                              pf?.options.find(
                                                                (o) =>
                                                                  o.value ===
                                                                  activePrimaryOption
                                                              );
                                                            const ov =
                                                              po?.featureOverrides?.find(
                                                                (ov) =>
                                                                  ov.targetFeature ===
                                                                    features[
                                                                      featureIndex
                                                                    ]
                                                                      .featureName &&
                                                                  ov.targetOption ===
                                                                    option.value
                                                              );
                                                            return (
                                                              (ov?.newIncrementPrice ??
                                                                '') as any
                                                            ).toString();
                                                          })()}
                                                          onChange={(e) => {
                                                            const updated = [
                                                              ...features,
                                                            ];
                                                            const pfIdx =
                                                              updated.findIndex(
                                                                (f) =>
                                                                  f._key ===
                                                                  primaryFeatureKey
                                                              );
                                                            if (pfIdx < 0)
                                                              return;
                                                            const pf =
                                                              updated[pfIdx];
                                                            const poIdx =
                                                              pf.options.findIndex(
                                                                (o) =>
                                                                  o.value ===
                                                                  activePrimaryOption
                                                              );
                                                            if (poIdx < 0)
                                                              return;
                                                            const po =
                                                              pf.options[poIdx];
                                                            const overrides =
                                                              po.featureOverrides ||
                                                              [];
                                                            const idx =
                                                              overrides.findIndex(
                                                                (ov) =>
                                                                  ov.targetFeature ===
                                                                    updated[
                                                                      featureIndex
                                                                    ]
                                                                      .featureName &&
                                                                  ov.targetOption ===
                                                                    option.value
                                                              );
                                                            const nextPrice =
                                                              parseInt(
                                                                e.currentTarget
                                                                  .value
                                                              ) || 0;
                                                            if (idx >= 0) {
                                                              overrides[
                                                                idx
                                                              ].newIncrementPrice =
                                                                nextPrice;
                                                            } else {
                                                              overrides.push({
                                                                targetFeature:
                                                                  updated[
                                                                    featureIndex
                                                                  ].featureName,
                                                                targetOption:
                                                                  option.value,
                                                                newIncrementPrice:
                                                                  nextPrice,
                                                              });
                                                            }
                                                            pf.options[
                                                              poIdx
                                                            ].featureOverrides =
                                                              overrides;
                                                            patch.execute([
                                                              {
                                                                set: {
                                                                  features:
                                                                    updated,
                                                                },
                                                              },
                                                            ]);
                                                          }}
                                                          placeholder={
                                                            'Nadpisz cenę za jednostkę'
                                                          }
                                                          fontSize={1}
                                                        />
                                                      </Box>
                                                    )}
                                                </Stack>
                                              )}

                                              {/* Choice editor */}
                                              {option.secondOption?.kind ===
                                                'choice' && (
                                                <Stack space={2}>
                                                  <Flex
                                                    align="center"
                                                    justify="space-between">
                                                    <Button
                                                      text="Dodaj podrzędną opcję"
                                                      mode="ghost"
                                                      onClick={() => {
                                                        const updated = [
                                                          ...features,
                                                        ];
                                                        const opt =
                                                          updated[featureIndex]
                                                            .options[
                                                            optionIndex
                                                          ];
                                                        opt.secondOption!.choices =
                                                          opt.secondOption!
                                                            .choices || [];
                                                        opt.secondOption!.choices!.push(
                                                          {
                                                            label: 'Opcja',
                                                            value: `second-${Date.now()}`,
                                                            price: 0,
                                                          }
                                                        );
                                                        patch.execute([
                                                          {
                                                            set: {
                                                              features: updated,
                                                            },
                                                          },
                                                        ]);
                                                      }}
                                                    />
                                                    <Flex
                                                      align="center"
                                                      gap={2}>
                                                      <Text size={1} muted>
                                                        Opcjonalne (można nie
                                                        wybrać żadnej)
                                                      </Text>
                                                      <Switch
                                                        checked={Boolean(
                                                          option.secondOption
                                                            ?.optional
                                                        )}
                                                        onChange={(e) => {
                                                          const updated = [
                                                            ...features,
                                                          ];
                                                          const opt =
                                                            updated[
                                                              featureIndex
                                                            ].options[
                                                              optionIndex
                                                            ];
                                                          opt.secondOption!.optional =
                                                            e.currentTarget.checked;
                                                          patch.execute([
                                                            {
                                                              set: {
                                                                features:
                                                                  updated,
                                                              },
                                                            },
                                                          ]);
                                                        }}
                                                      />
                                                    </Flex>
                                                  </Flex>
                                                  {option.secondOption?.choices
                                                    ?.length ? (
                                                    <Grid
                                                      columns={[1, 2]}
                                                      gap={2}>
                                                      {option.secondOption.choices.map(
                                                        (c, ci) => (
                                                          <Card
                                                            key={c.value}
                                                            padding={2}
                                                            tone="transparent"
                                                            border>
                                                            <Stack space={2}>
                                                              <Flex gap={2}>
                                                                <Box flex={1}>
                                                                  <TextInput
                                                                    value={
                                                                      c.label
                                                                    }
                                                                    onChange={(
                                                                      e
                                                                    ) => {
                                                                      const updated =
                                                                        [
                                                                          ...features,
                                                                        ];
                                                                      const opt =
                                                                        updated[
                                                                          featureIndex
                                                                        ]
                                                                          .options[
                                                                          optionIndex
                                                                        ];
                                                                      opt.secondOption!.choices![
                                                                        ci
                                                                      ].label =
                                                                        e.currentTarget.value;
                                                                      patch.execute(
                                                                        [
                                                                          {
                                                                            set: {
                                                                              features:
                                                                                updated,
                                                                            },
                                                                          },
                                                                        ]
                                                                      );
                                                                    }}
                                                                    placeholder="Nazwa"
                                                                  />
                                                                </Box>
                                                                <Button
                                                                  mode="ghost"
                                                                  tone="critical"
                                                                  text="Usuń"
                                                                  onClick={() => {
                                                                    const updated =
                                                                      [
                                                                        ...features,
                                                                      ];
                                                                    const opt =
                                                                      updated[
                                                                        featureIndex
                                                                      ].options[
                                                                        optionIndex
                                                                      ];
                                                                    opt.secondOption!.choices =
                                                                      opt.secondOption!.choices?.filter(
                                                                        (
                                                                          _,
                                                                          idx
                                                                        ) =>
                                                                          idx !==
                                                                          ci
                                                                      ) || [];
                                                                    patch.execute(
                                                                      [
                                                                        {
                                                                          set: {
                                                                            features:
                                                                              updated,
                                                                          },
                                                                        },
                                                                      ]
                                                                    );
                                                                  }}
                                                                />
                                                              </Flex>
                                                              <TextInput
                                                                value={
                                                                  c.price?.toString() ||
                                                                  ''
                                                                }
                                                                onChange={(
                                                                  e
                                                                ) => {
                                                                  const updated =
                                                                    [
                                                                      ...features,
                                                                    ];
                                                                  const opt =
                                                                    updated[
                                                                      featureIndex
                                                                    ].options[
                                                                      optionIndex
                                                                    ];
                                                                  opt.secondOption!.choices![
                                                                    ci
                                                                  ].price =
                                                                    parseInt(
                                                                      e
                                                                        .currentTarget
                                                                        .value
                                                                    ) || 0;
                                                                  patch.execute(
                                                                    [
                                                                      {
                                                                        set: {
                                                                          features:
                                                                            updated,
                                                                        },
                                                                      },
                                                                    ]
                                                                  );
                                                                }}
                                                                placeholder="Cena"
                                                              />

                                                              {/* Per-choice override (only when non-default primary) */}
                                                              {primaryFeatureKey &&
                                                                features[
                                                                  featureIndex
                                                                ]._key !==
                                                                  primaryFeatureKey &&
                                                                activePrimaryOption &&
                                                                activePrimaryOption !==
                                                                  defaultPrimaryValue && (
                                                                  <Stack
                                                                    space={1}>
                                                                    <Flex
                                                                      align="center"
                                                                      gap={2}>
                                                                      <Text
                                                                        size={1}
                                                                        muted>
                                                                        Nadpisz
                                                                        cenę dla
                                                                        wyboru
                                                                        {(() => {
                                                                          const pf =
                                                                            features.find(
                                                                              (
                                                                                f
                                                                              ) =>
                                                                                f._key ===
                                                                                primaryFeatureKey
                                                                            );
                                                                          const label =
                                                                            pf?.options.find(
                                                                              (
                                                                                o
                                                                              ) =>
                                                                                o.value ===
                                                                                activePrimaryOption
                                                                            )?.label;
                                                                          return ` (${label || activePrimaryOption})`;
                                                                        })()}
                                                                      </Text>
                                                                      <Switch
                                                                        checked={(() => {
                                                                          const pf =
                                                                            features.find(
                                                                              (
                                                                                f
                                                                              ) =>
                                                                                f._key ===
                                                                                primaryFeatureKey
                                                                            );
                                                                          const po =
                                                                            pf?.options.find(
                                                                              (
                                                                                o
                                                                              ) =>
                                                                                o.value ===
                                                                                activePrimaryOption
                                                                            );
                                                                          const override =
                                                                            po?.featureOverrides?.find(
                                                                              (
                                                                                ov
                                                                              ) =>
                                                                                ov.targetFeature ===
                                                                                  features[
                                                                                    featureIndex
                                                                                  ]
                                                                                    .featureName &&
                                                                                ov.targetOption ===
                                                                                  option.value &&
                                                                                ov.targetSecondChoice ===
                                                                                  c.value
                                                                            );
                                                                          return (
                                                                            override?.newPrice !==
                                                                            undefined
                                                                          );
                                                                        })()}
                                                                        onChange={(
                                                                          e
                                                                        ) => {
                                                                          const updated =
                                                                            [
                                                                              ...features,
                                                                            ];
                                                                          const pfIdx =
                                                                            updated.findIndex(
                                                                              (
                                                                                f
                                                                              ) =>
                                                                                f._key ===
                                                                                primaryFeatureKey
                                                                            );
                                                                          if (
                                                                            pfIdx <
                                                                            0
                                                                          )
                                                                            return;
                                                                          const pf =
                                                                            updated[
                                                                              pfIdx
                                                                            ];
                                                                          const poIdx =
                                                                            pf.options.findIndex(
                                                                              (
                                                                                o
                                                                              ) =>
                                                                                o.value ===
                                                                                activePrimaryOption
                                                                            );
                                                                          if (
                                                                            poIdx <
                                                                            0
                                                                          )
                                                                            return;
                                                                          const po =
                                                                            pf
                                                                              .options[
                                                                              poIdx
                                                                            ];
                                                                          const overrides =
                                                                            po.featureOverrides ||
                                                                            [];
                                                                          const idx =
                                                                            overrides.findIndex(
                                                                              (
                                                                                ov
                                                                              ) =>
                                                                                ov.targetFeature ===
                                                                                  updated[
                                                                                    featureIndex
                                                                                  ]
                                                                                    .featureName &&
                                                                                ov.targetOption ===
                                                                                  option.value &&
                                                                                ov.targetSecondChoice ===
                                                                                  c.value
                                                                            );
                                                                          if (
                                                                            e
                                                                              .currentTarget
                                                                              .checked
                                                                          ) {
                                                                            const defaultValue =
                                                                              c.price ||
                                                                              0;
                                                                            if (
                                                                              idx ===
                                                                              -1
                                                                            ) {
                                                                              overrides.push(
                                                                                {
                                                                                  targetFeature:
                                                                                    updated[
                                                                                      featureIndex
                                                                                    ]
                                                                                      .featureName,
                                                                                  targetOption:
                                                                                    option.value,
                                                                                  targetSecondChoice:
                                                                                    c.value,
                                                                                  newPrice:
                                                                                    defaultValue,
                                                                                }
                                                                              );
                                                                            }
                                                                          } else if (
                                                                            idx >=
                                                                            0
                                                                          ) {
                                                                            delete overrides[
                                                                              idx
                                                                            ]
                                                                              .newPrice;
                                                                            // Remove if empty
                                                                            if (
                                                                              overrides[
                                                                                idx
                                                                              ]
                                                                                .newPrice ===
                                                                                undefined &&
                                                                              overrides[
                                                                                idx
                                                                              ]
                                                                                .newIncrementPrice ===
                                                                                undefined
                                                                            ) {
                                                                              overrides.splice(
                                                                                idx,
                                                                                1
                                                                              );
                                                                            }
                                                                          }
                                                                          pf.options[
                                                                            poIdx
                                                                          ].featureOverrides =
                                                                            overrides;
                                                                          patch.execute(
                                                                            [
                                                                              {
                                                                                set: {
                                                                                  features:
                                                                                    updated,
                                                                                },
                                                                              },
                                                                            ]
                                                                          );
                                                                        }}
                                                                      />
                                                                    </Flex>
                                                                    <TextInput
                                                                      type="number"
                                                                      value={(() => {
                                                                        const pf =
                                                                          features.find(
                                                                            (
                                                                              f
                                                                            ) =>
                                                                              f._key ===
                                                                              primaryFeatureKey
                                                                          );
                                                                        const po =
                                                                          pf?.options.find(
                                                                            (
                                                                              o
                                                                            ) =>
                                                                              o.value ===
                                                                              activePrimaryOption
                                                                          );
                                                                        const ov =
                                                                          po?.featureOverrides?.find(
                                                                            (
                                                                              ov
                                                                            ) =>
                                                                              ov.targetFeature ===
                                                                                features[
                                                                                  featureIndex
                                                                                ]
                                                                                  .featureName &&
                                                                              ov.targetOption ===
                                                                                option.value &&
                                                                              ov.targetSecondChoice ===
                                                                                c.value
                                                                          );
                                                                        return (
                                                                          ov?.newPrice ??
                                                                          ''
                                                                        ).toString();
                                                                      })()}
                                                                      onChange={(
                                                                        e
                                                                      ) => {
                                                                        const updated =
                                                                          [
                                                                            ...features,
                                                                          ];
                                                                        const pfIdx =
                                                                          updated.findIndex(
                                                                            (
                                                                              f
                                                                            ) =>
                                                                              f._key ===
                                                                              primaryFeatureKey
                                                                          );
                                                                        if (
                                                                          pfIdx <
                                                                          0
                                                                        )
                                                                          return;
                                                                        const pf =
                                                                          updated[
                                                                            pfIdx
                                                                          ];
                                                                        const poIdx =
                                                                          pf.options.findIndex(
                                                                            (
                                                                              o
                                                                            ) =>
                                                                              o.value ===
                                                                              activePrimaryOption
                                                                          );
                                                                        if (
                                                                          poIdx <
                                                                          0
                                                                        )
                                                                          return;
                                                                        const po =
                                                                          pf
                                                                            .options[
                                                                            poIdx
                                                                          ];
                                                                        const overrides =
                                                                          po.featureOverrides ||
                                                                          [];
                                                                        const idx =
                                                                          overrides.findIndex(
                                                                            (
                                                                              ov
                                                                            ) =>
                                                                              ov.targetFeature ===
                                                                                updated[
                                                                                  featureIndex
                                                                                ]
                                                                                  .featureName &&
                                                                              ov.targetOption ===
                                                                                option.value &&
                                                                              ov.targetSecondChoice ===
                                                                                c.value
                                                                          );
                                                                        const next =
                                                                          parseInt(
                                                                            e
                                                                              .currentTarget
                                                                              .value
                                                                          ) ||
                                                                          0;
                                                                        if (
                                                                          idx >=
                                                                          0
                                                                        ) {
                                                                          overrides[
                                                                            idx
                                                                          ].newPrice =
                                                                            next;
                                                                        }
                                                                        pf.options[
                                                                          poIdx
                                                                        ].featureOverrides =
                                                                          overrides;
                                                                        patch.execute(
                                                                          [
                                                                            {
                                                                              set: {
                                                                                features:
                                                                                  updated,
                                                                              },
                                                                            },
                                                                          ]
                                                                        );
                                                                      }}
                                                                      placeholder={
                                                                        'Nadpisz cenę dla tej opcji'
                                                                      }
                                                                      fontSize={
                                                                        1
                                                                      }
                                                                    />
                                                                  </Stack>
                                                                )}
                                                            </Stack>
                                                          </Card>
                                                        )
                                                      )}
                                                    </Grid>
                                                  ) : (
                                                    <Text size={1} muted>
                                                      Brak podrzędnych opcji
                                                    </Text>
                                                  )}
                                                </Stack>
                                              )}
                                            </Stack>
                                          )}
                                        </Box>
                                      )}

                                      {/* Step 2: if a primary option is selected and this is not the primary feature, show override input for non-numeric options */}
                                      {primaryFeatureKey &&
                                        features[featureIndex]._key !==
                                          primaryFeatureKey &&
                                        activePrimaryOption &&
                                        activePrimaryOption !==
                                          defaultPrimaryValue && (
                                          <Box>
                                            {(() => {
                                              const hasNumericSecond = Boolean(
                                                option.secondOption?.enabled &&
                                                  option.secondOption?.kind ===
                                                    'numeric'
                                              );
                                              const hasChoiceSecond = Boolean(
                                                option.secondOption?.enabled &&
                                                  option.secondOption?.kind ===
                                                    'choice'
                                              );
                                              if (hasNumericSecond) return null; // handled inside numeric editor
                                              if (hasChoiceSecond) return null; // base override already shown above second option
                                              return null; // HIDE THIS BOTTOM INPUT - we want only the top one
                                            })()}
                                          </Box>
                                        )}
                                    </Stack>
                                  </SortableOption>
                                ))}
                              </Grid>
                            </SortableContext>
                            <DragOverlay>
                              {activeDragItem ? (
                                <Card
                                  padding={3}
                                  tone="transparent"
                                  border
                                  style={{
                                    opacity: 0.8,
                                    transform: 'rotate(5deg)',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                  }}>
                                  <Stack space={2}>
                                    <Text weight="medium">
                                      {activeDragItem.option.label}
                                    </Text>
                                    {activeDragItem.optionIndex === 0 && (
                                      <Badge tone="primary">Domyślna</Badge>
                                    )}
                                  </Stack>
                                </Card>
                              ) : null}
                            </DragOverlay>
                          </DndContext>
                        )}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          )}

          {activeTab === 'table' && (
            <PricingOverview
              features={features}
              primaryFeatureKey={primaryFeatureKey}
            />
          )}
        </div>

        {/* Add Feature Dialog */}
        {showAddFeatureDialog && (
          <Dialog
            header="Dodaj nową cechę"
            id="add-feature-dialog"
            onClose={() => setShowAddFeatureDialog(false)}
            footer={
              <Flex gap={2} justify="flex-end">
                <Button
                  text="Anuluj"
                  mode="ghost"
                  onClick={() => setShowAddFeatureDialog(false)}
                />
                <Button
                  text="Dodaj"
                  tone="primary"
                  onClick={handleAddFeature}
                  disabled={!newFeatureName.trim()}
                />
              </Flex>
            }>
            <Stack space={3} padding={4}>
              <Text>Wprowadź nazwę nowej cechy produktu:</Text>
              <TextInput
                value={newFeatureName}
                onChange={(e) => setNewFeatureName(e.currentTarget.value)}
                placeholder="np. Model, Długość, Kolor"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFeatureName.trim()) {
                    handleAddFeature();
                  }
                }}
                autoFocus
              />
            </Stack>
          </Dialog>
        )}

        {/* Reorder Confirmation Dialog */}
        {showReorderConfirmation && pendingReorder && (
          <Dialog
            header="Zmiana domyślnej opcji"
            id="reorder-confirmation-dialog"
            onClose={cancelReorder}
            footer={
              <Flex gap={2} justify="flex-end">
                <Button text="Anuluj" mode="ghost" onClick={cancelReorder} />
                <Button
                  text="Potwierdź i zaktualizuj ceny"
                  tone="primary"
                  onClick={confirmReorder}
                />
              </Flex>
            }>
            <Stack space={3} padding={4}>
              <Text>
                Zamierzasz zmienić domyślną opcję w cesze{' '}
                <strong>
                  {features[pendingReorder.featureIndex]?.featureName}
                </strong>
                .
              </Text>
              <Text>
                {pendingReorder.oldIndex === 0 ? (
                  <>
                    Przenosisz obecną opcję domyślną{' '}
                    <strong>
                      {
                        features[pendingReorder.featureIndex]?.options[
                          pendingReorder.oldIndex
                        ]?.label
                      }
                    </strong>{' '}
                    na pozycję {pendingReorder.newIndex + 1}. Nową opcją
                    domyślną zostanie{' '}
                    <strong>
                      {features[pendingReorder.featureIndex]?.options[1]?.label}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    <strong>
                      {
                        features[pendingReorder.featureIndex]?.options[
                          pendingReorder.oldIndex
                        ]?.label
                      }
                    </strong>{' '}
                    stanie się opcją niestandardową, a{' '}
                    <strong>
                      {
                        features[pendingReorder.featureIndex]?.options[
                          pendingReorder.newIndex
                        ]?.label
                      }
                    </strong>{' '}
                    będzie nową opcją domyślną.
                  </>
                )}
              </Text>
              <Text muted size={1}>
                ⚠️ To spowoduje automatyczne przełączenie cen bazowych i
                nadpisań dla wszystkich cech, aby zachować logiczne relacje
                cenowe.
              </Text>
            </Stack>
          </Dialog>
        )}

        {/* Remove Option Confirmation Dialog */}
        {showRemoveConfirmation && pendingRemoval && (
          <Dialog
            header="Usuwanie opcji"
            id="remove-option-confirmation-dialog"
            onClose={cancelRemoveOption}
            footer={
              <Flex gap={2} justify="flex-end">
                <Button
                  text="Anuluj"
                  mode="ghost"
                  onClick={cancelRemoveOption}
                />
                <Button
                  text="Usuń opcję"
                  tone="critical"
                  onClick={confirmRemoveOption}
                />
              </Flex>
            }>
            <Stack space={3} padding={4}>
              <Text>
                Czy na pewno chcesz usunąć opcję{' '}
                <strong>
                  {
                    features[pendingRemoval.featureIndex]?.options[
                      pendingRemoval.optionIndex
                    ]?.label
                  }
                </strong>{' '}
                z cechy{' '}
                <strong>
                  {features[pendingRemoval.featureIndex]?.featureName}
                </strong>
                ?
              </Text>

              {pendingRemoval.optionIndex === 0 && (
                <>
                  <Text weight="semibold" style={{ color: '#f59e0b' }}>
                    ⚠️ Uwaga: Usuwasz opcję domyślną!
                  </Text>
                  <Text>
                    Opcja{' '}
                    <strong>
                      {features[pendingRemoval.featureIndex]?.options[1]?.label}
                    </strong>{' '}
                    stanie się nową opcją domyślną.
                    {features[pendingRemoval.featureIndex]?._key ===
                      primaryFeatureKey && (
                      <>
                        {' '}
                        Ponieważ jest to cecha główna, zostanie automatycznie
                        przeprowadzona konwersja cen dla wszystkich pozostałych
                        cech.
                      </>
                    )}
                  </Text>
                </>
              )}

              <Text muted size={1}>
                Ta operacja usunie również wszystkie nadpisania cen związane z
                tą opcją.
              </Text>
            </Stack>
          </Dialog>
        )}

        {/* Step 1: override dialog removed */}
      </Stack>
    </Container>
  );
}
