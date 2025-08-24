// eslint-disable-next-line simple-import-sort/imports
import React, { useMemo } from 'react';
import { Box, Card, Flex, Stack, Text } from '@sanity/ui';

type FeatureOverride = {
  targetFeature: string;
  targetOption: string;
  newPrice?: number;
  newIncrementPrice?: number;
  targetSecondChoice?: string;
};

type FeatureOption = {
  _key?: string;
  label: string;
  value: string;
  basePriceModifier: number;
  featureOverrides?: FeatureOverride[];
  isAvailable: boolean;
  secondOption?: {
    enabled?: boolean;
    kind?: 'numeric' | 'choice';
    numeric?: {
      unit?: string;
      min?: number;
      max?: number;
      step?: number;
      perUnitPrice?: number;
    };
    choices?: Array<{ label: string; value: string; price?: number }>;
    optional?: boolean;
  };
};

type ProductFeature = {
  _key?: string;
  featureName: string;
  options: FeatureOption[];
};

interface PricingCalculatorProps {
  features: ProductFeature[];
  primaryFeatureKey?: string;
}

const formatPrice = (price: number, showPlus = false) => {
  const color = price > 0 ? '#0d7377' : price < 0 ? '#d73502' : '#525966';
  return (
    <Text
      size={2}
      style={{
        fontFamily: 'monospace',
        fontWeight: 700,
        color,
      }}>
      {showPlus && price > 0 ? '+' : ''}
      {price.toLocaleString()} zł
    </Text>
  );
};

// Organize features by primary/secondary hierarchy
function organizeFeatureHierarchy(
  features: ProductFeature[],
  primaryFeatureKey?: string
) {
  if (!primaryFeatureKey) {
    // No primary feature - all features are secondary
    return [
      {
        groupName: 'Wszystkie opcje produktu',
        primaryOption: null,
        secondaryFeatures: features,
      },
    ];
  }

  const primaryFeature = features.find((f) => f._key === primaryFeatureKey);
  if (!primaryFeature) return [];

  const secondaryFeatures = features.filter(
    (f) => f._key !== primaryFeatureKey
  );

  return primaryFeature.options
    .filter((opt) => opt.isAvailable)
    .map((primaryOption) => ({
      groupName: `${primaryFeature.featureName}: ${primaryOption.label}`,
      primaryOption: {
        feature: primaryFeature,
        option: primaryOption,
      },
      secondaryFeatures,
    }));
}

