// eslint-disable-next-line simple-import-sort/imports
import React, { useMemo, useState, useEffect } from 'react';
import {
  AddIcon,
  CogIcon,
  TrashIcon,
  ComposeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  DragHandleIcon,
} from '@sanity/icons';
import { Box, Button, Card, Container, Flex, Stack, Text } from '@sanity/ui';
import { arrayMove } from '@dnd-kit/sortable';
// import { CSS } from '@dnd-kit/utilities';
import { useDocumentOperation } from 'sanity';
import type {
  FeatureConfigV2,
  PrimaryVariantV2,
  ProductFeatureV2,
} from './types';
// Slimmer, inline-edit UI
import SlimFeatureCard from './SlimFeatureCard';
import VariantTypeDialog, {
  type VariantKindChoice,
} from './components/dialogs/VariantTypeDialog';
import InlineEditable from './InlineEditable';
import SortableList from './components/Sortable/SortableList';
import { CreatePrimaryDialog } from './components/dialogs/CreatePrimaryDialog';
import { AddPrimaryVariantDialog } from './components/dialogs/AddPrimaryVariantDialog';
import { AddSecondaryFeatureDialog } from './components/dialogs/AddSecondaryFeatureDialog';
import { AddSecondaryToVariantDialog } from './components/dialogs/AddSecondaryToVariantDialog';
import { ApplyTemplateDialog } from './components/dialogs/ApplyTemplateDialog';

// Per-variant secondary features use SortableList now

// Sortable wrapper for primary variants
// (Deprecated) SortablePrimaryVariant replaced by SortableList

interface FeaturesConfiguratorProps {
  document: {
    displayed: {
      _id?: string;
      name?: string;
      featureConfig?: FeatureConfigV2;
    };
  };
}

