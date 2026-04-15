'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CompletePricingData,
  PricingOptionGroupWithDetails,
  PricingSelection,
} from '@/src/global/supabase/types';
import { formatPrice } from '@/src/global/utils';

import styles from './CartLineConfigurator.module.scss';

export interface ConfigurationOptionData {
  label: string;
  value: string;
  priceDelta: number;
}

export interface ConfigurationData {
  basePrice: number;
  options: ConfigurationOptionData[];
  totalPrice: number;
}

type SelectionSeed = Pick<PricingSelection, 'variantId' | 'selectedOptions'>;

type CartLineConfiguratorProps = {
  pricingData: CompletePricingData;
  initialSelection?: SelectionSeed | null;
  onSelectionChange?: (
    selection: PricingSelection,
    configData: ConfigurationData,
  ) => void;
};

type SelectOption = {
  id: string;
  name: string;
  badgeText?: string;
  price?: number;
  triggerText?: string;
};

function createConfiguratorSelectionState(
  pricingData: CompletePricingData,
  initialSelection?: SelectionSeed | null,
): PricingSelection {
  const firstVariant = pricingData.variants[0];

  if (!firstVariant) {
    return {
      variantId: null,
      selectedOptions: {},
      calculatedPrice: pricingData.lowestPrice,
    };
  }

  const selectedVariant =
    (initialSelection?.variantId
      ? pricingData.variants.find(
          (variant) => variant.id === initialSelection.variantId,
        )
      : null) ?? firstVariant;

  const validGroupIds = new Set(
    selectedVariant.groups.map((group) => group.id),
  );
  const selectedOptions = Object.fromEntries(
    Object.entries(initialSelection?.selectedOptions ?? {}).filter(
      ([groupId]) => validGroupIds.has(groupId),
    ),
  );

  return {
    variantId: selectedVariant.id,
    selectedOptions,
    calculatedPrice: selectedVariant.base_price_cents,
  };
}

function calculateNumericPriceDelta(
  group: PricingOptionGroupWithDetails & {
    numeric_rule: NonNullable<PricingOptionGroupWithDetails['numeric_rule']>;
  },
  value: string,
): number {
  const numericValue = parseFloat(value);

  if (Number.isNaN(numericValue)) {
    return 0;
  }

  const stepsAboveBase =
    (numericValue - group.numeric_rule.base_included_value) /
    group.numeric_rule.step_value;

  if (stepsAboveBase <= 0) {
    return 0;
  }

  return Math.ceil(stepsAboveBase) * group.numeric_rule.price_per_step_cents;
}

interface NumericOptionEditorProps {
  group: PricingOptionGroupWithDetails & {
    numeric_rule: NonNullable<PricingOptionGroupWithDetails['numeric_rule']>;
  };
  currentValue: number;
  isNested: boolean;
  onChange: (groupId: string, value: string) => void;
}

function NumericOptionEditor({
  group,
  currentValue,
  isNested,
  onChange,
}: NumericOptionEditorProps) {
  const [inputValue, setInputValue] = useState(String(currentValue));

  useEffect(() => {
    setInputValue(String(currentValue));
  }, [currentValue]);

  const progressPercent =
    ((currentValue - group.numeric_rule.min_value) /
      (group.numeric_rule.max_value - group.numeric_rule.min_value)) *
    100;

  const currentPriceDelta = calculateNumericPriceDelta(
    group,
    String(currentValue),
  );

  const roundToStep = (value: number): number => {
    const steps = Math.round(
      (value - group.numeric_rule.min_value) / group.numeric_rule.step_value,
    );
    return group.numeric_rule.min_value + steps * group.numeric_rule.step_value;
  };

  const isValidIncrement = (value: number): boolean => {
    if (
      value < group.numeric_rule.min_value ||
      value > group.numeric_rule.max_value
    ) {
      return false;
    }

    const steps =
      (value - group.numeric_rule.min_value) / group.numeric_rule.step_value;
    const remainder = Math.abs(steps - Math.round(steps));

    return remainder < 0.0001;
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(',', '.');

    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setInputValue(value);

      const numericValue = parseFloat(value);
      if (!Number.isNaN(numericValue) && isValidIncrement(numericValue)) {
        const preciseValue = Math.round(numericValue * 100) / 100;
        onChange(group.id, String(preciseValue));
      }
    }
  };

  const handleInputBlur = () => {
    const numericValue = parseFloat(inputValue);

    if (Number.isNaN(numericValue) || inputValue === '') {
      setInputValue(String(currentValue));
      return;
    }

    let clampedValue = Math.max(
      group.numeric_rule.min_value,
      Math.min(group.numeric_rule.max_value, numericValue),
    );

    clampedValue = roundToStep(clampedValue);
    clampedValue = Math.round(clampedValue * 100) / 100;

    setInputValue(String(clampedValue));
    onChange(group.id, String(clampedValue));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  return (
    <div
      className={`${styles.fieldGroup} ${isNested ? styles.fieldGroupNested : ''}`}
    >
      <label className={styles.fieldLabel} htmlFor={`numeric-${group.id}`}>
        {group.name}
      </label>
      <div className={styles.numericEditor}>
        <div className={styles.numericHeader}>
          <span className={styles.numericValue}>
            {currentValue} {group.unit || 'm'}
          </span>
          {currentPriceDelta > 0 ? (
            <span className={styles.priceBadge}>
              +{formatPrice(currentPriceDelta)}
            </span>
          ) : null}
        </div>

        <div className={styles.numericSliderContainer}>
          <div className={styles.numericSliderTrack}>
            <div
              className={styles.numericSliderProgress}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            id={`numeric-${group.id}`}
            className={styles.numericSliderInput}
            min={group.numeric_rule.min_value}
            max={group.numeric_rule.max_value}
            step={group.numeric_rule.step_value}
            value={currentValue}
            onChange={(event) => onChange(group.id, event.target.value)}
            aria-label={group.name}
          />
        </div>

        <label className={styles.numericValueWrapper}>
          <input
            type="text"
            inputMode="decimal"
            className={styles.numericValueInput}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            aria-label={`${group.name} wartość`}
          />
          <span className={styles.numericUnit}>{group.unit || 'm'}</span>
        </label>
      </div>
    </div>
  );
}

