import type {
  CompletePricingData,
  PricingOptionGroupWithDetails,
  PricingSelection,
  PricingVariantWithOptions,
} from '@/src/global/supabase/types';

export type StandardConfigurationSelectionSeed = Pick<
  PricingSelection,
  'variantId' | 'selectedOptions'
>;

export type StandardConfigurationOptionData = {
  label: string;
  value: string;
  priceDelta: number;
};

export type StandardConfigurationData = {
  basePrice: number;
  options: StandardConfigurationOptionData[];
  totalPrice: number;
};

export type StandardConfigurationValidationIssueCode =
  | 'inactive_child_selection'
  | 'invalid_numeric_value'
  | 'invalid_select_value'
  | 'missing_required_selection'
  | 'stale_group_selection'
  | 'variant_missing';

export type StandardConfigurationValidationIssue = {
  code: StandardConfigurationValidationIssueCode;
  groupId?: string;
};

export type StandardConfigurationValidationResult = {
  isValid: boolean;
  issues: StandardConfigurationValidationIssue[];
  unitPriceCents: number | null;
  variant: PricingVariantWithOptions | null;
};

type NumericGroup = PricingOptionGroupWithDetails & {
  numeric_rule: NonNullable<PricingOptionGroupWithDetails['numeric_rule']>;
};

function createEmptySelectionState(
  pricingData: CompletePricingData,
): PricingSelection {
  return {
    variantId: null,
    selectedOptions: {},
    calculatedPrice: pricingData.lowestPrice,
  };
}

function isGroupVisible(
  selectedOptions: Record<string, string>,
  group: PricingOptionGroupWithDetails,
): boolean {
  return (
    !group.parent_value_id ||
    Object.values(selectedOptions).includes(group.parent_value_id)
  );
}

function isNumericSelectionValid(group: NumericGroup, value: string): boolean {
  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
    return false;
  }

  if (
    numericValue < group.numeric_rule.min_value ||
    numericValue > group.numeric_rule.max_value
  ) {
    return false;
  }

  const steps =
    (numericValue - group.numeric_rule.min_value) / group.numeric_rule.step_value;
  const remainder = Math.abs(steps - Math.round(steps));

  return remainder < 0.0001;
}

function isGroupSelectionValid(
  group: PricingOptionGroupWithDetails,
  value: string,
): boolean {
  if (group.input_type === 'select') {
    return group.values.some((option) => option.id === value);
  }

  if (group.input_type === 'numeric_step' && group.numeric_rule) {
    return isNumericSelectionValid(
      group as NumericGroup,
      value,
    );
  }

  return false;
}

function getDefaultGroupSelection(
  group: PricingOptionGroupWithDetails,
): string | null {
  if (group.input_type === 'select') {
    return group.values[0]?.id ?? null;
  }

  if (group.input_type === 'numeric_step' && group.numeric_rule) {
    return String(group.numeric_rule.min_value);
  }

  return null;
}

function getVariantGroupsById(
  variant: PricingVariantWithOptions,
): Map<string, PricingOptionGroupWithDetails> {
  return new Map(variant.groups.map((group) => [group.id, group]));
}

export function findStandardConfigurationVariant(
  pricingData: CompletePricingData,
  variantId: string | null | undefined,
): PricingVariantWithOptions | null {
  if (!variantId) {
    return null;
  }

  return pricingData.variants.find((variant) => variant.id === variantId) ?? null;
}

export function resolveStandardConfigurationVariant(
  pricingData: CompletePricingData,
  variantId: string | null | undefined,
): PricingVariantWithOptions | null {
  return (
    findStandardConfigurationVariant(pricingData, variantId) ??
    pricingData.variants[0] ??
    null
  );
}

export function getStandardConfigurationTopLevelGroups(
  variant: PricingVariantWithOptions | null,
): PricingOptionGroupWithDetails[] {
  if (!variant) {
    return [];
  }

  return variant.groups.filter((group) => !group.parent_value_id);
}

export function getStandardConfigurationChildGroups(
  variant: PricingVariantWithOptions | null,
  parentValueId: string,
): PricingOptionGroupWithDetails[] {
  if (!variant) {
    return [];
  }

  return variant.groups.filter((group) => group.parent_value_id === parentValueId);
}

