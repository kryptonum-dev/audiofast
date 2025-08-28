// eslint-disable-next-line simple-import-sort/imports
import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@sanity/ui';
import { AddIcon, TrashIcon } from '@sanity/icons';
import type { FeatureOptionV2, ProductFeatureV2 } from './types';
import {
  VariantTypeDialog,
  type VariantKindChoice,
} from './components/dialogs/VariantTypeDialog';

interface SecondaryFeatureCardProps {
  feature: ProductFeatureV2;
  onChange: (next: ProductFeatureV2) => void;
  onRemove: () => void;
  onGlobalAdd?: (kind: VariantKindChoice, name: string) => void;
}

function createOption(kind: VariantKindChoice): FeatureOptionV2 {
  const base: FeatureOptionV2 = {
    _key: `opt-${Date.now()}`,
    label: 'Nowa opcja',
    value: `opt-${Date.now()}`,
    basePriceModifier: 0,
    isAvailable: true,
  };

  if (kind === 'text') return base;
  if (kind === 'increment') {
    return {
      ...base,
      secondOption: {
        enabled: true,
        kind: 'numeric',
        numeric: {
          label: 'Wprowadź wartość',
          unit: 'm',
          min: 0,
          max: 10,
          step: 0.5,
          perUnitPrice: 0,
        },
      },
    };
  }

  return {
    ...base,
    secondOption: {
      enabled: true,
      kind: 'choice',
      choices: [],
      optional: false,
    },
  };
}

