import {
  Box,
  Card,
  Container,
  Flex,
  Grid,
  Heading,
  Select,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import React, { useMemo, useState } from 'react';
import { useClient } from 'sanity';

import type { FeatureConfigV2 } from './features-configurator/types';

interface ProductFrontendPreviewProps {
  document: {
    displayed: {
      _id?: string;
      name?: string;
      imageGallery?: Array<{
        _type: 'image';
        asset: { url?: string; _ref?: string };
      }>;
      basePrice?: number;
      featureConfig?: FeatureConfigV2;
    };
  };
}

export function ProductFrontendPreview({
  document,
}: ProductFrontendPreviewProps) {
  const {
    name,
    imageGallery,
    basePrice = 0,
    featureConfig,
  } = document.displayed;

  const client = useClient();

  // State for selected options
  const [selectedPrimaryVariant, setSelectedPrimaryVariant] =
    useState<string>('');
  const [selectedSecondaryOptions, setSelectedSecondaryOptions] = useState<
    Record<string, Record<string, string>>
  >({});
  const [customLengthValues, setCustomLengthValues] = useState<
    Record<string, Record<string, number>>
  >({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [tempInputValues, setTempInputValues] = useState<
    Record<string, string>
  >({});
  const [selectedNestedChoices, setSelectedNestedChoices] = useState<
    Record<string, Record<string, string>>
  >({});

  // Get primary variants
  const primaryVariants = useMemo(
    () => featureConfig?.primary?.variants || [],
    [featureConfig?.primary?.variants]
  );
  const selectedVariant = useMemo(
    () =>
      primaryVariants.find((v) => v._key === selectedPrimaryVariant) ||
      primaryVariants[0],
    [primaryVariants, selectedPrimaryVariant]
  );

  // Support scenario without primary feature
  const hasPrimary = primaryVariants.length > 0;
  const variantKey = selectedPrimaryVariant || 'root';
  const activeFeatures = useMemo(
    () =>
      (hasPrimary
        ? selectedVariant?.secondaryFeatures || []
        : featureConfig?.secondaryFeatures || []) as any[],
    [hasPrimary, selectedVariant, featureConfig?.secondaryFeatures]
  );

  // Helper function to generate a signature for secondary features
  const getSecondaryFeaturesSignature = React.useCallback((variant: any) => {
    if (!variant?.secondaryFeatures) return '';
    return variant.secondaryFeatures
      .map(
        (feature: any) =>
          `${feature.featureName}:${feature.options
            .map(
              (opt: any) =>
                `${opt.label}:${opt.secondOption ? 'custom' : 'fixed'}`
            )
            .join(',')}`
      )
      .join('|');
  }, []);

  // Helper function to find a variant with matching secondary features
  const findMatchingVariant = React.useCallback(
    (currentVariant: any) => {
      if (!currentVariant) return null;
      const currentSignature = getSecondaryFeaturesSignature(currentVariant);

      return primaryVariants.find((variant) => {
        if (variant._key === currentVariant._key) return false;
        return getSecondaryFeaturesSignature(variant) === currentSignature;
      });
    },
    [primaryVariants, getSecondaryFeaturesSignature]
  );

  // Initialize with first variant if available and auto-select secondary options
  React.useEffect(() => {
    if (primaryVariants.length > 0 && !selectedPrimaryVariant) {
      const firstVariant = primaryVariants[0];
      const variantKey = firstVariant._key || '';

      setSelectedPrimaryVariant(variantKey);

      // Auto-select first option for each secondary feature
      const initialSelections: Record<string, string> = {};
      const initialCustomValues: Record<string, number> = {};

      firstVariant.secondaryFeatures?.forEach((feature) => {
        if (feature.options && feature.options.length > 0) {
          const firstOption = feature.options[0];
          initialSelections[feature._key || ''] = firstOption._key || '';

          // If it's a numeric option, initialize with min value
          if (
            firstOption.secondOption?.enabled &&
            firstOption.secondOption.kind === 'numeric' &&
            firstOption.secondOption.numeric
          ) {
            const minValue = firstOption.secondOption.numeric.min || 0;
            initialCustomValues[firstOption._key || ''] = minValue;
          }
        }
      });

      setSelectedSecondaryOptions((prev) => ({
        ...prev,
        [variantKey]: initialSelections,
      }));
      setCustomLengthValues((prev) => ({
        ...prev,
        [variantKey]: initialCustomValues,
      }));
    }
  }, [primaryVariants, selectedPrimaryVariant]);

  // Initialize selections for root-level secondary features when no primary feature exists
  React.useEffect(() => {
    if (
      primaryVariants.length === 0 &&
      featureConfig?.secondaryFeatures?.length
    ) {
      const rootKey = 'root';
      if (!selectedSecondaryOptions[rootKey]) {
        const initialSelections: Record<string, string> = {};
        const initialCustomValues: Record<string, number> = {};

        featureConfig.secondaryFeatures.forEach((feature) => {
          if (feature.options && feature.options.length > 0) {
            const firstOption = feature.options[0];
            initialSelections[feature._key || ''] = firstOption._key || '';

            if (
              firstOption.secondOption?.enabled &&
              firstOption.secondOption.kind === 'numeric' &&
              firstOption.secondOption.numeric
            ) {
              const minValue = firstOption.secondOption.numeric.min || 0;
              initialCustomValues[firstOption._key || ''] = minValue;
            }
          }
        });

        setSelectedSecondaryOptions((prev) => ({
          ...prev,
          [rootKey]: initialSelections,
        }));
        setCustomLengthValues((prev) => ({
          ...prev,
          [rootKey]: initialCustomValues,
        }));
      }
    }
  }, [
    primaryVariants.length,
    featureConfig?.secondaryFeatures,
    selectedSecondaryOptions,
  ]);

  // Restore selections when switching primary variants
  React.useEffect(() => {
    if (selectedVariant && selectedPrimaryVariant) {
      const variantKey = selectedPrimaryVariant;

      // Check if we have saved selections for this variant
      if (!selectedSecondaryOptions[variantKey]) {
        // Try to find a matching variant with the same secondary features structure
        const matchingVariant = findMatchingVariant(selectedVariant);

        if (matchingVariant) {
          const matchingVariantKey = matchingVariant._key || '';

          // Copy the selections from the matching variant, but map by feature name instead of key
          if (selectedSecondaryOptions[matchingVariantKey]) {
            const mappedSelections: Record<string, string> = {};
            const mappedCustomValues: Record<string, number> = {};

            // Map selections by feature name instead of feature key
            selectedVariant.secondaryFeatures?.forEach((currentFeature) => {
              const currentFeatureName = currentFeature.featureName;

              // Find matching feature in the source variant by name
              const sourceFeature = matchingVariant.secondaryFeatures?.find(
                (f: any) => f.featureName === currentFeatureName
              );

              if (sourceFeature) {
                const sourceFeatureKey = sourceFeature._key || '';
                const sourceSelection =
                  selectedSecondaryOptions[matchingVariantKey][
                    sourceFeatureKey
                  ];

                if (sourceSelection) {
                  // Find the corresponding option in current feature by label
                  const sourceOption = sourceFeature.options?.find(
                    (opt: any) => opt._key === sourceSelection
                  );

                  if (sourceOption) {
                    // Find matching option in current feature by label
                    const currentOption = currentFeature.options?.find(
                      (opt: any) => opt.label === sourceOption.label
                    );

                    if (currentOption) {
                      mappedSelections[currentFeature._key || ''] =
                        currentOption._key || '';

                      // Also copy custom values if they exist
                      if (
                        customLengthValues[matchingVariantKey] &&
                        customLengthValues[matchingVariantKey][
                          sourceSelection
                        ] !== undefined
                      ) {
                        mappedCustomValues[currentOption._key || ''] =
                          customLengthValues[matchingVariantKey][
                            sourceSelection
                          ];
                      }
                    }
                  }
                }
              }
            });

            if (Object.keys(mappedSelections).length > 0) {
              setSelectedSecondaryOptions((prev) => ({
                ...prev,
                [variantKey]: mappedSelections,
              }));
            }

            if (Object.keys(mappedCustomValues).length > 0) {
              setCustomLengthValues((prev) => ({
                ...prev,
                [variantKey]: mappedCustomValues,
              }));
            }
          }
        } else {
          // Initialize with first option selected for each secondary feature
          const initialSelections: Record<string, string> = {};
          const initialCustomValues: Record<string, number> = {};

          selectedVariant.secondaryFeatures?.forEach((feature, index) => {
            if (feature.options && feature.options.length > 0) {
              const firstOption = feature.options[0];
              initialSelections[feature._key || ''] = firstOption._key || '';

              // If it's a numeric option, initialize with min value
              if (
                firstOption.secondOption?.enabled &&
                firstOption.secondOption.kind === 'numeric' &&
                firstOption.secondOption.numeric
              ) {
                const minValue = firstOption.secondOption.numeric.min || 0;
                initialCustomValues[firstOption._key || ''] = minValue;
              }
            }
          });

          setSelectedSecondaryOptions((prev) => ({
            ...prev,
            [variantKey]: initialSelections,
          }));
          setCustomLengthValues((prev) => ({
            ...prev,
            [variantKey]: initialCustomValues,
          }));
        }
      } else {
        // We have selections for this variant, but let's check if they match current feature keys

        const currentSelections = selectedSecondaryOptions[variantKey] || {};
        let hasValidSelections = false;

        selectedVariant.secondaryFeatures?.forEach((feature) => {
          const featureKey = feature._key || '';
          if (currentSelections[featureKey]) {
            hasValidSelections = true;
          }
        });

        if (!hasValidSelections) {
          // Clear the invalid selections
          setSelectedSecondaryOptions((prev) => ({
            ...prev,
            [variantKey]: {},
          }));
          setCustomLengthValues((prev) => ({
            ...prev,
            [variantKey]: {},
          }));

          // Try to find a matching variant and copy selections
          const matchingVariant = findMatchingVariant(selectedVariant);
          if (matchingVariant) {
            const matchingVariantKey = matchingVariant._key || '';

            // Copy the selections from the matching variant, but map by feature name instead of key
            if (selectedSecondaryOptions[matchingVariantKey]) {
              const mappedSelections: Record<string, string> = {};
              const mappedCustomValues: Record<string, number> = {};

              // Map selections by feature name instead of feature key
              selectedVariant.secondaryFeatures?.forEach((currentFeature) => {
                const currentFeatureName = currentFeature.featureName;

                // Find matching feature in the source variant by name
                const sourceFeature = matchingVariant.secondaryFeatures?.find(
                  (f: any) => f.featureName === currentFeatureName
                );

                if (sourceFeature) {
                  const sourceFeatureKey = sourceFeature._key || '';
                  const sourceSelection =
                    selectedSecondaryOptions[matchingVariantKey][
                      sourceFeatureKey
                    ];

                  if (sourceSelection) {
                    // Find the corresponding option in current feature by label
                    const sourceOption = sourceFeature.options?.find(
                      (opt: any) => opt._key === sourceSelection
                    );

                    if (sourceOption) {
                      // Find matching option in current feature by label
                      const currentOption = currentFeature.options?.find(
                        (opt: any) => opt.label === sourceOption.label
                      );

                      if (currentOption) {
                        mappedSelections[currentFeature._key || ''] =
                          currentOption._key || '';

                        // Also copy custom values if they exist
                        if (
                          customLengthValues[matchingVariantKey] &&
                          customLengthValues[matchingVariantKey][
                            sourceSelection
                          ] !== undefined
                        ) {
                          mappedCustomValues[currentOption._key || ''] =
                            customLengthValues[matchingVariantKey][
                              sourceSelection
                            ];
                        }
                      }
                    }
                  }
                }
              });

              if (Object.keys(mappedSelections).length > 0) {
                setSelectedSecondaryOptions((prev) => ({
                  ...prev,
                  [variantKey]: mappedSelections,
                }));
              }

              if (Object.keys(mappedCustomValues).length > 0) {
                setCustomLengthValues((prev) => ({
                  ...prev,
                  [variantKey]: mappedCustomValues,
                }));
              }
            }
          } else {
            // Initialize with first option selected for each secondary feature
            const initialSelections: Record<string, string> = {};
            const initialCustomValues: Record<string, number> = {};

            selectedVariant.secondaryFeatures?.forEach((feature, index) => {
              if (feature.options && feature.options.length > 0) {
                const firstOption = feature.options[0];
                initialSelections[feature._key || ''] = firstOption._key || '';

                // If it's a numeric option, initialize with min value
                if (
                  firstOption.secondOption?.enabled &&
                  firstOption.secondOption.kind === 'numeric' &&
                  firstOption.secondOption.numeric
                ) {
                  const minValue = firstOption.secondOption.numeric.min || 0;
                  initialCustomValues[firstOption._key || ''] = minValue;
                }
              }
            });

            setSelectedSecondaryOptions((prev) => ({
              ...prev,
              [variantKey]: initialSelections,
            }));
            setCustomLengthValues((prev) => ({
              ...prev,
              [variantKey]: initialCustomValues,
            }));
          }
        }
      }
    }
  }, [
    selectedVariant,
    selectedPrimaryVariant,
    primaryVariants,
    selectedSecondaryOptions,
    customLengthValues,
    findMatchingVariant,
  ]);

  // Calculate total price
  const totalPrice = useMemo(() => {
    // Base + optional primary variant base
    let total = basePrice + (hasPrimary ? selectedVariant?.basePrice || 0 : 0);

    // Add secondary feature prices
    const variantSelections = selectedSecondaryOptions[variantKey] || {};
    const variantCustomValues = customLengthValues[variantKey] || {};

    activeFeatures.forEach((feature) => {
      const featureKey = feature._key || '';
      const selectedOptionKey = variantSelections[featureKey];

      if (selectedOptionKey) {
        const option = feature.options.find(
          (opt: any) => opt._key === selectedOptionKey
        );
        if (option) {
          const modifierPrice = option.basePriceModifier || 0;
          total += modifierPrice;

          // Handle numeric second options
          if (
            option.secondOption?.enabled &&
            option.secondOption.kind === 'numeric' &&
            option.secondOption.numeric
          ) {
            const optionKey = option._key || '';
            const hasValidationError = !!validationErrors[optionKey];
            const customValue = variantCustomValues[optionKey];
            const {
              min = 0,
              perUnitPrice = 0,
              step = 1,
            } = option.secondOption.numeric;

            if (hasValidationError) {
              // If there's a validation error, only charge the base price
              // Base price is already added above, so we don't add anything extra here
            } else {
              // Use min value if no custom value is set (user just selected the option)
              const effectiveValue =
                customValue !== undefined ? customValue : min;

              // Calculate increments: charge base price when selected, then per-unit for increments above minimum
              const incrementsAboveMin = Math.max(
                0,
                Math.ceil((effectiveValue - min) / step)
              );

              total += incrementsAboveMin * perUnitPrice;
            }
          }

          // Handle choice second options (nested dropdown pricing)
          if (
            option.secondOption?.enabled &&
            option.secondOption.kind === 'choice'
          ) {
            const optionKey = option._key || '';
            const choices = option.secondOption.choices || [];
            const optional = option.secondOption.optional ?? false;
            let nestedKey =
              (selectedNestedChoices[variantKey] || {})[optionKey] || '';

            if (!optional && !nestedKey && choices.length > 0) {
              nestedKey = choices[0].value;
            }

            if (nestedKey) {
              const nested = choices.find((c: any) => c.value === nestedKey);
              const nestedPrice = nested?.price || 0;
              total += nestedPrice;
            }
          }
        }
      }
    });

    return total;
  }, [
    basePrice,
    selectedVariant,
    selectedSecondaryOptions,
    customLengthValues,
    validationErrors,
    hasPrimary,
    variantKey,
    activeFeatures,
    selectedNestedChoices,
  ]);

  const handleSecondaryOptionChange = (
    featureKey: string,
    optionKey: string
  ) => {
    const vKey = selectedPrimaryVariant || 'root';

    // When selecting an increment option, initialize the custom value to min if not exists
    const containerFeatures = hasPrimary
      ? selectedVariant?.secondaryFeatures || []
      : featureConfig?.secondaryFeatures || [];
    const selectedOption = containerFeatures
      .find((f: any) => f._key === featureKey)
      ?.options.find((opt: any) => opt._key === optionKey);

    if (
      selectedOption?.secondOption?.enabled &&
      selectedOption.secondOption.kind === 'numeric' &&
      selectedOption.secondOption.numeric
    ) {
      const minValue = selectedOption.secondOption.numeric.min || 0;
      const currentCustomValues = customLengthValues[vKey] || {};

      // Initialize with min value if not already set
      if (currentCustomValues[optionKey] === undefined) {
        setCustomLengthValues((prev) => ({
          ...prev,
          [vKey]: {
            ...prev[vKey],
            [optionKey]: minValue,
          },
        }));
      }

      // Initialize temp input value if not set
      if (tempInputValues[optionKey] === undefined) {
        setTempInputValues((prev) => ({
          ...prev,
          [optionKey]: minValue.toString(),
        }));
      }
    }

    setSelectedSecondaryOptions((prev) => ({
      ...prev,
      [vKey]: {
        ...prev[vKey],
        [featureKey]: optionKey,
      },
    }));
  };

  const validateCustomLength = (
    value: number,
    min: number,
    max: number,
    step: number
  ): string | null => {
    if (value < min) {
      return `Wartość nie może być mniejsza niż ${min}`;
    }
    if (value > max) {
      return `Wartość nie może być większa niż ${max}`;
    }
    // Check if value respects the step increment
    const remainder = (value - min) % step;
    if (Math.abs(remainder) > 0.001) {
      // Small tolerance for floating point precision
      return `Wartość musi być wielokrotnością kroku ${step}`;
    }
    return null;
  };

  const handleCustomLengthChange = (featureKey: string, value: string) => {
    // Only update temporary input value on change
    setTempInputValues((prev) => ({
      ...prev,
      [featureKey]: value,
    }));
  };

  const handleCustomLengthBlur = (
    featureKey: string,
    min: number,
    max: number,
    step: number
  ) => {
    const vKey = selectedPrimaryVariant || 'root';

    const stringValue = tempInputValues[featureKey] || '';
    const numericValue = parseFloat(stringValue) || min;

    const error = validateCustomLength(numericValue, min, max, step);
    setValidationErrors((prev) => ({
      ...prev,
      [featureKey]: error || '',
    }));

    // Only update the actual value if there's no validation error
    if (!error) {
      setCustomLengthValues((prev) => ({
        ...prev,
        [vKey]: {
          ...prev[vKey],
          [featureKey]: numericValue,
        },
      }));
    }
  };

  // Fetch image URL from Sanity asset
  React.useEffect(() => {
    const fetchImageUrl = async () => {
      if (
        imageGallery &&
        imageGallery.length > 0 &&
        imageGallery[0].asset._ref
      ) {
        try {
          const assetId = imageGallery[0].asset._ref;
          const asset = await client.getDocument(assetId);
          if (asset && asset.url) {
            setImageUrl(asset.url);
          } else {
            // If we can't get the asset, try to construct the URL manually
            const assetRef = imageGallery[0].asset._ref;
            const assetIdClean = assetRef.replace('image-', '');
            // Try to construct URL with common project/dataset pattern
            const constructedUrl = `https://cdn.sanity.io/images/${assetIdClean.split('-')[0]}/production/${assetRef}?w=400&h=300&fit=crop&auto=format`;
            setImageUrl(constructedUrl);
          }
        } catch {
          // Fallback to constructed URL
          const assetRef = imageGallery[0].asset._ref;
          const assetIdClean = assetRef.replace('image-', '');
          const constructedUrl = `https://cdn.sanity.io/images/${assetIdClean.split('-')[0]}/production/${assetRef}?w=400&h=300&fit=crop&auto=format`;
          setImageUrl(constructedUrl);
        }
      } else {
        setImageUrl(null);
      }
    };

    fetchImageUrl();
  }, [imageGallery, client]);

  // Check if product has any features at all
  const hasAnyFeatures =
    hasPrimary || (activeFeatures && activeFeatures.length > 0);

  return (
    <Container width={6} style={{ height: '100%' }}>
      <Stack space={4} padding={4} style={{ height: '100%' }}>
        {!hasAnyFeatures ? (
          /* Simple heading when no features exist */
          <Stack space={2} style={{ textAlign: 'center', marginTop: '42px' }}>
            <Heading as="h3" size={2}>
              Specyfikacja produktu
            </Heading>
            <Text size={2} muted>
              Ten produkt nie ma dodatkowych opcji konfiguracyjnych
            </Text>
          </Stack>
        ) : (
          <>
            <Heading as="h2" size={2}>
              Podgląd produktu: {name || 'Nowy produkt'}
            </Heading>

            <Text muted size={2}>
              Interaktywny podgląd tego, jak produkt będzie wyglądał na stronie
              internetowej
            </Text>

            <Grid columns={[1, 1, 2]} gap={4} style={{ height: '100%' }}>
              {/* Left Panel - Product Image */}
              <Card
                border
                padding={3}
                style={{ height: '100%', position: 'relative' }}>
                <Stack
                  space={3}
                  style={{ height: '100%', position: 'relative' }}>
                  {imageGallery && imageGallery.length > 0 ? (
                    <Box
                      style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        right: '16px',
                        bottom: '16px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                      <img
                        src={
                          imageUrl
                            ? `${imageUrl}?w=400&h=300&fit=crop&auto=format`
                            : undefined
                        }
                        alt="Product preview"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML =
                              '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">Nie udało się załadować zdjęcia</div>';
                          }
                        }}
                      />
                    </Box>
                  ) : (
                    <Box
                      style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        right: '16px',
                        bottom: '16px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Text muted>Brak zdjęcia</Text>
                    </Box>
                  )}
                </Stack>
              </Card>

              {/* Right Panel - Configuration */}
              <Card border padding={3} style={{ height: '100%' }}>
                <Stack space={4} style={{ height: '100%' }}>
                  <Text size={2} weight="semibold">
                    Konfiguracja produktu
                  </Text>

                  {/* Primary Feature Selection */}
                  {featureConfig?.primary && (
                    <Stack space={3}>
                      <Text size={1} weight="medium" muted>
                        {featureConfig.primary.name || 'Główna cecha'}
                      </Text>
                      <Select
                        value={selectedPrimaryVariant}
                        onChange={(e) =>
                          setSelectedPrimaryVariant(e.currentTarget.value)
                        }
                        style={{ cursor: 'pointer' }}>
                        {primaryVariants.map((variant) => (
                          <option key={variant._key} value={variant._key || ''}>
                            {variant.label}
                            {variant.basePrice
                              ? ` (+${variant.basePrice} zł)`
                              : ''}
                          </option>
                        ))}
                      </Select>
                    </Stack>
                  )}

                  {/* Secondary Features */}
                  {activeFeatures?.map((feature) => (
                    <Stack key={feature._key} space={3}>
                      <Text size={1} weight="medium" muted>
                        {feature.featureName}
                      </Text>

                      <Select
                        value={
                          (selectedSecondaryOptions[variantKey] || {})[
                            feature._key || ''
                          ] || ''
                        }
                        onChange={(e) =>
                          handleSecondaryOptionChange(
                            feature._key || '',
                            e.currentTarget.value
                          )
                        }
                        style={{ cursor: 'pointer' }}>
                        {feature.options.map((option: any) => (
                          <option key={option._key} value={option._key || ''}>
                            {option.label}
                            {option.basePriceModifier
                              ? ` (+${option.basePriceModifier} zł)`
                              : ''}
                          </option>
                        ))}
                      </Select>

                      {/* Custom length input for numeric second options */}
                      {(() => {
                        const selectedOptionKey = (selectedSecondaryOptions[
                          variantKey
                        ] || {})[feature._key || ''];
                        const selectedOption = feature.options.find(
                          (opt: any) => opt._key === selectedOptionKey
                        );

                        if (
                          selectedOption?.secondOption?.enabled &&
                          selectedOption.secondOption.kind === 'numeric' &&
                          selectedOption.secondOption.numeric
                        ) {
                          const numericConfig =
                            selectedOption.secondOption.numeric;
                          const variantCustomValues =
                            customLengthValues[variantKey] || {};
                          const optionKey = selectedOption._key || '';
                          const currentValue =
                            tempInputValues[optionKey] !== undefined
                              ? tempInputValues[optionKey]
                              : variantCustomValues[optionKey] !== undefined
                                ? variantCustomValues[optionKey].toString()
                                : (numericConfig.min || 0).toString();

                          return (
                            <Box style={{ marginTop: '8px' }}>
                              <Text
                                size={1}
                                muted
                                style={{ marginBottom: '12px' }}>
                                {numericConfig.label || 'Długość własna'}
                              </Text>
                              <TextInput
                                type="number"
                                value={currentValue}
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>
                                ) => {
                                  handleCustomLengthChange(
                                    optionKey,
                                    e.currentTarget.value
                                  );
                                }}
                                onBlur={() => {
                                  handleCustomLengthBlur(
                                    optionKey,
                                    numericConfig.min || 0,
                                    numericConfig.max || 10,
                                    numericConfig.step || 1
                                  );
                                }}
                                placeholder={`${numericConfig.min || 0}`}
                                min={numericConfig.min || 0}
                                max={numericConfig.max || 10}
                                step={numericConfig.step || 1}
                                style={{
                                  textAlign: 'left',
                                  width: '100%',
                                  borderColor: validationErrors[
                                    selectedOption._key || ''
                                  ]
                                    ? 'var(--card-border-color-critical)'
                                    : undefined,
                                  backgroundColor: validationErrors[
                                    selectedOption._key || ''
                                  ]
                                    ? 'var(--card-bg-color-critical)'
                                    : undefined,
                                  boxShadow: validationErrors[
                                    selectedOption._key || ''
                                  ]
                                    ? '0 0 0 1px var(--card-border-color-critical)'
                                    : undefined,
                                }}
                              />

                              {/* Validation Error - shown above details when there's an error */}
                              {validationErrors[optionKey] && (
                                <Card
                                  tone="critical"
                                  style={{
                                    backgroundColor:
                                      'var(--card-bg-color-critical)',
                                    border:
                                      '1px solid var(--card-border-color-critical)',
                                    borderRadius: '4px',
                                    paddingTop: '8px',
                                    paddingBottom: '8px',
                                  }}>
                                  <Text size={2}>
                                    {validationErrors[optionKey]}
                                  </Text>
                                </Card>
                              )}

                              <Text
                                size={2}
                                muted
                                style={{
                                  marginTop: '8px',
                                }}>
                                Zakres: {numericConfig.min || 0}
                                {numericConfig.unit || 'm'} -{' '}
                                {numericConfig.max || 10}
                                {numericConfig.unit || 'm'}
                                {numericConfig.step &&
                                  ` (krok: ${numericConfig.step})`}
                                {numericConfig.perUnitPrice &&
                                  ` • ${numericConfig.perUnitPrice} zł/${numericConfig.unit || 'm'}`}
                              </Text>
                            </Box>
                          );
                        }

                        if (
                          selectedOption?.secondOption?.enabled &&
                          selectedOption.secondOption.kind === 'choice'
                        ) {
                          const nested = selectedOption.secondOption;
                          const choices = nested?.choices || [];
                          const optional = nested?.optional ?? false;
                          const optKey = selectedOption._key || '';
                          const nestedKey =
                            (selectedNestedChoices[variantKey] || {})[optKey] ||
                            (optional ? '' : choices[0]?.value || '');

                          if (
                            !optional &&
                            !selectedNestedChoices[variantKey]?.[optKey] &&
                            choices.length > 0
                          ) {
                            setSelectedNestedChoices((prev) => ({
                              ...prev,
                              [variantKey]: {
                                ...(prev[variantKey] || {}),
                                [optKey]: choices[0].value,
                              },
                            }));
                          }

                          return (
                            <Box style={{ marginTop: '8px' }}>
                              <Text
                                size={1}
                                muted
                                style={{ marginBottom: '12px' }}>
                                {nested?.placeholder ||
                                  `Wybierz opcję dla: ${selectedOption.label}`}
                              </Text>
                              <Select
                                value={nestedKey}
                                onChange={(e) => {
                                  const val = e.currentTarget.value;
                                  setSelectedNestedChoices((prev) => ({
                                    ...prev,
                                    [variantKey]: {
                                      ...(prev[variantKey] || {}),
                                      [optKey]: val,
                                    },
                                  }));
                                }}
                                style={{ cursor: 'pointer' }}>
                                {optional && <option value="">Brak</option>}
                                {choices.map((c: any) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                    {c.price ? ` (+${c.price} zł)` : ''}
                                  </option>
                                ))}
                              </Select>
                            </Box>
                          );
                        }
                        return null;
                      })()}
                    </Stack>
                  ))}

                  {/* Total Price */}
                  <Card
                    tone="primary"
                    padding={3}
                    style={{ marginTop: '16px' }}>
                    <Flex align="center" justify="space-between">
                      <Text size={2} weight="medium">
                        Razem:
                      </Text>
                      <Text size={3} weight="bold">
                        {totalPrice.toFixed(2)} zł
                      </Text>
                    </Flex>
                  </Card>
                </Stack>
              </Card>
            </Grid>

            {/* Section Header - Outside container */}
            <Stack space={2} style={{ textAlign: 'center', marginTop: '42px' }}>
              <Heading as="h3" size={2}>
                Specyfikacja produktu
              </Heading>
              <Text size={2} muted>
                Kompletny przegląd wszystkich dostępnych opcji i cech
              </Text>
            </Stack>

            {/* Product Features - No container */}
            <Stack space={4} style={{ marginTop: '8px' }}>
              {hasPrimary && featureConfig?.primary ? (
                <Stack space={4}>
                  {/* Primary Feature Title */}
                  <Card tone="primary" padding={3}>
                    <Text size={2} weight="semibold">
                      {featureConfig.primary.name || 'Główna cecha'}
                    </Text>
                  </Card>

                  {/* Primary Variants Grid */}
                  <Grid columns={[1, 1, 2]} gap={3}>
                    {primaryVariants.map((variant, variantIndex) => (
                      <Card
                        key={variant._key}
                        tone="default"
                        border
                        padding={4}>
                        <Stack space={3}>
                          {/* Variant Header */}
                          <Flex align="center" justify="space-between">
                            <Text size={3} weight="semibold">
                              {variant.label}
                            </Text>
                            {variant.basePrice !== undefined && (
                              <Text size={2} weight="medium">
                                {variant.basePrice >= 0 ? '+' : ''}
                                {variant.basePrice} zł
                              </Text>
                            )}
                          </Flex>

                          {/* Secondary Features for this variant */}
                          {variant.secondaryFeatures &&
                            variant.secondaryFeatures.length > 0 && (
                              <Stack space={3}>
                                {variant.secondaryFeatures.map(
                                  (feature, featureIndex) => (
                                    <Stack key={feature._key} space={2}>
                                      {/* Feature Name */}
                                      <Card tone="caution" padding={2}>
                                        <Text size={2} weight="medium">
                                          {feature.featureName}
                                        </Text>
                                      </Card>

                                      {/* Feature Options */}
                                      <Stack space={1}>
                                        {feature.options.map(
                                          (option: any, optionIndex) => (
                                            <Card
                                              key={option._key}
                                              tone="transparent"
                                              paddingX={2}
                                              style={{
                                                paddingBottom: '12px',
                                                paddingTop: '12px',
                                              }}>
                                              <Flex
                                                align="center"
                                                justify="space-between">
                                                <Text size={2}>
                                                  {option.label}
                                                </Text>
                                                <Text size={2} weight="medium">
                                                  +
                                                  {option.basePriceModifier ||
                                                    0}{' '}
                                                  zł
                                                </Text>
                                              </Flex>

                                              {/* Option Details */}
                                              {option.secondOption?.enabled && (
                                                <Box
                                                  style={{
                                                    marginTop: '12px',
                                                    marginBottom: '8px',
                                                  }}>
                                                  <Text size={1} muted>
                                                    {option.secondOption
                                                      .kind === 'numeric' &&
                                                      option.secondOption
                                                        .numeric && (
                                                        <Flex
                                                          gap={3}
                                                          wrap="wrap">
                                                          <span>
                                                            Zakres:{' '}
                                                            {option.secondOption
                                                              .numeric.min || 0}
                                                            -
                                                            {option.secondOption
                                                              .numeric.max ||
                                                              10}
                                                            {option.secondOption
                                                              .numeric.unit ||
                                                              'm'}
                                                          </span>
                                                          {option.secondOption
                                                            .numeric
                                                            .perUnitPrice && (
                                                            <span>
                                                              •{' '}
                                                              {
                                                                option
                                                                  .secondOption
                                                                  .numeric
                                                                  .perUnitPrice
                                                              }{' '}
                                                              zł/
                                                              {option
                                                                .secondOption
                                                                .numeric.unit ||
                                                                'm'}
                                                            </span>
                                                          )}
                                                          {option.secondOption
                                                            .numeric.step && (
                                                            <span>
                                                              • Krok:{' '}
                                                              {
                                                                option
                                                                  .secondOption
                                                                  .numeric.step
                                                              }
                                                            </span>
                                                          )}
                                                        </Flex>
                                                      )}
                                                    {option.secondOption
                                                      .kind === 'choice' &&
                                                      option.secondOption
                                                        .choices && (
                                                        <div>
                                                          <div
                                                            style={{
                                                              marginBottom:
                                                                '8px',
                                                              marginTop: '0px',
                                                            }}>
                                                            Dostępne opcje:{' '}
                                                            {
                                                              option
                                                                .secondOption
                                                                .choices.length
                                                            }
                                                            {option.secondOption
                                                              .optional &&
                                                              ' (opcjonalne)'}
                                                          </div>
                                                          <Stack space={2}>
                                                            {option.secondOption.choices.map(
                                                              (
                                                                choice: any,
                                                                idx: number
                                                              ) => (
                                                                <Flex
                                                                  key={idx}
                                                                  align="center"
                                                                  justify="space-between">
                                                                  <Text
                                                                    size={1}
                                                                    muted>
                                                                    •{' '}
                                                                    {
                                                                      choice.label
                                                                    }
                                                                  </Text>
                                                                  <Text
                                                                    size={1}
                                                                    muted>
                                                                    +
                                                                    {choice.price ||
                                                                      0}{' '}
                                                                    zł
                                                                  </Text>
                                                                </Flex>
                                                              )
                                                            )}
                                                          </Stack>
                                                        </div>
                                                      )}
                                                  </Text>
                                                </Box>
                                              )}
                                            </Card>
                                          )
                                        )}
                                      </Stack>
                                    </Stack>
                                  )
                                )}
                              </Stack>
                            )}
                        </Stack>
                      </Card>
                    ))}
                  </Grid>
                </Stack>
              ) : (
                <Stack space={4}>
                  {/* Secondary Features List */}
                  <Stack space={3}>
                    {activeFeatures.map((feature, featureIndex) => (
                      <Card key={feature._key} border padding={4}>
                        <Stack space={3}>
                          {/* Feature Header */}
                          <Card tone="caution" padding={2}>
                            <Text size={2} weight="medium">
                              {feature.featureName}
                            </Text>
                          </Card>

                          {/* Feature Options */}
                          <Stack space={1}>
                            {feature.options.map(
                              (option: any, optionIndex: number) => (
                                <Card
                                  key={option._key}
                                  tone="transparent"
                                  padding={2}>
                                  <Flex align="center" justify="space-between">
                                    <Text size={2}>{option.label}</Text>
                                    <Text size={2} weight="medium">
                                      +{option.basePriceModifier || 0} zł
                                    </Text>
                                  </Flex>

                                  {/* Option Details */}
                                  {option.secondOption?.enabled && (
                                    <Box
                                      style={{
                                        marginTop: '12px',
                                        marginBottom: '8px',
                                      }}>
                                      <Text size={1} muted>
                                        {option.secondOption.kind ===
                                          'numeric' &&
                                          option.secondOption.numeric && (
                                            <Flex gap={3} wrap="wrap">
                                              <span>
                                                Zakres:{' '}
                                                {option.secondOption.numeric
                                                  .min || 0}
                                                -
                                                {option.secondOption.numeric
                                                  .max || 10}
                                                {option.secondOption.numeric
                                                  .unit || 'm'}
                                              </span>
                                              {option.secondOption.numeric
                                                .perUnitPrice && (
                                                <span>
                                                  •{' '}
                                                  {
                                                    option.secondOption.numeric
                                                      .perUnitPrice
                                                  }{' '}
                                                  zł/
                                                  {option.secondOption.numeric
                                                    .unit || 'm'}
                                                </span>
                                              )}
                                              {option.secondOption.numeric
                                                .step && (
                                                <span>
                                                  • Krok:{' '}
                                                  {
                                                    option.secondOption.numeric
                                                      .step
                                                  }
                                                </span>
                                              )}
                                            </Flex>
                                          )}
                                        {option.secondOption.kind ===
                                          'choice' &&
                                          option.secondOption.choices && (
                                            <div>
                                              <div
                                                style={{
                                                  marginBottom: '12px',
                                                }}>
                                                Dostępne opcje:{' '}
                                                {
                                                  option.secondOption.choices
                                                    .length
                                                }
                                                {option.secondOption.optional &&
                                                  ' (opcjonalne)'}
                                              </div>
                                              <Stack space={2}>
                                                {option.secondOption.choices.map(
                                                  (
                                                    choice: any,
                                                    idx: number
                                                  ) => (
                                                    <Flex
                                                      key={idx}
                                                      align="center"
                                                      justify="space-between">
                                                      <Text size={1} muted>
                                                        • {choice.label}
                                                      </Text>
                                                      <Text size={1} muted>
                                                        +{choice.price || 0} zł
                                                      </Text>
                                                    </Flex>
                                                  )
                                                )}
                                              </Stack>
                                            </div>
                                          )}
                                      </Text>
                                    </Box>
                                  )}
                                </Card>
                              )
                            )}
                          </Stack>
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  );
}

export default ProductFrontendPreview;
