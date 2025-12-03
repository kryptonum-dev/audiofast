'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CompletePricingData,
  PricingOptionGroupWithDetails,
  PricingSelection,
} from '@/src/global/supabase/types';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

interface PricingConfiguratorProps {
  pricingData: CompletePricingData;
}

interface NumericOptionProps {
  group: PricingOptionGroupWithDetails & {
    numeric_rule: NonNullable<PricingOptionGroupWithDetails['numeric_rule']>;
  };
  currentValue: number;
  onChange: (groupId: string, value: string) => void;
  formatPrice: (priceCents: number) => string;
}

function NumericOption({ group, currentValue, onChange }: NumericOptionProps) {
  // Local state for text input (allows free typing like "1.7")
  const [inputValue, setInputValue] = useState(String(currentValue));

  // Update input value when selection changes (e.g., from slider)
  useEffect(() => {
    setInputValue(String(currentValue));
  }, [currentValue]);

  const rule = group.numeric_rule;

  // Calculate progress percentage for visual feedback
  const progressPercent =
    ((currentValue - rule!.min_value) / (rule!.max_value - rule!.min_value)) *
    100;

  // Round to nearest step increment
  const roundToStep = (value: number): number => {
    const steps = Math.round((value - rule!.min_value) / rule!.step_value);
    return rule!.min_value + steps * rule!.step_value;
  };

  // Check if a value is a valid increment (no rounding needed)
  const isValidIncrement = (value: number): boolean => {
    if (value < rule!.min_value || value > rule!.max_value) return false;

    // Calculate how many steps from min
    const steps = (value - rule!.min_value) / rule!.step_value;

    // Check if it's a whole number of steps (accounting for floating point errors)
    const remainder = Math.abs(steps - Math.round(steps));
    return remainder < 0.0001; // Tolerance for floating point precision
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow free typing, including partial values like "1."
    const value = e.target.value.replace(',', '.');

    // Allow empty, numbers, and single decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setInputValue(value);

      // If the typed value is a valid number and a valid increment, update immediately
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && isValidIncrement(numValue)) {
        // Ensure precision to avoid floating point errors
        const preciseValue = Math.round(numValue * 100) / 100;
        onChange(group.id, String(preciseValue));
      }
    }
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(inputValue);

    if (isNaN(numValue) || inputValue === '') {
      // Reset to current value if invalid
      setInputValue(String(currentValue));
      return;
    }

    // Clamp between min and max
    let clampedValue = Math.max(
      rule!.min_value,
      Math.min(rule!.max_value, numValue),
    );

    // Round to nearest step
    clampedValue = roundToStep(clampedValue);

    // Ensure precision (avoid floating point errors)
    clampedValue = Math.round(clampedValue * 100) / 100;

    // Update selection and input
    setInputValue(String(clampedValue));
    onChange(group.id, String(clampedValue));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // Trigger blur on Enter
    }
  };

  return (
    <div key={group.id} className={styles.optionGroup}>
      <label className={styles.optionLabel} htmlFor={`option-${group.id}`}>
        {group.name}
      </label>

      <div className={styles.numericSliderContainer}>
        <div className={styles.numericSliderTrack}>
          <div
            className={styles.numericSliderProgress}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <input
          type="range"
          id={`option-${group.id}`}
          className={styles.numericSliderInput}
          min={rule.min_value}
          max={rule.max_value}
          step={rule.step_value}
          value={currentValue}
          onChange={(e) => onChange(group.id, e.target.value)}
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
  );
}

