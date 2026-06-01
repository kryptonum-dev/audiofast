import { STANDARD_MIN_QUANTITY } from './constants';
import type {
  CartProductSnapshot,
  StandardCartConfigurationSelection,
  StandardCartLine,
} from './types';

export type StandardConfigurationSummaryItem = {
  label: string;
  value: string;
};

export type CreateStandardCartLineInput = {
  lineId?: string;
  productId: string;
  productKey: string;
  productName: string;
  brandName: string;
  quantity?: number;
  unitPriceCents: number;
  isReturnable: boolean;
  configurationSelection?: StandardCartConfigurationSelection;
  configurationSummary?: StandardConfigurationSummaryItem[];
  product: CartProductSnapshot;
};

function createLineId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `line-${Date.now()}`;
}

export function normalizeStandardConfigurationSummary(
  summary: StandardConfigurationSummaryItem[],
): StandardConfigurationSummaryItem[] {
  return [...summary].sort((left, right) =>
    `${left.label}:${left.value}`.localeCompare(
      `${right.label}:${right.value}`,
    ),
  );
}

export function buildStandardConfigurationSummary(
  product: CartProductSnapshot,
): StandardConfigurationSummaryItem[] {
  return normalizeStandardConfigurationSummary(
    product.configurationOptions.map((option) => ({
      label: option.label,
      value: option.value,
    })),
  );
}

export function buildStandardConfigurationSignature(
  summary: StandardConfigurationSummaryItem[],
): string {
  return JSON.stringify(normalizeStandardConfigurationSummary(summary));
}

export function createStandardCartLine(
  input: CreateStandardCartLineInput,
): StandardCartLine {
  const configurationSummary =
    input.configurationSummary ??
    buildStandardConfigurationSummary(input.product);

  return {
    lineId: input.lineId ?? createLineId(),
    lineType: 'standard',
    productId: input.productId,
    productKey: input.productKey,
    productName: input.productName,
    brandName: input.brandName,
    quantity: Math.max(STANDARD_MIN_QUANTITY, Math.floor(input.quantity ?? 1)),
    unitPriceCents: input.unitPriceCents,
    isReturnable: input.isReturnable,
    ...(input.configurationSelection
      ? {
          configurationSelection: {
            variantId: input.configurationSelection.variantId,
            selectedOptions: {
              ...input.configurationSelection.selectedOptions,
            },
          },
        }
      : {}),
    configurationSummary,
    configurationSignature:
      buildStandardConfigurationSignature(configurationSummary),
    issues: [],
    product: input.product,
  };
}
