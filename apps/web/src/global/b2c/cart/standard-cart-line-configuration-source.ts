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

  const matchingVariant = pricingData.variants.find(
    (variant) => variant.id === line.configurationSelection?.variantId,
  );

  if (!matchingVariant) {
    return {
      status: 'variant_unavailable',
    };
  }

  return {
    status: 'ready',
    initialSelection: {
      variantId: line.configurationSelection.variantId,
      selectedOptions: { ...line.configurationSelection.selectedOptions },
    },
  };
}