export default function PricingConfigurator({
  pricingData,
}: PricingConfiguratorProps) {
  // State for user selections
  const [selection, setSelection] = useState<PricingSelection>({
    variantId: null,
    selectedOptions: {},
    calculatedPrice: 0,
  });

  // State for dropdown management
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Initialize with first variant (always select the first one by default)
  useEffect(() => {
    if (pricingData.variants.length > 0 && !selection.variantId) {
      const firstVariant = pricingData.variants[0];
      setSelection((prev) => ({
        ...prev,
        variantId: firstVariant?.id || null,
        calculatedPrice: firstVariant?.base_price_cents || 0,
      }));
    }
  }, [pricingData, selection.variantId]);

  // Close dropdown when clicking outside or tabbing out
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const allDropdowns = Array.from(dropdownRefs.current.values());
      const clickedInside = allDropdowns.some((dropdown) =>
        dropdown.contains(event.target as Node),
      );

      if (!clickedInside) {
        setOpenDropdown(null);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      // Check if the new focus target is outside the currently open dropdown
      const relatedTarget = event.relatedTarget as Node | null;
      if (!relatedTarget) {
        setOpenDropdown(null);
        return;
      }

      // Get only the currently open dropdown element
      const currentDropdown = openDropdown
        ? dropdownRefs.current.get(openDropdown)
        : null;

      // If focus moved outside the current dropdown, close it
      if (currentDropdown && !currentDropdown.contains(relatedTarget)) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('focusout', handleFocusOut);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('focusout', handleFocusOut);
      };
    }
  }, [openDropdown]);

  // Get currently selected variant
  const selectedVariant = useMemo(() => {
    if (!selection.variantId) return null;
    return (
      pricingData.variants.find((v) => v.id === selection.variantId) || null
    );
  }, [selection.variantId, pricingData.variants]);

  // Calculate price based on selections
  const calculatePrice = useMemo(() => {
    if (!selectedVariant) {
      return pricingData.lowestPrice;
    }

    let totalPrice = selectedVariant.base_price_cents;

    // Add price deltas from selected options
    selectedVariant.groups.forEach((group) => {
      const selectedValue = selection.selectedOptions[group.id];
      if (!selectedValue) return;

      if (group.input_type === 'select') {
        // Find the value and add its price delta
        const value = group.values.find((v) => v.id === selectedValue);
        if (value) {
          totalPrice += value.price_delta_cents;
        }
      } else if (group.input_type === 'numeric_step' && group.numeric_rule) {
        // Calculate price based on numeric value
        const numericValue = parseFloat(selectedValue);
        if (!isNaN(numericValue)) {
          const stepsAboveBase =
            (numericValue - group.numeric_rule.base_included_value) /
            group.numeric_rule.step_value;
          if (stepsAboveBase > 0) {
            totalPrice +=
              Math.ceil(stepsAboveBase) *
              group.numeric_rule.price_per_step_cents;
          }
        }
      }
    });

    return totalPrice;
  }, [selectedVariant, selection.selectedOptions, pricingData.lowestPrice]);

  // Update calculated price when dependencies change
  useEffect(() => {
    setSelection((prev) => ({
      ...prev,
      calculatedPrice: calculatePrice,
    }));
  }, [calculatePrice]);

  // Auto-select first values for all groups that don't have a selection
  // AND clean up orphaned child selections when parent value changes
  useEffect(() => {
    if (!selectedVariant) return;

    const updates: Record<string, string> = {};
    const removals: string[] = [];
    let hasChanges = false;

    // Check all groups (including nested ones)
    selectedVariant.groups.forEach((group) => {
      // Check if this is a child group with a parent_value_id
      if (group.parent_value_id) {
        const parentSelected = Object.values(
          selection.selectedOptions,
        ).includes(group.parent_value_id);

        // If parent is no longer selected, remove this child's selection
        if (!parentSelected && selection.selectedOptions[group.id]) {
          removals.push(group.id);
          hasChanges = true;
          return;
        }

        // If parent IS selected and child has no selection, auto-select first option
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
      } else {
        // Top-level group without parent
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
      }
    });

    if (hasChanges) {
      setSelection((prev) => {
        const newOptions = { ...prev.selectedOptions, ...updates };
        // Remove orphaned child selections
        removals.forEach((key) => {
          delete newOptions[key];
        });
        return {
          ...prev,
          selectedOptions: newOptions,
        };
      });
    }
  }, [selectedVariant, selection.selectedOptions]);

  // Handler for model selection
  const handleModelChange = (variantId: string) => {
    setSelection({
      variantId,
      selectedOptions: {}, // Reset options when model changes
      calculatedPrice:
        pricingData.variants.find((v) => v.id === variantId)
          ?.base_price_cents || 0,
    });
  };

  // Handler for option selection
  const handleOptionChange = (groupId: string, valueIdOrNumeric: string) => {
    setSelection((prev) => ({
      ...prev,
      selectedOptions: {
        ...prev.selectedOptions,
        [groupId]: valueIdOrNumeric,
      },
    }));
  };

  // Filter top-level groups (no parent)
  const topLevelGroups = useMemo(() => {
    if (!selectedVariant) return [];
    return selectedVariant.groups.filter((g) => !g.parent_value_id);
  }, [selectedVariant]);

  // Get child groups for a specific parent value
  const getChildGroups = (parentValueId: string) => {
    if (!selectedVariant) return [];
    return selectedVariant.groups.filter(
      (g) => g.parent_value_id === parentValueId,
    );
  };

  // Reusable custom dropdown component
  const renderCustomDropdown = (
    id: string,
    label: string,
    value: string,
    options: Array<{
      id: string;
      name: string;
      price?: number;
      priceText?: string;
    }>,
    onChange: (value: string) => void,
  ): React.ReactNode => {
    const isOpen = openDropdown === id;
    const selectedOption = options.find((opt) => opt.id === value);
    const displayValue = selectedOption ? selectedOption.name : label;

    return (
      <div
        className={styles.optionGroup}
        ref={(el) => {
          if (el) dropdownRefs.current.set(id, el);
        }}
      >
        <label className={styles.optionLabel}>{label}</label>
        <div className={styles.dropdown}>
          <button
            type="button"
            className={`${styles.trigger} ${value ? styles.active : ''}`}
            onClick={() => setOpenDropdown(isOpen ? null : id)}
            aria-expanded={isOpen}
            aria-label={`${label}: ${displayValue}`}
          >
            <span className={styles.selectedValue}>{displayValue}</span>
            <div className={styles.priceTagContainer}>
              {selectedOption?.priceText ? (
                <span className={styles.priceTag}>
                  {selectedOption.priceText}
                </span>
              ) : (
                !!selectedOption?.price &&
                selectedOption.price > 0 && (
                  <span className={styles.priceTag}>
                    +{formatPrice(selectedOption.price)}
                  </span>
                )
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                className={styles.chevron}
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                }}
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 9l6 6 6-6"
                />
              </svg>
            </div>
          </button>

          {isOpen && (
            <div className={styles.menu}>
              {options.map((option) => {
                const isSelected = value === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.item} ${isSelected ? styles.selected : ''}`}
                    onClick={() => {
                      onChange(option.id);
                      setOpenDropdown(null);
                    }}
                  >
                    <span>{option.name}</span>
                    <div className={styles.itemRight}>
                      {option.priceText ? (
                        <span className={styles.itemPrice}>
                          {option.priceText}
                        </span>
                      ) : (
                        option.price !== undefined && (
                          <span className={styles.itemPrice}>
                            {option.price > 0 ? '+' : ''}
                            {formatPrice(option.price)}
                          </span>
                        )
                      )}
                      {isSelected && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          className={styles.check}
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render a select dropdown
  const renderSelectOption = (
    group: PricingOptionGroupWithDetails,
  ): React.ReactNode => {
    const selectedValue = selection.selectedOptions[group.id];
    const childGroups = selectedValue ? getChildGroups(selectedValue) : [];

    // Map group values to options format
    const options = group.values.map((value) => {
      const displayPrice = value.price_delta_cents;
      let priceText: string | undefined = undefined;

      // Check if this value has a child numeric group
      if (selectedVariant) {
        const childNumericGroup = selectedVariant.groups.find(
          (g) =>
            g.parent_value_id === value.id &&
            g.input_type === 'numeric_step' &&
            g.numeric_rule,
        );

        if (childNumericGroup?.numeric_rule) {
          const rule = childNumericGroup.numeric_rule;
          // Format as "+price/step unit" instead of total
          priceText = `+${formatPrice(rule.price_per_step_cents)}/${rule.step_value} ${childNumericGroup.unit || 'm'}`;
        }
      }

      return {
        id: value.id,
        name: value.name,
        price: displayPrice,
        priceText,
      };
    });

    return (
      <Fragment key={group.id}>
        {renderCustomDropdown(
          `option-${group.id}`,
          group.name,
          selectedValue || '',
          options,
          (value) => handleOptionChange(group.id, value),
        )}

        {/* Render child groups if a value is selected */}
        {selectedValue &&
          childGroups.map((childGroup) => {
            if (childGroup.input_type === 'select') {
              return renderSelectOption(childGroup);
            } else if (childGroup.input_type === 'numeric_step') {
              return renderNumericOption(childGroup);
            }
            return null;
          })}
      </Fragment>
    );
  };

  // Render a numeric range input
  const renderNumericOption = (
    group: PricingOptionGroupWithDetails,
  ): React.ReactNode => {
    if (!group.numeric_rule) return null;

    const selectedValue = selection.selectedOptions[group.id];
    const currentValue = selectedValue
      ? parseFloat(selectedValue)
      : group.numeric_rule.min_value;

    return (
      <NumericOption
        key={group.id}
        group={
          group as PricingOptionGroupWithDetails & {
            numeric_rule: NonNullable<
              PricingOptionGroupWithDetails['numeric_rule']
            >;
          }
        }
        currentValue={currentValue}
        onChange={handleOptionChange}
        formatPrice={formatPrice}
      />
    );
  };

  return (
    <div className={styles.configurator}>
      {pricingData.hasMultipleModels &&
        renderCustomDropdown(
          'model-select',
          'Model',
          selection.variantId || '',
          pricingData.variants.map((variant) => ({
            id: variant.id,
            name: `${variant.model || variant.product} (od ${formatPrice(variant.base_price_cents)})`,
          })),
          handleModelChange,
        )}
      {selectedVariant &&
        topLevelGroups.map((group) => {
          if (group.input_type === 'select') {
            return renderSelectOption(group);
          } else if (group.input_type === 'numeric_step') {
            return renderNumericOption(group);
          }
          return null;
        })}
      <div className={styles.priceDisplay}>
        <span className={styles.priceLabel}>Cena całkowita:</span>
        <span className={styles.price}>
          {formatPrice(selection.calculatedPrice)}
        </span>
      </div>
    </div>
  );
}
