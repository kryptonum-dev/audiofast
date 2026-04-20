'use server';

import type {
  CartLine,
  CartLineRevalidation,
  CpoCartLine,
  CpoLineRevalidation,
  StandardCartLine,
  StandardLineRevalidation,
} from '@/src/global/b2c/cart/types';
import {
  loadCartPageRuntime as loadCartPageRuntimeUseCase,
  revalidateCartLines as revalidateCartLinesUseCase,
  revalidateCpoCartLines as revalidateCpoCartLinesUseCase,
  revalidateStandardCartLines as revalidateStandardCartLinesUseCase,
  type LoadCartPageRuntimeResult,
} from '@/src/global/b2c/cart/server/revalidation';

export async function revalidateStandardCartLines(
  lines: StandardCartLine[],
): Promise<StandardLineRevalidation[]> {
  return revalidateStandardCartLinesUseCase(lines);
}

export async function revalidateCpoCartLines(
  lines: CpoCartLine[],
): Promise<CpoLineRevalidation[]> {
  return revalidateCpoCartLinesUseCase(lines);
}

export async function revalidateCartLines(
  lines: CartLine[],
): Promise<CartLineRevalidation[]> {
  return revalidateCartLinesUseCase(lines);
}

export async function loadCartPageRuntime(
  lines: CartLine[],
): Promise<LoadCartPageRuntimeResult> {
  return loadCartPageRuntimeUseCase(lines);
}
