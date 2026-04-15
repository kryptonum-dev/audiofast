import {
  createStandardConfigurationSelectionState,
  findStandardConfigurationVariant,
} from '@/src/global/b2c/configuration/standard-configuration';
import type { CompletePricingData } from '@/src/global/supabase/types';

import type {
  StandardCartConfigurationSelection,
  StandardCartLine,
} from './types';

export type StandardCartLineConfigurationSource =
  | {
      status: 'missing_selection';
    }
  | {
      status: 'variant_unavailable';
    }
  | {
      status: 'ready';
      initialSelection: StandardCartConfigurationSelection;
    };

export function createStandardCartLineConfigurationSource(
  line: StandardCartLine,
  pricingData: CompletePricingData,
): StandardCartLineConfigurationSource {
  if (!line.configurationSelection?.variantId) {
    return {
      status: 'missing_selection',
    };
  }

  const matchingVariant = findStandardConfigurationVariant(
    pricingData,
    line.configurationSelection.variantId,
  );

  if (!matchingVariant) {
    return {
      status: 'variant_unavailable',
    };
  }

  const { variantId, selectedOptions } =
    createStandardConfigurationSelectionState(pricingData, {
      variantId: line.configurationSelection.variantId,
      selectedOptions: line.configurationSelection.selectedOptions,
    });

  return {
    status: 'ready',
    initialSelection: {
      variantId,
      selectedOptions,
    } satisfies StandardCartConfigurationSelection,
  };
}
