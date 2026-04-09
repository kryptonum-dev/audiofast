import { CPO_FIXED_QUANTITY } from './constants';
import type { CartProductSnapshot, CpoCartLine } from './types';

export type CreateCpoCartLineInput = {
  lineId?: string;
  productId: string;
  productKey: string;
  productName: string;
  brandName: string;
  unitPriceCents: number;
  isReturnable: boolean;
  availabilityStatus: string | null;
  product: CartProductSnapshot;
};

function createLineId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `line-${Date.now()}`;
}

export function createCpoCartLine(input: CreateCpoCartLineInput): CpoCartLine {
  return {
    lineId: input.lineId ?? createLineId(),
    lineType: 'cpo',
    productId: input.productId,
    productKey: input.productKey,
    productName: input.productName,
    brandName: input.brandName,
    quantity: CPO_FIXED_QUANTITY,
    unitPriceCents: input.unitPriceCents,
    isReturnable: input.isReturnable,
    availabilityStatus: input.availabilityStatus,
    issues: [],
    product: input.product,
  };
}
