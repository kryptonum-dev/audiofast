// eslint-disable-next-line simple-import-sort/imports
import React, { useState } from 'react';
import { Button, Card, Flex, Stack, Switch, Text, TextInput } from '@sanity/ui';
import {
  AddIcon,
  TrashIcon,
  ChevronRightIcon,
  DragHandleIcon,
} from '@sanity/icons';
import type { FeatureOptionV2, ProductFeatureV2 } from './types';
import { arrayMove } from '@dnd-kit/sortable';
import InlineEditable from './InlineEditable';
import SortableList from './components/Sortable/SortableList';
import {
  VariantTypeDialog,
  type VariantKindChoice,
} from './components/dialogs/VariantTypeDialog';

type Props = {
  feature: ProductFeatureV2;
  onChange: (next: ProductFeatureV2) => void;
  onRemove: () => void;
  onAddVariant: () => void;
  onGlobalAdd?: (kind: VariantKindChoice, name: string) => void;
  dragHandleProps?: {
    attributes?: any;
    listeners?: any;
    isDragging?: boolean;
  };
  showGlobalOption?: boolean;
};

export default function SlimFeatureCard({
  feature,
  onChange,
  onRemove,
  onAddVariant,
  onGlobalAdd,
  dragHandleProps,
  showGlobalOption = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const updateOption = (idx: number, next: Partial<FeatureOptionV2>) => {
    const copy = { ...feature, options: [...(feature.options || [])] };
    copy.options[idx] = { ...copy.options[idx], ...next } as FeatureOptionV2;
    onChange(copy);
  };

  const removeOption = (idx: number) => {
    const copy = {
      ...feature,
      options: (feature.options || []).filter((_, i) => i !== idx),
    };
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
          placeholder: '',
        },
      };
    }

    if (addGlobally && onGlobalAdd) {
      // Use the global add function if available and requested
      onGlobalAdd(kind, name);
    } else {
      // Normal addition to current feature
      const copy = {
        ...feature,
        options: [...(feature.options || []), option],
      };
      onChange(copy);
    }
  };

  return (
    <Card padding={3}>
      <Stack space={3}>
        <Flex
          style={{
            borderBottom: '1px solid var(--card-border-color)',
            paddingBottom: '8px',
            opacity: dragHandleProps?.isDragging ? 0.6 : 1,
          }}
          align="center"
          justify="space-between">
          <Flex align="center" gap={2}>
            <Button
              icon={
                <span
                  style={{
                    display: 'inline-block',
                    transition: 'transform 200ms ease',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}>
                  <ChevronRightIcon />
                </span>
              }
              mode="ghost"
              onClick={() => setIsOpen((v) => !v)}
              style={{ cursor: 'pointer' }}
              aria-label={isOpen ? 'Zwiń cechę' : 'Rozwiń cechę'}
            />
            <InlineEditable
              value={feature.featureName}
              onChange={(val) => onChange({ ...feature, featureName: val })}
              placeholder="Nazwa cechy"
            />
          </Flex>
          <Flex gap={2}>
            {dragHandleProps && (
              <Button
                mode="bleed"
                text=""
                icon={DragHandleIcon}
                {...dragHandleProps.attributes}
                {...dragHandleProps.listeners}
                style={{ cursor: 'grab', minWidth: 'auto' }}
                title="Przeciągnij, aby zmienić kolejność"
              />
            )}
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

        <div
          style={{
            display: 'grid',
            gridTemplateRows: isOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 200ms ease',
          }}>
          <div style={{ overflow: 'hidden' }}>
            <Stack space={2}>
              <SortableList
                items={feature.options || []}
                getId={(opt, i) => opt._key || `${opt.value}-${i}`}
                getLabel={(opt) => opt.label}
                staticDuringDrag
                onReorder={(oldIndex, newIndex) => {
                  const reordered = arrayMove(
                    feature.options || [],
                    oldIndex,
                    newIndex
                  );
                  onChange({ ...feature, options: reordered });
                }}
                renderItem={({ item: opt, index: idx, handleProps }) => {
                  const isNumeric = Boolean(
                    opt.secondOption?.enabled &&
                      opt.secondOption?.kind === 'numeric'
                  );
                  const isChoice = Boolean(
                    opt.secondOption?.enabled &&
                      opt.secondOption?.kind === 'choice'
                  );

                  return (
                    <div>
                      <Card padding={2} tone="transparent" border>
                        <Stack space={2}>
                          <Flex align="center" justify="space-between" gap={6}>
                            <InlineEditable
                              value={opt.label}
                              onChange={(val) =>
                                updateOption(idx, { label: val })
                              }
                              placeholder="Nazwa wariantu"
                            />
                            <Flex
                              align="center"
                              gap={3}
                              style={{ minWidth: 0 }}>
                              {!isNumeric && (
                                <InlineEditable
                                  value={String(opt.basePriceModifier || 0)}
                                  onChange={(val) =>
                                    updateOption(idx, {
                                      basePriceModifier: parseInt(val) || 0,
                                    })
                                  }
                                  placeholder="0"
                                  type="number"
                                  suffix="zł"
                                  width={60}
                                  align="right"
                                />
                              )}
                              <Button
                                mode="bleed"
                                text=""
                                icon={DragHandleIcon}
                                {...handleProps.attributes}
                                {...handleProps.listeners}
                                style={{ cursor: 'grab', minWidth: 'auto' }}
                                title="Przeciągnij, aby zmienić kolejność"
                              />
                              <Button
                                icon={TrashIcon}
                                mode="ghost"
                                tone="critical"
                                onClick={() => removeOption(idx)}
                                style={{ cursor: 'pointer' }}
                              />
                            </Flex>
                          </Flex>

                          {isNumeric && (
                            <Flex gap={5} wrap="wrap" paddingTop={2}>
                              <Stack space={1}>
                                <Text
                                  size={1}
                                  muted
                                  style={{
                                    marginBottom: '8px',
                                    borderBottom:
                                      '1px solid var(--card-border-color)',
                                  }}>
                                  Etykieta pola
                                </Text>
                                <InlineEditable
                                  value={opt.secondOption?.numeric?.label || ''}
                                  onChange={(val) => {
                                    const numeric = {
                                      ...(opt.secondOption?.numeric || {}),
                                    };
                                    numeric.label = val;
                                    updateOption(idx, {
                                      secondOption: {
                                        ...opt.secondOption,
                                        numeric,
                                      },
                                    });
                                  }}
                                  placeholder="np. Długość"
                                  width={90}
                                  align="left"
                                />
                              </Stack>
                              <Stack space={1}>
                                <Text
                                  size={1}
                                  muted
                                  style={{
                                    marginBottom: '8px',
                                    borderBottom:
                                      '1px solid var(--card-border-color)',
                                  }}>
                                  Min
                                </Text>
                                <InlineEditable
                                  value={String(
                                    opt.secondOption?.numeric?.min ?? ''
                                  )}
                                  onChange={(val) => {
                                    const numeric = {
                                      ...(opt.secondOption?.numeric || {}),
                                    };
                                    numeric.min =
                                      val === '' ? undefined : parseFloat(val);
                                    updateOption(idx, {
                                      secondOption: {
                                        ...opt.secondOption,
                                        numeric,
                                      },
                                    });
                                  }}
                                  type="number"
                                  placeholder="0"
                                  width={70}
                                  align="right"
                                />
                              </Stack>
                              <Stack space={1}>
                                <Text
                                  size={1}
                                  muted
                                  style={{
                                    marginBottom: '8px',
                                    borderBottom:
                                      '1px solid var(--card-border-color)',
                                  }}>
                                  Max
                                </Text>
                                <InlineEditable
                                  value={String(
                                    opt.secondOption?.numeric?.max ?? ''
                                  )}
                                  onChange={(val) => {
                                    const numeric = {
                                      ...(opt.secondOption?.numeric || {}),
                                    };
                                    numeric.max =
                                      val === '' ? undefined : parseFloat(val);
                                    updateOption(idx, {
                                      secondOption: {
                                        ...opt.secondOption,
                                        numeric,
                                      },
                                    });
                                  }}
                                  type="number"
                                  placeholder="10"
                                  width={70}
                                  align="right"
                                />
                              </Stack>
                              <Stack space={1}>
                                <Text
                                  size={1}
                                  muted
                                  style={{
                                    marginBottom: '8px',
                                    borderBottom:
                                      '1px solid var(--card-border-color)',
                                  }}>
                                  Krok
                                </Text>
                                <InlineEditable
                                  value={String(
                                    opt.secondOption?.numeric?.step ?? ''
                                  )}
                                  onChange={(val) => {
                                    const numeric = {
                                      ...(opt.secondOption?.numeric || {}),
                                    };
                                    numeric.step =
                                      val === '' ? undefined : parseFloat(val);
                                    updateOption(idx, {
                                      secondOption: {
                                        ...opt.secondOption,
                                        numeric,
                                      },
                                    });
                                  }}
                                  type="number"
                                  placeholder="0.5"
                                  width={70}
                                  align="right"
                                />
                              </Stack>
                              <Stack space={1}>
                                <Text
                                  size={1}
                                  muted
                                  style={{
                                    marginBottom: '8px',
                                    borderBottom:
                                      '1px solid var(--card-border-color)',
                                  }}>
                                  Jednostka
                                </Text>
                                <InlineEditable
                                  value={opt.secondOption?.numeric?.unit || ''}
                                  onChange={(val) => {
                                    const numeric = {
                                      ...(opt.secondOption?.numeric || {}),
                                    };
                                    numeric.unit = val;
                                    updateOption(idx, {
                                      secondOption: {
                                        ...opt.secondOption,
                                        numeric,
                                      },
                                    });
                                  }}
                                  placeholder="m"
                                  width={60}
                                  align="right"
                                />
                              </Stack>
                              <Stack space={1}>
                                <Text
                                  size={1}
                                  muted
                                  style={{
                                    marginBottom: '8px',
                                    borderBottom:
                                      '1px solid var(--card-border-color)',
                                  }}>
                                  Cena bazowa
                                </Text>
                                <InlineEditable
                                  value={String(opt.basePriceModifier ?? '')}
                                  onChange={(val) => {
                                    updateOption(idx, {
                                      basePriceModifier:
                                        val === ''
                                          ? undefined
                                          : parseInt(val) || 0,
                                    });
                                  }}
                                  type="number"
                                  placeholder="0"
                                  suffix="zł"
                                  width={80}
                                  align="right"
                                />
                              </Stack>
                              <Stack space={1}>
                                <Text
                                  size={1}
                                  muted
                                  style={{
                                    marginBottom: '8px',
                                    borderBottom:
                                      '1px solid var(--card-border-color)',
                                  }}>
                                  Cena/jedn.
                                </Text>
                                <InlineEditable
                                  value={String(
                                    opt.secondOption?.numeric?.perUnitPrice ??
                                      ''
                                  )}
                                  onChange={(val) => {
                                    const numeric = {
                                      ...(opt.secondOption?.numeric || {}),
                                    };
                                    numeric.perUnitPrice =
                                      val === ''
                                        ? undefined
                                        : parseInt(val) || 0;
                                    updateOption(idx, {
                                      secondOption: {
                                        ...opt.secondOption,
                                        numeric,
                                      },
                                    });
                                  }}
                                  type="number"
                                  placeholder="0"
                                  suffix="zł"
                                  width={80}
                                  align="right"
                                />
                              </Stack>
                            </Flex>
                          )}

                          {isChoice && (
                            <Stack space={2}>
                              <Flex align="center" justify="flex-start" gap={3}>
                                <Text size={1} muted>
                                  Podrzędne opcje
                                </Text>
                                <label
                                  htmlFor={`optional-switch-${idx}`}
                                  style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    backgroundColor: 'var(--card-bg-color)',
                                    border:
                                      '1px solid var(--card-border-color)',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    transition: 'all 0.2s ease',
                                  }}>
                                  <Text
                                    size={1}
                                    weight="medium"
                                    style={{ color: 'var(--text-color)' }}>
                                    Opcjonalne
                                  </Text>
                                  <Switch
                                    id={`optional-switch-${idx}`}
                                    checked={Boolean(
                                      opt.secondOption?.optional
                                    )}
                                    onChange={(e) => {
                                      const next = {
                                        ...(opt.secondOption || {}),
                                      };
                                      next.optional = e.currentTarget.checked;
                                      updateOption(idx, {
                                        secondOption: next,
                                      });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </label>
                              </Flex>
                              {opt.secondOption?.optional && (
                                <Flex
                                  align="center"
                                  gap={3}
                                  style={{
                                    backgroundColor:
                                      'var(--card-bg-color-critical)',
                                    border:
                                      '1px solid var(--card-border-color-critical)',
                                    borderRadius: '8px',
                                    padding: '4px 0px',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                  }}>
                                  <Text
                                    size={1}
                                    weight="semibold"
                                    style={{
                                      minWidth: 'fit-content',
                                      color: 'var(--text-color-critical)',
                                      fontFamily: 'var(--font-family-mono)',
                                    }}>
                                    Symbol zastępczy
                                  </Text>
                                  <TextInput
                                    value={opt.secondOption?.placeholder || ''}
                                    onChange={(e) => {
                                      const next = {
                                        ...(opt.secondOption || {}),
                                      };
                                      next.placeholder = e.currentTarget.value;
                                      updateOption(idx, {
                                        secondOption: next,
                                      });
                                    }}
                                    placeholder="np. Wybierz opcję"
                                    style={{
                                      maxWidth: '160px',
                                      width: '160px',
                                      flexShrink: 0,
                                      backgroundColor: 'var(--card-bg-color)',
                                      borderRadius: '4px',
                                      border:
                                        '1px solid var(--card-border-color)',
                                      padding: '4px 8px',
                                      fontSize: '13px',
                                    }}
                                  />
                                </Flex>
                              )}
                              {(opt.secondOption?.choices || []).length > 0 && (
                                <Card
                                  padding={2}
                                  tone="transparent"
                                  style={{
                                    borderLeft:
                                      '2px solid var(--card-border-color)',
                                    paddingLeft: 8,
                                    marginLeft: 4,
                                  }}>
                                  <SortableList
                                    items={opt.secondOption?.choices || []}
                                    getId={(choice, index) =>
                                      choice.value || `choice-${index}`
                                    }
                                    getLabel={(choice) => choice.label}
                                    staticDuringDrag
                                    onReorder={(oldIndex, newIndex) => {
                                      const choices = [
                                        ...(opt.secondOption?.choices || []),
                                      ];
                                      const [removed] = choices.splice(
                                        oldIndex,
                                        1
                                      );
                                      choices.splice(newIndex, 0, removed);
                                      updateOption(idx, {
                                        secondOption: {
                                          ...opt.secondOption,
                                          choices,
                                        },
                                      });
                                    }}
                                    renderItem={({
                                      item: choice,
                                      index: cIdx,
                                      handleProps,
                                    }) => (
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          backgroundColor:
                                            'var(--card-bg-color)',
                                        }}>
                                        <Button
                                          mode="bleed"
                                          text=""
                                          icon={DragHandleIcon}
                                          {...handleProps.attributes}
                                          {...handleProps.listeners}
                                          style={{
                                            cursor: 'grab',
                                            minWidth: 'auto',
                                          }}
                                          title="Przeciągnij, aby zmienić kolejność"
                                        />
                                        <div
                                          style={{
                                            flex: 1,
                                            minWidth: 160,
                                          }}>
                                          <InlineEditable
                                            value={choice.label}
                                            onChange={(val) => {
                                              const choices = [
                                                ...(opt.secondOption?.choices ||
                                                  []),
                                              ];
                                              choices[cIdx] = {
                                                ...choices[cIdx],
                                                label: val,
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
                                        </div>
                                        <div
                                          style={{
                                            flexShrink: 0,
                                            marginRight: '10px',
                                          }}>
                                          <InlineEditable
                                            value={String(choice.price ?? 0)}
                                            onChange={(val) => {
                                              const choices = [
                                                ...(opt.secondOption?.choices ||
                                                  []),
                                              ];
                                              choices[cIdx] = {
                                                ...choices[cIdx],
                                                price: parseInt(val) || 0,
                                              };
                                              updateOption(idx, {
                                                secondOption: {
                                                  ...opt.secondOption,
                                                  choices,
                                                },
                                              });
                                            }}
                                            placeholder="0"
                                            type="number"
                                            suffix="zł"
                                            width={72}
                                            align="right"
                                          />
                                        </div>
                                        <Button
                                          icon={TrashIcon}
                                          mode="ghost"
                                          tone="critical"
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
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
                                          style={{
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                          }}
                                        />
                                      </div>
                                    )}
                                  />
                                </Card>
                              )}
                              <Button
                                text="Dodaj podrzędną opcję"
                                mode="ghost"
                                icon={AddIcon}
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
                                    secondOption: {
                                      ...opt.secondOption,
                                      choices,
                                    },
                                  });
                                }}
                                style={{
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  alignSelf: 'flex-start',
                                  maxWidth: 'max-content',
                                  width: 'auto',
                                  ...((opt.secondOption?.choices || []).length >
                                  0
                                    ? { marginLeft: 4 }
                                    : {}),
                                }}
                              />
                            </Stack>
                          )}
                        </Stack>
                      </Card>
                    </div>
                  );
                }}
              />
            </Stack>
          </div>
        </div>
      </Stack>

      <VariantTypeDialog
        open={showVariantDialog}
        onClose={() => setShowVariantDialog(false)}
        onConfirm={(kind, name, addGlobally) => {
          setShowVariantDialog(false);
          addOption(kind, name, addGlobally);
        }}
        showGlobalOption={showGlobalOption}
      />
    </Card>
  );
}