export function FeaturesConfigurator(props: FeaturesConfiguratorProps) {
  const rawDocumentId = props.document.displayed._id || '';
  const documentId = rawDocumentId.replace(/^drafts\./, '');
  const { patch } = useDocumentOperation(documentId, 'product');

  const featureConfig = useMemo<FeatureConfigV2>(() => {
    return props.document.displayed.featureConfig || {};
  }, [props.document.displayed.featureConfig]);

  const hasPrimary = Boolean(featureConfig.primary);
  const productName = props.document.displayed.name || 'Nowy produkt';
  // DnD sensors are configured within SortableList for migrated lists

  // Dialog state for creating primary feature
  const [showCreatePrimary, setShowCreatePrimary] = useState(false);
  // Dialog state for adding primary variant
  const [showAddPrimaryVariant, setShowAddPrimaryVariant] = useState(false);
  // Dialog state for adding secondary feature to primary variant
  const [showAddSecondaryToVariant, setShowAddSecondaryToVariant] =
    useState(false);
  const [pendingVariantIndex, setPendingVariantIndex] = useState<number | null>(
    null
  );
  // Dialog state for applying template
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false);
  const [templateVariantIndex, setTemplateVariantIndex] = useState<
    number | null
  >(null);
  // Add secondary feature (Scenario 1) dialog state
  const [showAddSecondaryDialog, setShowAddSecondaryDialog] = useState(false);
  const [pendingAddContainer, setPendingAddContainer] = useState<
    { type: 'root' } | { type: 'variant'; index: number } | null
  >(null);
  // Add variant dialog state (reused for slim cards)
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [variantFeatureIndex, setVariantFeatureIndex] = useState<number | null>(
    null
  );
  // Toggle state for primary variants (all start open by default)
  const [openVariants, setOpenVariants] = useState<Set<string>>(new Set());
  // Toggle state for variant menu (show/hide additional actions)
  const [openVariantMenu, setOpenVariantMenu] = useState<string | null>(null);
  // Template system for bulk duplicating secondary features
  // Per-variant DnD managed by SortableList

  // Sensors handled by SortableList

  // Helper function to toggle variant open/closed state
  const toggleVariant = (variantKey: string) => {
    const newOpenVariants = new Set(openVariants);
    if (newOpenVariants.has(variantKey)) {
      newOpenVariants.delete(variantKey);
    } else {
      newOpenVariants.add(variantKey);
    }
    setOpenVariants(newOpenVariants);
  };

  // Helper function to toggle variant menu
  const toggleVariantMenu = (variantKey: string) => {
    setOpenVariantMenu(openVariantMenu === variantKey ? null : variantKey);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openVariantMenu) {
        setOpenVariantMenu(null);
      }
    };

    if (openVariantMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openVariantMenu]);

  // Template system functions
  const selectTemplateVariant = (variantIndex: number) => {
    setTemplateVariantIndex(variantIndex);
    setShowApplyTemplateDialog(true);
  };

  const applyTemplateToAllVariants = () => {
    if (templateVariantIndex === null || !featureConfig.primary?.variants)
      return;

    const templateVariant =
      featureConfig.primary.variants[templateVariantIndex];
    if (!templateVariant?.secondaryFeatures) return;

    const updatedVariants = featureConfig.primary.variants.map(
      (variant, index) => {
        if (index === templateVariantIndex) return variant; // Keep template as-is

        // Copy secondary features from template to this variant
        return {
          ...variant,
          secondaryFeatures: templateVariant.secondaryFeatures.map(
            (feature) => ({
              ...feature,
              _key: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // New key
            })
          ),
        };
      }
    );

    setFeatureConfig({
      ...featureConfig,
      primary: {
        name: featureConfig.primary?.name || '',
        variants: updatedVariants,
      },
    });

    // Close dialog and reset template selection
    setShowApplyTemplateDialog(false);
    setTemplateVariantIndex(null);
  };

  const closeApplyTemplateDialog = () => {
    setShowApplyTemplateDialog(false);
    setTemplateVariantIndex(null);
  };

  // Global add variant function for secondary features within primary variants
  const addVariantGlobally = (
    kind: VariantKindChoice,
    name: string,
    featureName: string,
    currentVariantIndex: number
  ) => {
    const baseOption = {
      _key: `opt-${Date.now()}`,
      label: name,
      value: name.toLowerCase().replace(/\s+/g, '-'),
      basePriceModifier: 0,
      isAvailable: true,
    };

    let option: any;
    if (kind === 'text') {
      option = baseOption;
    } else if (kind === 'increment') {
      option = {
        ...baseOption,
        basePriceModifier: 0,
        secondOption: {
          enabled: true,
          kind: 'numeric',
          numeric: {
            label: `Wprowadź ${name.toLowerCase()}`,
            unit: 'szt',
            min: 1,
            max: 10,
            step: 1,
            perUnitPrice: 0,
          },
        },
      };
    } else {
      option = {
        ...baseOption,
        secondOption: {
          enabled: true,
          kind: 'choice',
          choices: [],
          optional: false,
        },
      };
    }

    const variants = [...(featureConfig.primary?.variants || [])];

    variants.forEach((variant, index) => {
      const hasFeature = variant.secondaryFeatures?.some(
        (feature) => feature.featureName === featureName
      );

      if (hasFeature) {
        // Variant already has the feature, add the variant to it (if not already present)
        const featureIndex = variant.secondaryFeatures.findIndex(
          (feature) => feature.featureName === featureName
        );
        const existingFeature = variant.secondaryFeatures[featureIndex];
        const hasVariant = existingFeature.options?.some(
          (opt) => opt.label === name
        );

        if (!hasVariant) {
          const featureForVariant = {
            ...existingFeature,
            options: [...(existingFeature.options || []), option],
          };
          variant.secondaryFeatures[featureIndex] = featureForVariant;
        }
      } else {
        // Variant doesn't have the feature, add both the feature and the variant
        const newFeature = {
          _key: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          featureName: featureName,
          options: [option],
        };
        variant.secondaryFeatures = [
          ...(variant.secondaryFeatures || []),
          newFeature,
        ];
      }
    });

    setFeatureConfig({
      ...featureConfig,
      primary: { name: featureConfig.primary?.name || '', variants },
    });
  };

  // Initialize all variants as open by default
  useEffect(() => {
    if (featureConfig.primary?.variants) {
      const newOpenVariants = new Set<string>();
      featureConfig.primary.variants.forEach((pv, pvi) => {
        const variantKey = pv._key || `pv-${pvi}`;
        newOpenVariants.add(variantKey);
      });
      setOpenVariants(newOpenVariants);
    }
  }, [featureConfig.primary?.variants]);

  const setFeatureConfig = (next: FeatureConfigV2) => {
    patch.execute([{ set: { featureConfig: next } }]);
  };

  // Drag & Drop for secondary features (Scenario 1 list only for now)
  // Root secondary list uses SortableList now

  // Root DnD state removed
  // Primary variants DnD managed by SortableList now

  // Root secondary list reordering handled by SortableList

  // Primary variants DnD handled by SortableList

  const addSecondaryFeature = (
    container: { type: 'root' } | { type: 'variant'; index: number },
    featureName: string
  ) => {
    const newFeature: ProductFeatureV2 = {
      _key: `feature-${Date.now()}`,
      featureName: featureName.trim() || 'Nowa cecha',
      options: [],
    };
    if (container.type === 'root') {
      const next: FeatureConfigV2 = {
        ...featureConfig,
        secondaryFeatures: [
          ...(featureConfig.secondaryFeatures || []),
          newFeature,
        ],
      };
      setFeatureConfig(next);
    } else {
      const variants = [...(featureConfig.primary?.variants || [])];
      variants[container.index] = {
        ...variants[container.index],
        secondaryFeatures: [
          ...(variants[container.index].secondaryFeatures || []),
          newFeature,
        ],
      };
      setFeatureConfig({
        ...featureConfig,
        primary: { name: featureConfig.primary?.name || '', variants },
      });
    }
  };

  const openAddSecondaryDialog = (
    container: { type: 'root' } | { type: 'variant'; index: number }
  ) => {
    setPendingAddContainer(container);
    setShowAddSecondaryDialog(true);
  };

  const confirmAddSecondary = (name: string) => {
    if (!pendingAddContainer || !name.trim()) return;
    addSecondaryFeature(pendingAddContainer, name);
    setShowAddSecondaryDialog(false);
    setPendingAddContainer(null);
  };

  // Variant helpers

  const openAddVariantForRoot = (featureIndex: number) => {
    setVariantFeatureIndex(featureIndex);
    setPendingAddContainer({ type: 'root' });
    setShowVariantDialog(true);
  };

  const openAddVariantForVariant = (
    variantIndex: number,
    featureIndex: number
  ) => {
    setVariantFeatureIndex(featureIndex);
    setPendingAddContainer({ type: 'variant', index: variantIndex });
    setShowVariantDialog(true);
  };

  const confirmAddVariant = (
    kind: VariantKindChoice,
    name: string,
    addGlobally: boolean
  ) => {
    if (variantFeatureIndex === null || !pendingAddContainer) return;

    // Create option with custom name instead of default
    const baseOption = {
      _key: `opt-${Date.now()}`,
      label: name,
      value: name.toLowerCase().replace(/\s+/g, '-'),
      basePriceModifier: 0,
      isAvailable: true,
    };

    let option: any;
    if (kind === 'text') {
      option = baseOption;
    } else if (kind === 'increment') {
      option = {
        ...baseOption,
        basePriceModifier: 0,
        secondOption: {
          enabled: true,
          kind: 'numeric',
          numeric: {
            label: `Wprowadź ${name.toLowerCase()}`,
            unit: 'szt',
            min: 1,
            max: 10,
            step: 1,
            perUnitPrice: 0,
          },
        },
      };
    } else {
      option = {
        ...baseOption,
        secondOption: {
          enabled: true,
          kind: 'choice',
          choices: [],
          optional: false,
        },
      };
    }

    if (pendingAddContainer.type === 'root') {
      const list = [...(featureConfig.secondaryFeatures || [])];
      const f = list[variantFeatureIndex];
      const options = [...(f.options || []), option];
      list[variantFeatureIndex] = { ...f, options };
      setFeatureConfig({ ...featureConfig, secondaryFeatures: list });
    } else {
      // Handle global addition for primary variants
      const variants = [...(featureConfig.primary?.variants || [])];

      if (addGlobally) {
        // Add to all variants that don't already have this feature or this specific variant
        const featureNameToCheck =
          featureConfig.primary!.variants[pendingAddContainer.index]
            .secondaryFeatures[variantFeatureIndex].featureName;

        variants.forEach((variant, index) => {
          const hasFeature = variant.secondaryFeatures?.some(
            (feature) => feature.featureName === featureNameToCheck
          );

          if (hasFeature) {
            // Variant already has the feature, add the variant to it (if not already present)
            const featureIndex = variant.secondaryFeatures.findIndex(
              (feature) => feature.featureName === featureNameToCheck
            );
            const existingFeature = variant.secondaryFeatures[featureIndex];
            const hasVariant = existingFeature.options?.some(
              (opt) => opt.label === name
            );

            if (!hasVariant) {
              const updatedFeature = {
                ...existingFeature,
                options: [...(existingFeature.options || []), option],
              };
              variant.secondaryFeatures[featureIndex] = updatedFeature;
            }
          } else {
            // Variant doesn't have the feature, add both the feature and the variant
            const newFeature = {
              _key: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              featureName: featureNameToCheck,
              options: [option],
            };
            variant.secondaryFeatures = [
              ...(variant.secondaryFeatures || []),
              newFeature,
            ];
          }
        });
      } else {
        // Normal addition to specific variant
        const fList = [
          ...(variants[pendingAddContainer.index].secondaryFeatures || []),
        ];
        const f = fList[variantFeatureIndex];
        const options = [...(f.options || []), option];
        fList[variantFeatureIndex] = { ...f, options };
        variants[pendingAddContainer.index] = {
          ...variants[pendingAddContainer.index],
          secondaryFeatures: fList,
        };
      }

      setFeatureConfig({
        ...featureConfig,
        primary: { name: featureConfig.primary?.name || '', variants },
      });
    }

    setShowVariantDialog(false);
    setVariantFeatureIndex(null);
    setPendingAddContainer(null);
  };

  const updateSecondaryFeature = (
    container: { type: 'root' } | { type: 'variant'; index: number },
    featureIndex: number,
    next: ProductFeatureV2
  ) => {
    if (container.type === 'root') {
      const list = [...(featureConfig.secondaryFeatures || [])];
      list[featureIndex] = next;
      setFeatureConfig({ ...featureConfig, secondaryFeatures: list });
    } else {
      const variants = [...(featureConfig.primary?.variants || [])];
      const list = [...(variants[container.index].secondaryFeatures || [])];
      list[featureIndex] = next;
      variants[container.index] = {
        ...variants[container.index],
        secondaryFeatures: list,
      };
      setFeatureConfig({
        ...featureConfig,
        primary: { name: featureConfig.primary?.name || '', variants },
      });
    }
  };

  const removeSecondaryFeature = (
    container: { type: 'root' } | { type: 'variant'; index: number },
    featureIndex: number
  ) => {
    if (container.type === 'root') {
      const list = (featureConfig.secondaryFeatures || []).filter(
        (_, i) => i !== featureIndex
      );
      setFeatureConfig({ ...featureConfig, secondaryFeatures: list });
    } else {
      const variants = [...(featureConfig.primary?.variants || [])];
      const list = (variants[container.index].secondaryFeatures || []).filter(
        (_, i) => i !== featureIndex
      );
      variants[container.index] = {
        ...variants[container.index],
        secondaryFeatures: list,
      };
      setFeatureConfig({
        ...featureConfig,
        primary: { name: featureConfig.primary?.name || '', variants },
      });
    }
  };

  const confirmAddPrimaryVariant = (name: string, price: number) => {
    if (!name.trim()) return;

    const variants = [...(featureConfig.primary?.variants || [])];
    const newVariant: PrimaryVariantV2 = {
      _key: `pv-${Date.now()}`,
      label: name.trim(),
      value: `pv-${Date.now()}`,
      basePrice: price,
      secondaryFeatures: [],
    };
    variants.push(newVariant);
    setFeatureConfig({
      ...featureConfig,
      primary: { name: featureConfig.primary?.name || '', variants },
    });
    setShowAddPrimaryVariant(false);
  };

  const openAddSecondaryToVariantDialog = (variantIndex: number) => {
    setPendingVariantIndex(variantIndex);
    setShowAddSecondaryToVariant(true);
  };

  const confirmAddSecondaryToVariant = (name: string, addGlobally: boolean) => {
    if (!name.trim() || pendingVariantIndex === null) return;

    const featureNameToCheck = name.trim();
    const newFeature: ProductFeatureV2 = {
      _key: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      featureName: featureNameToCheck || 'Nowa cecha',
      options: [],
    };

    // Start with current variants
    const variants = [...(featureConfig.primary?.variants || [])];

    // Always add to the current variant
    variants[pendingVariantIndex] = {
      ...variants[pendingVariantIndex],
      secondaryFeatures: [
        ...(variants[pendingVariantIndex].secondaryFeatures || []),
        newFeature,
      ],
    };

    // If addGlobally is true, add to other variants that don't have this feature
    if (addGlobally) {
      variants.forEach((variant, index) => {
        // Skip the current variant (already added above)
        if (index === pendingVariantIndex) return;

        const hasFeature = variant.secondaryFeatures?.some(
          (feature) => feature.featureName === featureNameToCheck
        );

        if (!hasFeature) {
          // Create a new feature with unique key for this variant
          const featureForVariant: ProductFeatureV2 = {
            _key: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            featureName: featureNameToCheck,
            options: [],
          };

          variants[index] = {
            ...variants[index],
            secondaryFeatures: [
              ...(variants[index].secondaryFeatures || []),
              featureForVariant,
            ],
          };
        }
      });
    }

    // Single state update with all changes
    setFeatureConfig({
      ...featureConfig,
      primary: { name: featureConfig.primary?.name || '', variants },
    });

    setShowAddSecondaryToVariant(false);
    setPendingVariantIndex(null);
  };

  // Function to reorder secondary features within a primary variant
  const reorderSecondaryFeatures = (
    variantIndex: number,
    oldIndex: number,
    newIndex: number
  ) => {
    if (!featureConfig.primary?.variants) return;

    const variant = featureConfig.primary.variants[variantIndex];
    if (!variant?.secondaryFeatures) return;

    const reorderedFeatures = arrayMove(
      variant.secondaryFeatures,
      oldIndex,
      newIndex
    );

    const updatedVariants = [...featureConfig.primary.variants];
    updatedVariants[variantIndex] = {
      ...variant,
      secondaryFeatures: reorderedFeatures,
    };

    setFeatureConfig({
      ...featureConfig,
      primary: {
        name: featureConfig.primary.name,
        variants: updatedVariants,
      },
    });
  };

  const updatePrimaryVariantName = (index: number, newName: string) => {
    const variants = [...(featureConfig.primary?.variants || [])];
    variants[index] = { ...variants[index], label: newName };
    setFeatureConfig({
      ...featureConfig,
      primary: { name: featureConfig.primary?.name || '', variants },
    });
  };

  const updatePrimaryVariantPrice = (index: number, newPrice: number) => {
    const variants = [...(featureConfig.primary?.variants || [])];
    variants[index] = { ...variants[index], basePrice: newPrice };
    setFeatureConfig({
      ...featureConfig,
      primary: { name: featureConfig.primary?.name || '', variants },
    });
  };

  const removePrimaryVariant = (index: number) => {
    const variants = (featureConfig.primary?.variants || []).filter(
      (_, i) => i !== index
    );
    setFeatureConfig({
      ...featureConfig,
      primary: { name: featureConfig.primary?.name || '', variants },
    });
  };

  const createPrimary = (name: string) => {
    const next: FeatureConfigV2 = {
      ...featureConfig,
      primary: { name, variants: [] },
    };
    setFeatureConfig(next);
    setShowCreatePrimary(false);
  };

  return (
    <Container width={5}>
      <Stack space={3} paddingY={4}>
        <Stack space={3} paddingX={4}>
          <Text size={3} weight="semibold">
            Konfigurator cech: {productName}
          </Text>
          <Text muted style={{ marginBottom: 12 }}>
            Połączony widok konfiguratora (v2).
          </Text>
        </Stack>

        <Flex gap={2} align="center" style={{ padding: '4px 18px' }}>
          {!hasPrimary && (
            <Button
              text="Dodaj główną cechę"
              tone="primary"
              icon={AddIcon}
              onClick={() => setShowCreatePrimary(true)}
              style={{ cursor: 'pointer' }}
            />
          )}
          {hasPrimary && (
            <Button
              text="Usuń główną cechę"
              tone="critical"
              mode="ghost"
              icon={TrashIcon}
              onClick={() =>
                setFeatureConfig({ ...featureConfig, primary: undefined })
              }
              style={{ cursor: 'pointer' }}
            />
          )}
        </Flex>

        {/* Scenario 1: No primary feature */}
        {!hasPrimary && (
          <Card padding={3} style={{ overflow: 'hidden' }}>
            <Stack space={2}>
              <Flex align="center" justify="space-between">
                <Text size={3} weight="medium">
                  Wszystkie cechy produktu
                </Text>
                <Button
                  text="Dodaj cechę"
                  tone="primary"
                  icon={AddIcon}
                  onClick={() => openAddSecondaryDialog({ type: 'root' })}
                  style={{ cursor: 'pointer' }}
                />
              </Flex>
              {(featureConfig.secondaryFeatures || []).length === 0 ? (
                <Card padding={3} tone="transparent">
                  <Stack space={3} style={{ textAlign: 'center' }}>
                    <CogIcon
                      style={{
                        fontSize: '2rem',
                        margin: '0 auto',
                        opacity: 0.3,
                      }}
                    />
                    <Text muted>Brak cech. Dodaj pierwszą cechę.</Text>
                  </Stack>
                </Card>
              ) : (
                <SortableList
                  items={featureConfig.secondaryFeatures || []}
                  getId={(f, i) => f._key || `f-${i}`}
                  getLabel={(f) => f.featureName}
                  staticDuringDrag
                  onReorder={(oldIndex, newIndex) => {
                    const list = featureConfig.secondaryFeatures || [];
                    const reordered = arrayMove(list, oldIndex, newIndex);
                    setFeatureConfig({
                      ...featureConfig,
                      secondaryFeatures: reordered,
                    });
                  }}
                  renderItem={({ item: f, index: fi, handleProps }) => (
                    <div>
                      <SlimFeatureCard
                        feature={f}
                        onChange={(next) =>
                          updateSecondaryFeature({ type: 'root' }, fi, next)
                        }
                        onRemove={() =>
                          removeSecondaryFeature({ type: 'root' }, fi)
                        }
                        onAddVariant={() => openAddVariantForRoot(fi)}
                        dragHandleProps={handleProps}
                        showGlobalOption={
                          (featureConfig.primary?.variants || []).length > 1
                        }
                      />
                    </div>
                  )}
                />
              )}
            </Stack>
          </Card>
        )}

        {/* Scenario 2: With primary feature */}
        {hasPrimary && (
          <Stack space={3}>
            <Card padding={4}>
              <Stack space={2}>
                <Flex align="center" justify="space-between">
                  <div>
                    <Text size={2} muted style={{ marginBottom: 4 }}>
                      Nazwa głównej cechy
                    </Text>
                    <InlineEditable
                      value={featureConfig.primary?.name || ''}
                      onChange={(val) => {
                        setFeatureConfig({
                          ...featureConfig,
                          primary: {
                            name: val,
                            variants: featureConfig.primary?.variants || [],
                          },
                        });
                      }}
                      placeholder="Nazwa głównej cechy"
                      fontSize={4}
                    />
                  </div>
                  <Button
                    text="Dodaj wariant główny"
                    tone="primary"
                    icon={AddIcon}
                    onClick={() => setShowAddPrimaryVariant(true)}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                  />
                </Flex>
              </Stack>
            </Card>

            {(featureConfig.primary?.variants || []).length === 0 ? (
              <Card padding={4} tone="transparent">
                <Stack space={3} style={{ textAlign: 'center' }}>
                  <CogIcon
                    style={{ fontSize: '2rem', margin: '0 auto', opacity: 0.3 }}
                  />
                  <Text muted>
                    Brak wariantów. Dodaj pierwszy wariant głównej cechy.
                  </Text>
                </Stack>
              </Card>
            ) : (
              <Stack space={4} paddingX={4}>
                <SortableList
                  items={featureConfig.primary?.variants || []}
                  getId={(pv, i) => pv._key || `pv-${i}`}
                  getLabel={(pv) => pv.label}
                  staticDuringDrag
                  onReorder={(oldIndex, newIndex) => {
                    const variants = featureConfig.primary?.variants || [];
                    const reordered = arrayMove(variants, oldIndex, newIndex);
                    setFeatureConfig({
                      ...featureConfig,
                      primary: {
                        name: featureConfig.primary?.name || '',
                        variants: reordered,
                      },
                    });
                  }}
                  renderItem={({ item: pv, index: pvi, handleProps }) => (
                    <Card
                      tone="default"
                      padding={4}
                      border
                      style={{ borderRadius: 8 }}>
                      <Stack space={3}>
                        <Flex align="center" justify="space-between">
                          <Flex align="center" gap={2}>
                            <Button
                              icon={
                                openVariants.has(pv._key || `pv-${pvi}`) ? (
                                  <ChevronDownIcon />
                                ) : (
                                  <ChevronRightIcon />
                                )
                              }
                              mode="ghost"
                              tone="primary"
                              onClick={() =>
                                toggleVariant(pv._key || `pv-${pvi}`)
                              }
                              style={{
                                cursor: 'pointer',
                                minWidth: 'auto',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                transition: 'all 200ms ease',
                              }}
                              aria-label={
                                openVariants.has(pv._key || `pv-${pvi}`)
                                  ? 'Zwiń wariant'
                                  : 'Rozwiń wariant'
                              }
                            />
                            <Button
                              icon={<DragHandleIcon />}
                              mode="bleed"
                              tone="default"
                              {...handleProps.attributes}
                              {...handleProps.listeners}
                              style={{ cursor: 'grab', minWidth: 'auto' }}
                              title="Przeciągnij, aby zmienić kolejność wariantów"
                            />
                            <InlineEditable
                              value={pv.label}
                              onChange={(val) =>
                                updatePrimaryVariantName(pvi, val)
                              }
                              placeholder="Nazwa wariantu"
                              fontSize={3}
                            />
                          </Flex>
                          <Flex
                            align="center"
                            gap={2}
                            style={{ position: 'relative' }}>
                            <Box
                              style={{
                                backgroundColor: 'var(--card-bg-color)',
                                border: '1px solid var(--card-border-color)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}>
                              <InlineEditable
                                value={pv.basePrice || 0}
                                onChange={(val) =>
                                  updatePrimaryVariantPrice(pvi, Number(val))
                                }
                                type="number"
                                suffix="zł"
                                placeholder="0"
                                width={70}
                                align="right"
                                fontSize={2}
                              />
                            </Box>
                            <Button
                              text="Dodaj cechę"
                              mode="ghost"
                              tone="positive"
                              icon={ComposeIcon}
                              onClick={() =>
                                openAddSecondaryToVariantDialog(pvi)
                              }
                              style={{
                                cursor: 'pointer',
                                flexShrink: 0,
                                borderColor: '#10b981',
                                color: '#059669',
                              }}
                            />
                            <Button
                              text="⋯"
                              mode="ghost"
                              tone="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleVariantMenu(pv._key || `pv-${pvi}`);
                              }}
                              style={{
                                cursor: 'pointer',
                                flexShrink: 0,
                                fontSize: '16px',
                                minWidth: 'auto',
                              }}
                              title="Więcej opcji"
                            />
                            {/* Variant Menu */}
                            {openVariantMenu === (pv._key || `pv-${pvi}`) && (
                              <Card
                                tone="default"
                                padding={2}
                                border
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  zIndex: 10,
                                  minWidth: '160px',
                                  marginTop: '4px',
                                }}
                                onClick={(e) => e.stopPropagation()}>
                                <Stack space={1}>
                                  <Button
                                    text="Użyj jako szablon"
                                    mode="ghost"
                                    tone="default"
                                    onClick={() => {
                                      selectTemplateVariant(pvi);
                                      setOpenVariantMenu(null);
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      padding: '6px 8px',
                                      justifyContent: 'flex-start',
                                    }}
                                  />
                                  <Button
                                    text="Usuń wariant"
                                    mode="ghost"
                                    tone="critical"
                                    icon={TrashIcon}
                                    onClick={() => {
                                      removePrimaryVariant(pvi);
                                      setOpenVariantMenu(null);
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      padding: '6px 8px',
                                      justifyContent: 'flex-start',
                                    }}
                                  />
                                </Stack>
                              </Card>
                            )}
                          </Flex>
                        </Flex>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateRows: openVariants.has(
                              pv._key || `pv-${pvi}`
                            )
                              ? '1fr'
                              : '0fr',
                            transition: 'grid-template-rows 200ms ease',
                          }}>
                          <div style={{ overflow: 'hidden' }}>
                            <Stack space={3} style={{ paddingTop: 8 }}>
                              {(pv.secondaryFeatures || []).length === 0 ? (
                                <Text size={1} muted>
                                  Brak cech w tym wariancie.
                                </Text>
                              ) : (
                                <SortableList
                                  items={pv.secondaryFeatures || []}
                                  getId={(f, i) => f._key || `f-${i}`}
                                  getLabel={(f) => f.featureName}
                                  staticDuringDrag
                                  onReorder={(oldIndex, newIndex) =>
                                    reorderSecondaryFeatures(
                                      pvi,
                                      oldIndex,
                                      newIndex
                                    )
                                  }
                                  renderItem={({
                                    item: f,
                                    index: fi,
                                    handleProps,
                                  }) => (
                                    <div>
                                      <SlimFeatureCard
                                        feature={f}
                                        onChange={(next) =>
                                          updateSecondaryFeature(
                                            { type: 'variant', index: pvi },
                                            fi,
                                            next
                                          )
                                        }
                                        onRemove={() =>
                                          removeSecondaryFeature(
                                            { type: 'variant', index: pvi },
                                            fi
                                          )
                                        }
                                        onAddVariant={() =>
                                          openAddVariantForVariant(pvi, fi)
                                        }
                                        onGlobalAdd={(kind, name) =>
                                          addVariantGlobally(
                                            kind,
                                            name,
                                            f.featureName,
                                            pvi
                                          )
                                        }
                                        dragHandleProps={handleProps}
                                        showGlobalOption={
                                          (
                                            featureConfig.primary?.variants ||
                                            []
                                          ).length > 1
                                        }
                                      />
                                    </div>
                                  )}
                                />
                              )}
                            </Stack>
                          </div>
                        </div>
                      </Stack>
                    </Card>
                  )}
                />
              </Stack>
            )}
          </Stack>
        )}

        <CreatePrimaryDialog
          open={showCreatePrimary}
          onClose={() => setShowCreatePrimary(false)}
          onConfirm={createPrimary}
        />

        <AddPrimaryVariantDialog
          open={showAddPrimaryVariant}
          onClose={() => setShowAddPrimaryVariant(false)}
          onConfirm={confirmAddPrimaryVariant}
          existingVariants={featureConfig.primary?.variants || []}
        />

        {/* Add Secondary Feature Dialog (Scenario 1 focus) */}
        <AddSecondaryFeatureDialog
          open={showAddSecondaryDialog}
          onClose={() => setShowAddSecondaryDialog(false)}
          onConfirm={confirmAddSecondary}
          existingFeatures={featureConfig.secondaryFeatures || []}
        />

        <AddSecondaryToVariantDialog
          open={showAddSecondaryToVariant}
          onClose={() => setShowAddSecondaryToVariant(false)}
          onConfirm={confirmAddSecondaryToVariant}
          existingFeatures={
            pendingVariantIndex !== null
              ? featureConfig.primary?.variants[pendingVariantIndex]
                  ?.secondaryFeatures || []
              : []
          }
          showGlobalOption={(featureConfig.primary?.variants || []).length > 1}
        />

        <ApplyTemplateDialog
          open={showApplyTemplateDialog}
          onClose={closeApplyTemplateDialog}
          onConfirm={applyTemplateToAllVariants}
          templateVariantName={
            templateVariantIndex !== null && featureConfig.primary?.variants
              ? featureConfig.primary.variants[templateVariantIndex]?.label ||
                ''
              : ''
          }
          targetVariantsCount={
            templateVariantIndex !== null && featureConfig.primary?.variants
              ? featureConfig.primary.variants.length - 1
              : 0
          }
        />

        {showVariantDialog && (
          <VariantTypeDialog
            open={showVariantDialog}
            onClose={() => setShowVariantDialog(false)}
            onConfirm={confirmAddVariant}
            showGlobalOption={false}
            existingOptions={
              variantFeatureIndex !== null && pendingAddContainer
                ? pendingAddContainer.type === 'root'
                  ? featureConfig.secondaryFeatures?.[variantFeatureIndex]
                      ?.options || []
                  : featureConfig.primary?.variants[pendingAddContainer.index]
                      ?.secondaryFeatures[variantFeatureIndex]?.options || []
                : []
            }
          />
        )}
      </Stack>
    </Container>
  );
}

export default FeaturesConfigurator;
