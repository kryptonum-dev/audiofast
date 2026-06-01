import {
  buildStandardConfigurationData,
  createStandardConfigurationSelectionState,
  findStandardConfigurationVariant,
} from '@/src/global/b2c/configuration/standard-configuration';
import type { CompletePricingData } from '@/src/global/supabase/types';

import { createStandardCartLine } from './standard-cart-line';
import type { StandardCartLine } from './types';

export function canKeepStandardLineWithoutOptions(
  line: StandardCartLine,
  pricingData: CompletePricingData,
): boolean {
  if (!line.configurationSelection?.variantId) {
    return false;
  }

  if (line.configurationSummary.length === 0) {
    return false;
  }

  const variant = findStandardConfigurationVariant(
    pricingData,
    line.configurationSelection.variantId,
  );

  if (!variant) {
    return false;
  }

  return variant.groups.length === 0;
}

export function canReconfigureStandardLineWithAddedOptions(
  line: StandardCartLine,
  pricingData: CompletePricingData,
): boolean {
  if (line.configurationSummary.length > 0) {
    return false;
  }

  if (!line.configurationSelection?.variantId) {
    return pricingData.variants.some((variant) => variant.groups.length > 0);
  }

  const variant = findStandardConfigurationVariant(
    pricingData,
    line.configurationSelection.variantId,
  );

  if (!variant) {
    return false;
  }

  return variant.groups.length > 0;
}

export function createStandardCartLineWithoutOptions(
  line: StandardCartLine,
  pricingData: CompletePricingData,
): StandardCartLine | null {
  if (!canKeepStandardLineWithoutOptions(line, pricingData)) {
    return null;
  }

  const selection = createStandardConfigurationSelectionState(
    pricingData,
    line.configurationSelection,
  );
  const variant = findStandardConfigurationVariant(
    pricingData,
    selection.variantId,
  );

  if (!variant || !selection.variantId) {
    return null;
  }

  const configData = buildStandardConfigurationData(pricingData, selection);

  return createStandardCartLine({
    lineId: line.lineId,
    productId: line.productId,
    productKey: variant.price_key,
    productName: line.productName,
    brandName: line.brandName,
    quantity: line.quantity,
    unitPriceCents: configData.totalPrice,
    isReturnable: line.isReturnable,
    configurationSelection: {
      variantId: selection.variantId,
      selectedOptions: selection.selectedOptions,
    },
    product: {
      ...line.product,
      kind: 'standard',
      basePrice: configData.basePrice,
      configurationOptions: configData.options.map((option) => ({
        label: option.label,
        value: option.value,
        priceDelta: option.priceDelta,
      })),
      totalPrice: configData.totalPrice,
    },
  });
}