export default function CartLineConfigurator({
  pricingData,
  initialSelection = null,
  onSelectionChange,
}: CartLineConfiguratorProps) {
  const initialSelectionVariantId = initialSelection?.variantId ?? null;
  const initialSelectionOptionsKey = JSON.stringify(
    initialSelection?.selectedOptions ?? {},
  );
  const resolvedInitialSelection = useMemo(
    () =>
      createConfiguratorSelectionState(pricingData, {
        variantId: initialSelectionVariantId,
        selectedOptions: JSON.parse(initialSelectionOptionsKey) as Record<
          string,
          string
        >,
      }),
    [initialSelectionOptionsKey, initialSelectionVariantId, pricingData],
  );

  const [selection, setSelection] = useState<PricingSelection>(
    resolvedInitialSelection,
  );
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    setSelection(resolvedInitialSelection);
    setOpenSectionId(null);
  }, [resolvedInitialSelection]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const allSections = Array.from(sectionRefs.current.values());
      const clickedInside = allSections.some((section) =>
        section.contains(event.target as Node),
      );

      if (!clickedInside) {
        setOpenSectionId(null);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const relatedTarget = event.relatedTarget as Node | null;

      if (!relatedTarget) {
        setOpenSectionId(null);
        return;
      }

      const currentSection = openSectionId
        ? sectionRefs.current.get(openSectionId)
        : null;

      if (currentSection && !currentSection.contains(relatedTarget)) {
        setOpenSectionId(null);
      }
    };

    if (openSectionId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('focusout', handleFocusOut);
      };
    }
  }, [openSectionId]);

  const selectedVariant = useMemo(() => {
    if (!selection.variantId) {
      return null;
    }

    return (
      pricingData.variants.find(
        (variant) => variant.id === selection.variantId,
      ) ?? null
    );
  }, [pricingData.variants, selection.variantId]);

  const calculatedPrice = useMemo(() => {
    if (!selectedVariant) {
      return pricingData.lowestPrice;
    }

    let totalPrice = selectedVariant.base_price_cents;

    selectedVariant.groups.forEach((group) => {
      const selectedValue = selection.selectedOptions[group.id];
      if (!selectedValue) {
        return;
      }

      if (group.input_type === 'select') {
        const value = group.values.find(
          (option) => option.id === selectedValue,
        );

        if (value) {
          totalPrice += value.price_delta_cents;
        }
      } else if (group.input_type === 'numeric_step' && group.numeric_rule) {
        totalPrice += calculateNumericPriceDelta(
          group as PricingOptionGroupWithDetails & {
            numeric_rule: NonNullable<
              PricingOptionGroupWithDetails['numeric_rule']
            >;
          },
          selectedValue,
        );
      }
    });

    return totalPrice;
  }, [pricingData.lowestPrice, selectedVariant, selection.selectedOptions]);

  useEffect(() => {
    setSelection((previousSelection) => ({
      ...previousSelection,
      calculatedPrice,
    }));
  }, [calculatedPrice]);

  const buildConfigurationData = (): ConfigurationData => {
    if (!selectedVariant) {
      return {
        basePrice: pricingData.lowestPrice,
        options: [],
        totalPrice: pricingData.lowestPrice,
      };
    }

    const options: ConfigurationOptionData[] = [];

    if (pricingData.hasMultipleModels && selectedVariant.model) {
      options.push({
        label: 'Model',
        value: selectedVariant.model,
        priceDelta: 0,
      });
    }

    selectedVariant.groups.forEach((group) => {
      const selectedValue = selection.selectedOptions[group.id];
      if (!selectedValue) {
        return;
      }

      if (group.input_type === 'select') {
        const value = group.values.find(
          (option) => option.id === selectedValue,
        );

        if (value) {
          options.push({
            label: group.name,
            value: value.name,
            priceDelta: value.price_delta_cents,
          });
        }
      } else if (group.input_type === 'numeric_step' && group.numeric_rule) {
        options.push({
          label: group.name,
          value: `${selectedValue} ${group.unit || 'm'}`,
          priceDelta: calculateNumericPriceDelta(
            group as PricingOptionGroupWithDetails & {
              numeric_rule: NonNullable<
                PricingOptionGroupWithDetails['numeric_rule']
              >;
            },
            selectedValue,
          ),
        });
      }
    });

    return {
      basePrice: selectedVariant.base_price_cents,
      options,
      totalPrice: calculatedPrice,
    };
  };

  useEffect(() => {
    if (onSelectionChange && selection.variantId) {
      onSelectionChange(
        {
          ...selection,
          calculatedPrice,
        },
        buildConfigurationData(),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedPrice, onSelectionChange, selection]);

  useEffect(() => {
    if (!selectedVariant) {
      return;
    }

    const updates: Record<string, string> = {};
    const removals: string[] = [];
    let hasChanges = false;

    selectedVariant.groups.forEach((group) => {
      if (group.parent_value_id) {
        const parentSelected = Object.values(
          selection.selectedOptions,
        ).includes(group.parent_value_id);

        if (!parentSelected && selection.selectedOptions[group.id]) {
          removals.push(group.id);
          hasChanges = true;
          return;
        }

        if (parentSelected && !selection.selectedOptions[group.id]) {
          if (group.input_type === 'select' && group.values.length > 0) {
            updates[group.id] = group.values[0]!.id;
            hasChanges = true;
          } else if (
            group.input_type === 'numeric_step' &&
            group.numeric_rule
          ) {
            updates[group.id] = String(group.numeric_rule.min_value);
            hasChanges = true;
          }
        }

        return;
      }

      if (
        group.input_type === 'select' &&
        group.values.length > 0 &&
        !selection.selectedOptions[group.id]
      ) {
        updates[group.id] = group.values[0]!.id;
        hasChanges = true;
      } else if (
        group.input_type === 'numeric_step' &&
        group.numeric_rule &&
        !selection.selectedOptions[group.id]
      ) {
        updates[group.id] = String(group.numeric_rule.min_value);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setSelection((previousSelection) => {
        const nextSelectedOptions = {
          ...previousSelection.selectedOptions,
          ...updates,
        };

        removals.forEach((key) => {
          delete nextSelectedOptions[key];
        });

        return {
          ...previousSelection,
          selectedOptions: nextSelectedOptions,
        };
      });
    }
  }, [selectedVariant, selection.selectedOptions]);

  const handleModelChange = (variantId: string) => {
    setSelection({
      variantId,
      selectedOptions: {},
      calculatedPrice:
        pricingData.variants.find((variant) => variant.id === variantId)
          ?.base_price_cents ?? pricingData.lowestPrice,
    });
  };

  const handleOptionChange = (groupId: string, valueIdOrNumeric: string) => {
    setSelection((previousSelection) => ({
      ...previousSelection,
      selectedOptions: {
        ...previousSelection.selectedOptions,
        [groupId]: valueIdOrNumeric,
      },
    }));
  };

  const topLevelGroups = useMemo(() => {
    if (!selectedVariant) {
      return [];
    }

    return selectedVariant.groups.filter((group) => !group.parent_value_id);
  }, [selectedVariant]);

  const getChildGroups = (parentValueId: string) => {
    if (!selectedVariant) {
      return [];
    }

    return selectedVariant.groups.filter(
      (group) => group.parent_value_id === parentValueId,
    );
  };

  const renderSelectField = (
    id: string,
    label: string,
    value: string,
    options: SelectOption[],
    onChange: (nextValue: string) => void,
    isNested = false,
  ): React.ReactNode => {
    const isOpen = openSectionId === id;
    const selectedOption = options.find((option) => option.id === value);
    const displayValue =
      selectedOption?.triggerText ?? selectedOption?.name ?? label;
    const displayBadge =
      selectedOption?.badgeText ??
      (selectedOption?.price && selectedOption.price > 0
        ? `+${formatPrice(selectedOption.price)}`
        : null);

    return (
      <div
        className={`${styles.fieldGroup} ${isNested ? styles.fieldGroupNested : ''}`}
        ref={(element) => {
          if (element) {
            sectionRefs.current.set(id, element);
          } else {
            sectionRefs.current.delete(id);
          }
        }}
      >
        <label className={styles.fieldLabel}>{label}</label>
        <div
          className={styles.selectField}
          data-open={isOpen ? 'true' : 'false'}
        >
          <button
            type="button"
            className={styles.selectTrigger}
            onClick={() => setOpenSectionId(isOpen ? null : id)}
            aria-expanded={isOpen}
            aria-controls={`${id}-options`}
          >
            <span className={styles.selectValue}>{displayValue}</span>
            <span className={styles.selectMeta}>
              {displayBadge ? (
                <span className={styles.priceBadge}>{displayBadge}</span>
              ) : null}
              <ChevronIcon className={styles.chevron ?? ''} isOpen={isOpen} />
            </span>
          </button>

          {isOpen ? (
            <div id={`${id}-options`} className={styles.selectOptions}>
              {options.map((option) => {
                const isSelected = option.id === value;
                const optionBadge =
                  option.badgeText ??
                  (option.price && option.price > 0
                    ? `+${formatPrice(option.price)}`
                    : null);

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.selectOptionButton} ${
                      isSelected ? styles.selectOptionButtonSelected : ''
                    }`}
                    onClick={() => {
                      onChange(option.id);
                      setOpenSectionId(null);
                    }}
                  >
                    <span className={styles.selectOptionLabel}>
                      {option.name}
                    </span>
                    <span className={styles.selectOptionMeta}>
                      {optionBadge ? (
                        <span className={styles.selectOptionPrice}>
                          {optionBadge}
                        </span>
                      ) : null}
                      {isSelected ? (
                        <CheckIcon className={styles.checkIcon ?? ''} />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderGroup = (
    group: PricingOptionGroupWithDetails,
    isNested = false,
  ): React.ReactNode => {
    if (group.input_type === 'select') {
      return renderSelectGroup(group, isNested);
    }

    if (group.input_type === 'numeric_step' && group.numeric_rule) {
      const selectedValue = selection.selectedOptions[group.id];
      const currentValue = selectedValue
        ? parseFloat(selectedValue)
        : group.numeric_rule.min_value;

      return (
        <NumericOptionEditor
          key={group.id}
          group={
            group as PricingOptionGroupWithDetails & {
              numeric_rule: NonNullable<
                PricingOptionGroupWithDetails['numeric_rule']
              >;
            }
          }
          currentValue={currentValue}
          isNested={isNested}
          onChange={handleOptionChange}
        />
      );
    }

    return null;
  };

  const renderSelectGroup = (
    group: PricingOptionGroupWithDetails,
    isNested = false,
  ): React.ReactNode => {
    const selectedValue = selection.selectedOptions[group.id];
    const childGroups = selectedValue ? getChildGroups(selectedValue) : [];

    const options = group.values.map((value) => {
      let badgeText: string | undefined;

      if (selectedVariant) {
        const childNumericGroup = selectedVariant.groups.find(
          (candidateGroup) =>
            candidateGroup.parent_value_id === value.id &&
            candidateGroup.input_type === 'numeric_step' &&
            candidateGroup.numeric_rule,
        );

        if (childNumericGroup?.numeric_rule) {
          const rule = childNumericGroup.numeric_rule;
          badgeText = `+${formatPrice(rule.price_per_step_cents)}/${rule.step_value} ${childNumericGroup.unit || 'm'}`;
        }
      }

      return {
        id: value.id,
        name: value.name,
        price: value.price_delta_cents,
        badgeText,
      };
    });

    return (
      <Fragment key={group.id}>
        {renderSelectField(
          `option-${group.id}`,
          group.name,
          selectedValue ?? '',
          options,
          (nextValue) => handleOptionChange(group.id, nextValue),
          isNested,
        )}
        {selectedValue
          ? childGroups.map((childGroup) => renderGroup(childGroup, true))
          : null}
      </Fragment>
    );
  };

  return (
    <div
      className={styles.cartConfigurator}
      data-testid="cart-line-configurator"
    >
      {pricingData.hasMultipleModels
        ? renderSelectField(
            'model-select',
            'Model',
            selection.variantId ?? '',
            pricingData.variants.map((variant) => ({
              id: variant.id,
              name: variant.model || variant.product,
              badgeText: formatPrice(variant.base_price_cents),
              triggerText: `${variant.model || variant.product} (${formatPrice(
                variant.base_price_cents,
              )})`,
            })),
            handleModelChange,
          )
        : null}

      {selectedVariant
        ? topLevelGroups.map((group) => renderGroup(group))
        : null}
    </div>
  );
}

function ChevronIcon({
  className,
  isOpen,
}: {
  className: string;
  isOpen: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M6 9l6 6 6-6"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
