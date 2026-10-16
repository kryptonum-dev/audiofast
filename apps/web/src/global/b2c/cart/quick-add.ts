import type { SanityRawImage } from '@/src/components/shared/Image';
import {
  buildStandardConfigurationData,
  createStandardConfigurationSelectionState,
  findStandardConfigurationVariant,
  type StandardConfigurationData,
  type StandardConfigurationSelectionSeed,
  validateStandardConfigurationSelection,
} from '@/src/global/b2c/configuration/standard-configuration';
import {
  type BuyabilityReason,
  getStandardProductBuyability,
} from '@/src/global/b2c/utils/buyability';
import type { QueryProductQuickAddBySlugResult } from '@/src/global/sanity/sanity.types';
import type { CompletePricingData } from '@/src/global/supabase/types';

import { createStandardCartLine } from './standard-cart-line';
import type { CartProductSnapshot, StandardCartLine } from './types';

/**
 * Quick add-to-cart from a product tile.
 *
 * - `direct`: exactly one variant without option groups, so there is nothing
 *   to choose and the line can be added straight away.
 * - `configure`: several variants or any option group; the shopper picks the
 *   configuration in a popup first.
 *
 * Lines built here match the ones added on the product page
 * (PricingSection): same productKey (variant price_key), selection, unit price
 * and product snapshot, so cart revalidation treats them identically.
 */
export type QuickAddMode = 'configure' | 'direct';

export type QuickAddProductSnapshot = {
  id: string;
  name: string;
  brandName: string;
  brandLogo?: SanityRawImage;
  image: SanityRawImage;
  isReturnable: boolean;
};

export type QuickAddSanityProduct =
  NonNullable<QueryProductQuickAddBySlugResult>;

export type QuickAddUnavailableReason = BuyabilityReason | 'not_found';

export type QuickAddResolution =
  | {
      status: 'ready';
      mode: QuickAddMode;
      product: QuickAddProductSnapshot;
      pricingData: CompletePricingData;
    }
  | {
      status: 'unavailable';
      reason: QuickAddUnavailableReason;
      message: string;
    };

export type CreateQuickAddCartLineResult =
  | {
      ok: true;
      line: StandardCartLine;
      configData: StandardConfigurationData;
    }
  | {
      ok: false;
      reason: 'invalid_configuration' | 'variant_missing';
    };

export const QUICK_ADD_UNAVAILABLE_MESSAGES: Record<
  QuickAddUnavailableReason,
  string
> = {
  not_sellable_online:
    'Ten produkt nie jest obecnie dostępny w sprzedaży online.',
  missing_price:
    'Ten produkt nie ma obecnie ceny w sklepie internetowym. Szczegóły znajdziesz na stronie produktu.',
  archived: 'Ten produkt nie jest już dostępny w sprzedaży.',
  unavailable: 'Ten produkt jest chwilowo niedostępny.',
  not_found:
    'Nie udało się znaleźć tego produktu. Odśwież stronę i spróbuj ponownie.',
};

export const QUICK_ADD_ERROR_MESSAGE =
  'Nie udało się wczytać danych produktu. Spróbuj ponownie za chwilę.';

export const QUICK_ADD_INVALID_CONFIGURATION_MESSAGE =
  'Wybierz wszystkie wymagane opcje, aby dodać produkt do koszyka.';

export const QUICK_ADD_VARIANT_MISSING_MESSAGE =
  'Wybrana wersja produktu nie jest już dostępna. Odśwież stronę i spróbuj ponownie.';

export function resolveQuickAddMode(
  pricingData: CompletePricingData,
): QuickAddMode {
  const [firstVariant, ...otherVariants] = pricingData.variants;

  return firstVariant &&
    otherVariants.length === 0 &&
    firstVariant.groups.length === 0
    ? 'direct'
    : 'configure';
}

export function createQuickAddProductSnapshot(
  product: QuickAddSanityProduct,
): QuickAddProductSnapshot {
  return {
    id: product._id,
    name: product.name || '',
    brandName: product.brand?.name || '',
    brandLogo: product.brand?.logo || undefined,
    image: product.previewImage ?? {},
    isReturnable: product.isReturnable ?? false,
  };
}

function createUnavailableResolution(
  reason: QuickAddUnavailableReason,
): QuickAddResolution {
  return {
    status: 'unavailable',
    reason,
    message: QUICK_ADD_UNAVAILABLE_MESSAGES[reason],
  };
}

export function resolveQuickAdd({
  product,
  pricingData,
}: {
  product: QuickAddSanityProduct | null;
  pricingData: CompletePricingData | null;
}): QuickAddResolution {
  if (!product) {
    return createUnavailableResolution('not_found');
  }

  // Archived products stay buyable while they carry a price (client rule),
  // so only the standard buyability check gates the quick add.
  const buyability = getStandardProductBuyability({
    isSellableOnline: product.isSellableOnline,
    pricingData,
  });

  if (!buyability.isBuyable || !pricingData) {
    return createUnavailableResolution(buyability.reason ?? 'unavailable');
  }

  return {
    status: 'ready',
    mode: resolveQuickAddMode(pricingData),
    product: createQuickAddProductSnapshot(product),
    pricingData,
  };
}

export function createQuickAddCartLine({
  product,
  pricingData,
  selection,
}: {
  product: QuickAddProductSnapshot;
  pricingData: CompletePricingData;
  selection?: StandardConfigurationSelectionSeed | null;
}): CreateQuickAddCartLineResult {
  // A selection pointing at a variant that no longer exists must not silently
  // fall back to the first variant (that would add a different model).
  if (
    selection?.variantId &&
    !findStandardConfigurationVariant(pricingData, selection.variantId)
  ) {
    return { ok: false, reason: 'variant_missing' };
  }

  const settledSelection = createStandardConfigurationSelectionState(
    pricingData,
    selection ?? null,
  );
  const validation = validateStandardConfigurationSelection(
    pricingData,
    settledSelection,
  );

  if (!validation.isValid) {
    return {
      ok: false,
      reason: validation.issues.some(
        (issue) => issue.code === 'variant_missing',
      )
        ? 'variant_missing'
        : 'invalid_configuration',
    };
  }

  const variant = findStandardConfigurationVariant(
    pricingData,
    settledSelection.variantId,
  );

  if (!variant) {
    return { ok: false, reason: 'variant_missing' };
  }

  const configData = buildStandardConfigurationData(
    pricingData,
    settledSelection,
  );
  const cartProduct: CartProductSnapshot = {
    id: product.id,
    name: product.name,
    brandName: product.brandName,
    kind: 'standard',
    brandLogo: product.brandLogo,
    image: product.image,
    basePrice: configData.basePrice,
    configurationOptions: configData.options.map((option) => ({
      label: option.label,
      value: option.value,
      priceDelta: option.priceDelta,
    })),
    totalPrice: configData.totalPrice,
  };

  const line = createStandardCartLine({
    productId: product.id,
    productKey: variant.price_key,
    productName: product.name,
    brandName: product.brandName,
    quantity: 1,
    unitPriceCents: configData.totalPrice,
    isReturnable: product.isReturnable,
    configurationSelection: {
      variantId: settledSelection.variantId,
      selectedOptions: settledSelection.selectedOptions,
    },
    product: cartProduct,
  });

  return { ok: true, line, configData };
}