export function PricingOverview({
  features,
  primaryFeatureKey,
}: PricingCalculatorProps) {
  const featureGroups = useMemo(() => {
    return organizeFeatureHierarchy(features, primaryFeatureKey);
  }, [features, primaryFeatureKey]);

  // Calculate price for a specific option within a group context
  const calculateOptionPrice = (
    feature: ProductFeature,
    option: FeatureOption,
    primaryOption: { feature: ProductFeature; option: FeatureOption } | null
  ) => {
    let basePrice = option.basePriceModifier;

    // Apply primary overrides for secondary features
    if (primaryOption && feature._key !== primaryOption.feature._key) {
      const override = primaryOption.option.featureOverrides?.find(
        (ov) =>
          ov.targetFeature === feature.featureName &&
          ov.targetOption === option.value &&
          !ov.targetSecondChoice
      );
      if (override && override.newPrice !== undefined) {
        basePrice = override.newPrice;
      }
    }

    return basePrice;
  };

  return (
    <Stack space={4}>
      {/* Simple Header */}
      <Flex
        align="center"
        justify="space-between"
        paddingX={4}
        style={{ marginBottom: '16px' }}>
        <Text size={5} weight="bold">
          Przegląd cen produktu
        </Text>
        <Text size={3} muted>
          {featureGroups.length} {featureGroups.length === 1 ? 'grupa' : 'grup'}
        </Text>
      </Flex>

      {/* 2-Column Grid Layout */}
      <Box
        paddingX={4}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '24px',
        }}>
        {featureGroups.map((group, groupIndex) => (
          <Card key={groupIndex} padding={4} border>
            <Stack space={4}>
              {/* Group Header */}
              <Box
                style={{
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  borderLeft: '4px solid #0066cc',
                }}>
                <Flex justify="space-between" align="center">
                  <Text size={3} weight="medium" style={{ color: '#2d3748' }}>
                    {group.groupName}
                  </Text>
                  {group.primaryOption && (
                    <Text size={3} weight="medium" style={{ color: '#0066cc' }}>
                      {
                        formatPrice(
                          group.primaryOption.option.basePriceModifier
                        ).props.children
                      }
                    </Text>
                  )}
                </Flex>
              </Box>

              {/* Secondary Features */}
              <Stack space={3}>
                {group.secondaryFeatures.map((feature) => (
                  <Box key={feature._key}>
                    {/* Feature Name */}
                    <Box style={{ marginBottom: '16px' }}>
                      <Text size={2} weight="medium" muted>
                        {feature.featureName}
                      </Text>
                    </Box>

                    {/* Feature Options */}
                    <Stack space={3} style={{ paddingLeft: '16px' }}>
                      {feature.options
                        .filter((opt) => opt.isAvailable)
                        .map((option) => {
                          const basePrice = calculateOptionPrice(
                            feature,
                            option,
                            group.primaryOption
                          );

                          // Handle numeric second option (increment)
                          if (
                            option.secondOption?.enabled &&
                            option.secondOption.kind === 'numeric'
                          ) {
                            const numericConfig = option.secondOption.numeric;
                            let perUnitPrice = numericConfig?.perUnitPrice ?? 0;

                            // Apply primary override for per-unit price
                            if (group.primaryOption) {
                              const override =
                                group.primaryOption.option.featureOverrides?.find(
                                  (ov) =>
                                    ov.targetFeature === feature.featureName &&
                                    ov.targetOption === option.value
                                );
                              if (
                                override &&
                                override.newIncrementPrice !== undefined
                              ) {
                                perUnitPrice = override.newIncrementPrice;
                              }
                            }

                            return (
                              <Box
                                key={option._key}
                                style={{ marginBottom: '20px' }}>
                                <Text
                                  size={2}
                                  weight="medium"
                                  style={{ marginBottom: '12px' }}>
                                  • {option.label}
                                </Text>
                                <Stack
                                  space={2}
                                  style={{ paddingLeft: '20px' }}>
                                  <Flex justify="space-between" align="center">
                                    <Text size={2} muted>
                                      Base:
                                    </Text>
                                    <Text size={2} muted>
                                      {formatPrice(basePrice).props.children}
                                    </Text>
                                  </Flex>
                                  <Flex justify="space-between" align="center">
                                    <Text size={2} muted>
                                      Increment:
                                    </Text>
                                    <Text size={2}>
                                      {formatPrice(perUnitPrice).props.children}
                                      /{numericConfig?.unit || 'unit'}
                                    </Text>
                                  </Flex>
                                  <Text size={2} muted>
                                    Range: {numericConfig?.min || 0}
                                    {numericConfig?.unit} -{' '}
                                    {numericConfig?.max || '∞'}
                                    {numericConfig?.unit}
                                  </Text>
                                </Stack>
                              </Box>
                            );
                          }

                          // Handle choice second option
                          if (
                            option.secondOption?.enabled &&
                            option.secondOption.kind === 'choice'
                          ) {
                            return (
                              <Box
                                key={option._key}
                                style={{ marginBottom: '20px' }}>
                                <Text
                                  size={2}
                                  weight="medium"
                                  style={{ marginBottom: '12px' }}>
                                  • {option.label}
                                </Text>
                                <Stack
                                  space={2}
                                  style={{ paddingLeft: '20px' }}>
                                  <Flex justify="space-between" align="center">
                                    <Text size={2} muted>
                                      Base:
                                    </Text>
                                    <Text size={2} muted>
                                      {formatPrice(basePrice).props.children}
                                    </Text>
                                  </Flex>
                                  {option.secondOption.optional && (
                                    <Flex
                                      justify="space-between"
                                      align="center">
                                      <Text size={2} muted>
                                        Brak wyboru
                                      </Text>
                                      <Text size={2}>
                                        {formatPrice(0, true).props.children}
                                      </Text>
                                    </Flex>
                                  )}
                                  {option.secondOption.choices?.map(
                                    (choice, choiceIndex) => {
                                      let choicePrice = choice.price ?? 0;

                                      // Apply primary override for choice price
                                      if (group.primaryOption) {
                                        const override =
                                          group.primaryOption.option.featureOverrides?.find(
                                            (ov) =>
                                              ov.targetFeature ===
                                                feature.featureName &&
                                              ov.targetOption ===
                                                option.value &&
                                              ov.targetSecondChoice ===
                                                choice.value
                                          );
                                        if (
                                          override &&
                                          override.newPrice !== undefined
                                        ) {
                                          choicePrice = override.newPrice;
                                        }
                                      }

                                      return (
                                        <Flex
                                          key={choice.value}
                                          justify="space-between"
                                          align="center">
                                          <Text size={2} muted>
                                            {choice.label}
                                          </Text>
                                          <Text size={2} weight="medium">
                                            {
                                              formatPrice(choicePrice, true)
                                                .props.children
                                            }
                                          </Text>
                                        </Flex>
                                      );
                                    }
                                  )}
                                </Stack>
                              </Box>
                            );
                          }

                          // Handle standard option
                          return (
                            <Flex
                              key={option._key}
                              justify="space-between"
                              align="center"
                              style={{ marginBottom: '12px' }}>
                              <Text size={2} weight="medium">
                                • {option.label}
                              </Text>
                              <Text size={2} weight="semibold">
                                {formatPrice(basePrice).props.children}
                              </Text>
                            </Flex>
                          );
                        })}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Card>
        ))}
      </Box>

      {/* Help Section */}
      <Card padding={4} tone="transparent">
        <Stack space={3} paddingX={2}>
          <Text size={3} weight="semibold">
            Jak interpretować przegląd:
          </Text>
          <Stack space={2}>
            <Text size={2}>
              • <strong>Karty</strong> - pogrupowane według cechy głównej (jeśli
              wybrana)
            </Text>
            <Text size={2}>
              • <strong>Opcje standardowe</strong> - stała cena za wybraną opcję
            </Text>
            <Text size={2}>
              • <strong>Opcje przyrostowe</strong> - cena bazowa + koszt za
              jednostkę
            </Text>
            <Text size={2}>
              • <strong>Opcje wyboru</strong> - cena bazowa + koszt za wybraną
              opcję
            </Text>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}

export default PricingOverview;
