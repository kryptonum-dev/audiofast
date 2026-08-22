export type BuyabilityReason =
  'archived' | 'missing_price' | 'not_sellable_online' | 'unavailable';

export type BuyabilityResult = {
  isBuyable: boolean;
  reason: BuyabilityReason | null;
};

type StandardPricingSignal = {
  lowestPrice: number;
  variants: readonly unknown[];
};

type StandardProductBuyabilityInput = {
  isSellableOnline?: boolean | null;
  pricingData?: StandardPricingSignal | null;
};

type CpoProductBuyabilityInput = {
  isArchived?: boolean | null;
  isSellableOnline?: boolean | null;
  priceCents?: number | null;
  availabilityStatus?: string | null;
};

function hasValidPrice(priceCents?: number | null): boolean {
  return (
    typeof priceCents === 'number' &&
    Number.isFinite(priceCents) &&
    priceCents > 0
  );
}

function hasValidStandardPricing(
  pricingData?: StandardPricingSignal | null,
): boolean {
  return (
    !!pricingData &&
    pricingData.variants.length > 0 &&
    hasValidPrice(pricingData.lowestPrice)
  );
}

export function getStandardProductBuyability({
  isSellableOnline,
  pricingData,
}: StandardProductBuyabilityInput): BuyabilityResult {
  if (!isSellableOnline) {
    return {
      isBuyable: false,
      reason: 'not_sellable_online',
    };
  }

  if (!hasValidStandardPricing(pricingData)) {
    return {
      isBuyable: false,
      reason: 'missing_price',
    };
  }

  return {
    isBuyable: true,
    reason: null,
  };
}

export type StandardAvailabilityReason = 'archived_no_price';

export type StandardAvailabilityResult = {
  isUnavailable: boolean;
  reason: StandardAvailabilityReason | null;
};

type StandardProductAvailabilityInput = {
  isArchived?: boolean | null;
  pricingData?: StandardPricingSignal | null;
};

/**
 * Business rule agreed with the client (Aug 2026): a standard product is
 * presented as UNAVAILABLE only when it is archived AND has no valid price.
 * - Live products without a price stay "available" (they just show no price).
 * - Archived products that still carry a price remain on sale as usual.
 *
 * This is deliberately separate from buyability: it drives the "product
 * unavailable" notice, not cart/checkout gating.
 */
export function getStandardProductAvailability({
  isArchived,
  pricingData,
}: StandardProductAvailabilityInput): StandardAvailabilityResult {
  if (isArchived && !hasValidStandardPricing(pricingData)) {
    return {
      isUnavailable: true,
      reason: 'archived_no_price',
    };
  }

  return {
    isUnavailable: false,
    reason: null,
  };
}

export function getCpoProductBuyability({
  isArchived,
  isSellableOnline,
  priceCents,
  availabilityStatus,
}: CpoProductBuyabilityInput): BuyabilityResult {
  if (isArchived) {
    return {
      isBuyable: false,
      reason: 'archived',
    };
  }

  if (!isSellableOnline) {
    return {
      isBuyable: false,
      reason: 'not_sellable_online',
    };
  }

  if (!hasValidPrice(priceCents)) {
    return {
      isBuyable: false,
      reason: 'missing_price',
    };
  }

  if (availabilityStatus !== 'available') {
    return {
      isBuyable: false,
      reason: 'unavailable',
    };
  }

  return {
    isBuyable: true,
    reason: null,
  };
}