export function calculateStandardConfigurationNumericPriceDelta(
  group: NumericGroup,
  value: string,
): number {
  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
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

export function calculateStandardConfigurationPrice(
  pricingData: CompletePricingData,
  selection: StandardConfigurationSelectionSeed,
): number {
  const variant = resolveStandardConfigurationVariant(
    pricingData,
    selection.variantId,
  );

  if (!variant) {
    return pricingData.lowestPrice;
  }

  let totalPrice = variant.base_price_cents;

  variant.groups.forEach((group) => {
    const selectedValue = selection.selectedOptions[group.id];

    if (!selectedValue || !isGroupVisible(selection.selectedOptions, group)) {
      return;
    }

    if (group.input_type === 'select') {
      const value = group.values.find((option) => option.id === selectedValue);

      if (value) {
        totalPrice += value.price_delta_cents;
      }

      return;
    }

    if (group.input_type === 'numeric_step' && group.numeric_rule) {
      totalPrice += calculateStandardConfigurationNumericPriceDelta(
        group as NumericGroup,
        selectedValue,
      );
    }
  });

  return totalPrice;
}

export function buildStandardConfigurationData(
  pricingData: CompletePricingData,
  selection: StandardConfigurationSelectionSeed,
): StandardConfigurationData {
  const variant = resolveStandardConfigurationVariant(
    pricingData,
    selection.variantId,
  );

  if (!variant) {
    return {
      basePrice: pricingData.lowestPrice,
      options: [],
      totalPrice: pricingData.lowestPrice,
    };
  }

  const options: StandardConfigurationOptionData[] = [];

  if (pricingData.hasMultipleModels && variant.model) {
    options.push({
      label: 'Model',
      value: variant.model,
      priceDelta: 0,
    });
  }

  variant.groups.forEach((group) => {
    const selectedValue = selection.selectedOptions[group.id];

    if (!selectedValue || !isGroupVisible(selection.selectedOptions, group)) {
      return;
    }

    if (group.input_type === 'select') {
      const value = group.values.find((option) => option.id === selectedValue);

      if (!value) {
        return;
      }

      options.push({
        label: group.name,
        value: value.name,
        priceDelta: value.price_delta_cents,
      });

      return;
    }

    if (group.input_type === 'numeric_step' && group.numeric_rule) {
      options.push({
        label: group.name,
        value: `${selectedValue} ${group.unit || 'm'}`,
        priceDelta: calculateStandardConfigurationNumericPriceDelta(
          group as NumericGroup,
          selectedValue,
        ),
      });
    }
  });

  return {
    basePrice: variant.base_price_cents,
    options,
    totalPrice: calculateStandardConfigurationPrice(pricingData, selection),
  };
}

export function createStandardConfigurationSelectionState(
  pricingData: CompletePricingData,
  initialSelection?: StandardConfigurationSelectionSeed | null,
): PricingSelection {
  const variant = resolveStandardConfigurationVariant(
    pricingData,
    initialSelection?.variantId,
  );

  if (!variant) {
    return createEmptySelectionState(pricingData);
  }

  return settleStandardConfigurationSelection(pricingData, {
    variantId: variant.id,
    selectedOptions: { ...(initialSelection?.selectedOptions ?? {}) },
  });
}

export function settleStandardConfigurationSelection(
  pricingData: CompletePricingData,
  selection: StandardConfigurationSelectionSeed,
): PricingSelection {
  const variant = resolveStandardConfigurationVariant(pricingData, selection.variantId);

  if (!variant) {
    return createEmptySelectionState(pricingData);
  }

  const groupsById = getVariantGroupsById(variant);
  const selectedOptions = Object.fromEntries(
    Object.entries(selection.selectedOptions).filter(([groupId]) =>
      groupsById.has(groupId),
    ),
  );

  let changed = true;
  let iterationCount = 0;

  while (changed && iterationCount <= variant.groups.length) {
    changed = false;
    iterationCount += 1;

    variant.groups.forEach((group) => {
      const currentValue = selectedOptions[group.id];
      const visible = isGroupVisible(selectedOptions, group);

      if (!visible) {
        if (currentValue !== undefined) {
          delete selectedOptions[group.id];
          changed = true;
        }

        return;
      }

      if (currentValue && isGroupSelectionValid(group, currentValue)) {
        return;
      }

      const defaultValue = getDefaultGroupSelection(group);

      if (defaultValue) {
        if (currentValue !== defaultValue) {
          selectedOptions[group.id] = defaultValue;
          changed = true;
        }

        return;
      }

      if (currentValue !== undefined) {
        delete selectedOptions[group.id];
        changed = true;
      }
    });
  }

  return {
    variantId: variant.id,
    selectedOptions,
    calculatedPrice: calculateStandardConfigurationPrice(pricingData, {
      variantId: variant.id,
      selectedOptions,
    }),
  };
}

export function validateStandardConfigurationSelection(
  pricingData: CompletePricingData,
  selection: StandardConfigurationSelectionSeed,
): StandardConfigurationValidationResult {
  const variant = findStandardConfigurationVariant(pricingData, selection.variantId);

  if (!variant) {
    return {
      isValid: false,
      issues: [{ code: 'variant_missing' }],
      unitPriceCents: null,
      variant: null,
    };
  }

  const issues: StandardConfigurationValidationIssue[] = [];
  const groupsById = getVariantGroupsById(variant);

  Object.keys(selection.selectedOptions).forEach((groupId) => {
    if (!groupsById.has(groupId)) {
      issues.push({
        code: 'stale_group_selection',
        groupId,
      });
    }
  });

  variant.groups.forEach((group) => {
    const selectedValue = selection.selectedOptions[group.id];
    const visible = isGroupVisible(selection.selectedOptions, group);

    if (!visible) {
      if (selectedValue !== undefined) {
        issues.push({
          code: 'inactive_child_selection',
          groupId: group.id,
        });
      }

      return;
    }

    if (!selectedValue) {
      if (group.required) {
        issues.push({
          code: 'missing_required_selection',
          groupId: group.id,
        });
      }

      return;
    }

    if (group.input_type === 'select') {
      if (!group.values.some((option) => option.id === selectedValue)) {
        issues.push({
          code: 'invalid_select_value',
          groupId: group.id,
        });
      }

      return;
    }

    if (group.input_type === 'numeric_step') {
      if (!group.numeric_rule || !isNumericSelectionValid(group as NumericGroup, selectedValue)) {
        issues.push({
          code: 'invalid_numeric_value',
          groupId: group.id,
        });
      }
    }
  });

  const isValid = issues.length === 0;

  return {
    isValid,
    issues,
    unitPriceCents: isValid
      ? calculateStandardConfigurationPrice(pricingData, selection)
      : null,
    variant,
  };
}
