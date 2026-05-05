'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildStandardConfigurationData,
  calculateStandardConfigurationNumericPriceDelta,
  createStandardConfigurationSelectionState,
  getStandardConfigurationChildGroups,
  getStandardConfigurationTopLevelGroups,
  resolveStandardConfigurationVariant,
  settleStandardConfigurationSelection,
  type StandardConfigurationData,
  type StandardConfigurationSelectionSeed,
} from '@/src/global/b2c/configuration/standard-configuration';
import type {
  CompletePricingData,
  PricingOptionGroupWithDetails,
  PricingSelection,
} from '@/src/global/supabase/types';
import { formatPrice } from '@/src/global/utils';

import styles from './CartLineConfigurator.module.scss';

export type ConfigurationData = StandardConfigurationData;

type CartLineConfiguratorProps = {
  pricingData: CompletePricingData;
  initialSelection?: StandardConfigurationSelectionSeed | null;
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

  const currentPriceDelta = calculateStandardConfigurationNumericPriceDelta(
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
      createStandardConfigurationSelectionState(pricingData, {
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
    return resolveStandardConfigurationVariant(
      pricingData,
      selection.variantId,
    );
  }, [pricingData, selection.variantId]);

  const configData = useMemo(
    () => buildStandardConfigurationData(pricingData, selection),
    [pricingData, selection],
  );

  useEffect(() => {
    if (onSelectionChange && selection.variantId) {
      onSelectionChange(selection, configData);
    }
  }, [configData, onSelectionChange, selection]);

  const handleModelChange = (variantId: string) => {
    setSelection(
      createStandardConfigurationSelectionState(pricingData, {
        variantId,
        selectedOptions: {},
      }),
    );
  };

  const handleOptionChange = (groupId: string, valueIdOrNumeric: string) => {
    setSelection((previousSelection) =>
      settleStandardConfigurationSelection(pricingData, {
        variantId: previousSelection.variantId,
        selectedOptions: {
          ...previousSelection.selectedOptions,
          [groupId]: valueIdOrNumeric,
        },
      }),
    );
  };

  const topLevelGroups = useMemo(() => {
    return getStandardConfigurationTopLevelGroups(selectedVariant);
  }, [selectedVariant]);

  const getChildGroups = (parentValueId: string) => {
    return getStandardConfigurationChildGroups(selectedVariant, parentValueId);
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