export function SecondaryFeatureCard({
  feature,
  onChange,
  onRemove,
  onGlobalAdd,
}: SecondaryFeatureCardProps) {
  const [showVariantDialog, setShowVariantDialog] = useState(false);

  const options = feature.options || [];
  const isEmpty = options.length === 0;

  const updateOption = (idx: number, next: Partial<FeatureOptionV2>) => {
    const copy = { ...feature, options: [...options] };
    copy.options[idx] = { ...copy.options[idx], ...next } as FeatureOptionV2;
    onChange(copy);
  };

  const removeOption = (idx: number) => {
    const copy = { ...feature, options: options.filter((_, i) => i !== idx) };
    onChange(copy);
  };

  const addOption = (
    kind: VariantKindChoice,
    name: string,
    addGlobally: boolean
  ) => {
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

    if (addGlobally && onGlobalAdd) {
      // Use the global add function if available and requested
      onGlobalAdd(kind, name);
    } else {
      // Normal addition to current feature
      const copy = { ...feature, options: [...options, option] };
      onChange(copy);
    }
  };

  return (
    <Card padding={4} border tone="transparent">
      <Stack space={3}>
        <Flex align="center" justify="space-between">
          <TextInput
            value={feature.featureName}
            onChange={(e) =>
              onChange({ ...feature, featureName: e.currentTarget.value })
            }
            placeholder="Nazwa cechy"
            fontSize={2}
          />
          <Flex gap={2}>
            <Button
              text="Dodaj wariant"
              mode="ghost"
              tone="caution"
              icon={AddIcon}
              onClick={() => setShowVariantDialog(true)}
              style={{
                cursor: 'pointer',
                borderColor: '#f59e0b',
                color: '#d97706',
              }}
            />
            <Button
              text="Usuń cechę"
              mode="ghost"
              tone="critical"
              icon={TrashIcon}
              onClick={onRemove}
              style={{ cursor: 'pointer' }}
            />
          </Flex>
        </Flex>

        {isEmpty ? (
          <Text size={1} muted>
            Brak wariantów. Dodaj pierwszy wariant.
          </Text>
        ) : (
          <Grid columns={[1, 2]} gap={2}>
            {options.map((opt, idx) => (
              <Card
                key={opt._key || `${idx}`}
                padding={3}
                border
                style={{ minWidth: 0 }}>
                <Stack space={2}>
                  <TextInput
                    value={opt.label}
                    onChange={(e) =>
                      updateOption(idx, { label: e.currentTarget.value })
                    }
                    placeholder="Nazwa opcji"
                    fontSize={1}
                  />
                  {/* Hide base price for numeric (increment) type */}
                  {!(
                    opt.secondOption?.enabled &&
                    opt.secondOption.kind === 'numeric'
                  ) && (
                    <TextInput
                      value={opt.basePriceModifier.toString()}
                      onChange={(e) =>
                        updateOption(idx, {
                          basePriceModifier:
                            parseInt(e.currentTarget.value) || 0,
                        })
                      }
                      placeholder="Cena bazowa"
                      fontSize={1}
                    />
                  )}

                  {/* Second option editors */}
                  {opt.secondOption?.enabled &&
                    opt.secondOption.kind === 'numeric' && (
                      <Stack space={2}>
                        <Grid columns={[1, 2]} gap={2}>
                          <Stack space={2} paddingTop={2}>
                            <Text size={1} weight="medium">
                              Etykieta pola
                            </Text>
                            <TextInput
                              placeholder="np. Długość"
                              value={(
                                opt.secondOption.numeric?.label ?? ''
                              ).toString()}
                              onChange={(e) => {
                                const numeric = {
                                  ...(opt.secondOption?.numeric || {}),
                                };
                                (numeric as any).label = e.currentTarget.value;
                                updateOption(idx, {
                                  secondOption: {
                                    ...opt.secondOption,
                                    numeric,
                                  },
                                });
                              }}
                            />
                          </Stack>
                          <Stack space={2} paddingTop={2}>
                            <Text size={1} weight="medium">
                              Jednostka
                            </Text>
                            <TextInput
                              placeholder="np. m, cm, mm"
                              value={opt.secondOption.numeric?.unit || ''}
                              onChange={(e) => {
                                const numeric = {
                                  ...(opt.secondOption?.numeric || {}),
                                };
                                numeric.unit = e.currentTarget.value;
                                updateOption(idx, {
                                  secondOption: {
                                    ...opt.secondOption,
                                    numeric,
                                  },
                                });
                              }}
                            />
                          </Stack>
                          <Stack space={2} paddingTop={2}>
                            <Text size={1} weight="medium">
                              Wartość minimalna
                            </Text>
                            <TextInput
                              type="number"
                              placeholder="0"
                              value={(
                                opt.secondOption.numeric?.min ?? ''
                              ).toString()}
                              onChange={(e) => {
                                const numeric = {
                                  ...(opt.secondOption?.numeric || {}),
                                };
                                numeric.min =
                                  e.currentTarget.value === ''
                                    ? undefined
                                    : parseFloat(e.currentTarget.value);
                                updateOption(idx, {
                                  secondOption: {
                                    ...opt.secondOption,
                                    numeric,
                                  },
                                });
                              }}
                            />
                          </Stack>
                          <Stack space={2} paddingTop={2}>
                            <Text size={1} weight="medium">
                              Wartość maksymalna
                            </Text>
                            <TextInput
                              type="number"
                              placeholder="10"
                              value={(
                                opt.secondOption.numeric?.max ?? ''
                              ).toString()}
                              onChange={(e) => {
                                const numeric = {
                                  ...(opt.secondOption?.numeric || {}),
                                };
                                numeric.max =
                                  e.currentTarget.value === ''
                                    ? undefined
                                    : parseFloat(e.currentTarget.value);
                                updateOption(idx, {
                                  secondOption: {
                                    ...opt.secondOption,
                                    numeric,
                                  },
                                });
                              }}
                            />
                          </Stack>
                          <Stack space={2} paddingTop={2}>
                            <Text size={1} weight="medium">
                              Krok/Increment
                            </Text>
                            <TextInput
                              type="number"
                              placeholder="0.5"
                              value={(
                                opt.secondOption.numeric?.step ?? ''
                              ).toString()}
                              onChange={(e) => {
                                const numeric = {
                                  ...(opt.secondOption?.numeric || {}),
                                };
                                numeric.step =
                                  e.currentTarget.value === ''
                                    ? undefined
                                    : parseFloat(e.currentTarget.value);
                                updateOption(idx, {
                                  secondOption: {
                                    ...opt.secondOption,
                                    numeric,
                                  },
                                });
                              }}
                            />
                          </Stack>
                          <Stack space={2} paddingTop={2}>
                            <Text size={1} weight="medium">
                              Cena za jednostkę
                            </Text>
                            <TextInput
                              type="number"
                              placeholder="100"
                              value={(
                                opt.secondOption.numeric?.perUnitPrice ?? ''
                              ).toString()}
                              onChange={(e) => {
                                const numeric = {
                                  ...(opt.secondOption?.numeric || {}),
                                };
                                numeric.perUnitPrice =
                                  e.currentTarget.value === ''
                                    ? undefined
                                    : parseInt(e.currentTarget.value) || 0;
                                updateOption(idx, {
                                  secondOption: {
                                    ...opt.secondOption,
                                    numeric,
                                  },
                                });
                              }}
                            />
                          </Stack>
                        </Grid>
                      </Stack>
                    )}

                  {opt.secondOption?.enabled &&
                    opt.secondOption.kind === 'choice' && (
                      <Stack space={2}>
                        <Button
                          text="Dodaj podrzędną opcję"
                          mode="ghost"
                          onClick={() => {
                            const choices = [
                              ...(opt.secondOption?.choices || []),
                            ];
                            choices.push({
                              label: 'Opcja',
                              value: `second-${Date.now()}`,
                              price: 0,
                            });
                            updateOption(idx, {
                              secondOption: { ...opt.secondOption, choices },
                            });
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        {(opt.secondOption?.choices || []).length ? (
                          <Stack space={2}>
                            {(opt.secondOption?.choices || []).map(
                              (c, cIdx) => (
                                <Card key={c.value} padding={2} border>
                                  <Grid columns={[1, 2]} gap={2}>
                                    <Box style={{ gridColumn: '1 / -1' }}>
                                      <TextInput
                                        value={c.label}
                                        onChange={(e) => {
                                          const choices = [
                                            ...(opt.secondOption?.choices ||
                                              []),
                                          ];
                                          choices[cIdx] = {
                                            ...choices[cIdx],
                                            label: e.currentTarget.value,
                                          };
                                          updateOption(idx, {
                                            secondOption: {
                                              ...opt.secondOption,
                                              choices,
                                            },
                                          });
                                        }}
                                        placeholder="Nazwa"
                                      />
                                    </Box>
                                    <TextInput
                                      value={c.price?.toString() || ''}
                                      onChange={(e) => {
                                        const choices = [
                                          ...(opt.secondOption?.choices || []),
                                        ];
                                        choices[cIdx] = {
                                          ...choices[cIdx],
                                          price:
                                            parseInt(e.currentTarget.value) ||
                                            0,
                                        };
                                        updateOption(idx, {
                                          secondOption: {
                                            ...opt.secondOption,
                                            choices,
                                          },
                                        });
                                      }}
                                      placeholder="Cena"
                                    />
                                    <Button
                                      text="Usuń"
                                      mode="ghost"
                                      tone="critical"
                                      icon={TrashIcon}
                                      onClick={() => {
                                        const choices = (
                                          opt.secondOption?.choices || []
                                        ).filter((_, i) => i !== cIdx);
                                        updateOption(idx, {
                                          secondOption: {
                                            ...opt.secondOption,
                                            choices,
                                          },
                                        });
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  </Grid>
                                </Card>
                              )
                            )}
                          </Stack>
                        ) : (
                          <Text size={1} muted>
                            Brak podrzędnych opcji
                          </Text>
                        )}
                      </Stack>
                    )}

                  <Flex justify="space-between" align="center">
                    {opt.secondOption?.enabled &&
                    opt.secondOption.kind === 'choice' ? (
                      <label
                        htmlFor={`optional-switch-secondary-${idx}`}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                        <Text size={1} muted>
                          Opcjonalne (można nie wybrać)
                        </Text>
                        <Switch
                          id={`optional-switch-secondary-${idx}`}
                          checked={Boolean(opt.secondOption?.optional)}
                          onChange={(e) => {
                            const next = { ...(opt.secondOption || {}) };
                            next.optional = e.currentTarget.checked;
                            updateOption(idx, { secondOption: next });
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </label>
                    ) : (
                      <span />
                    )}
                    <Button
                      mode="ghost"
                      tone="critical"
                      icon={TrashIcon}
                      onClick={() => removeOption(idx)}
                      style={{ cursor: 'pointer' }}
                    />
                  </Flex>
                </Stack>
              </Card>
            ))}
          </Grid>
        )}

        <VariantTypeDialog
          open={showVariantDialog}
          onClose={() => setShowVariantDialog(false)}
          onConfirm={(kind, name, addGlobally) => {
            setShowVariantDialog(false);
            addOption(kind, name, addGlobally);
          }}
          showGlobalOption={true}
        />
      </Stack>
    </Card>
  );
}

export default SecondaryFeatureCard;
