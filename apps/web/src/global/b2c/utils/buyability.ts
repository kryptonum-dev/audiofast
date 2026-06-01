export type BuyabilityReason =
  | 'archived'
  | 'missing_price'
  | 'not_sellable_online'
  | 'unavailable';

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
