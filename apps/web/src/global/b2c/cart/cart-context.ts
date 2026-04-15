'use client';

import { createContext } from 'react';

import type {
  CartLine,
  CartLineRevalidation,
  CartState,
  CartTotals,
  StandardCartLine,
} from './types';

export type CartCouponRevalidationNotice = {
  title: string;
  description: string;
  tone: 'warning' | 'neutral';
};

export type CartContextValue = {
  cart: CartState;
  totals: CartTotals;
  isHydrated: boolean;
  isApplyingCoupon: boolean;
  isRevalidatingCoupon: boolean;
  couponRequestError: string | null;
  couponRevalidationNotice: CartCouponRevalidationNotice | null;
  canRetryCouponRevalidation: boolean;
  addLine: (line: CartLine) => void;
  removeLine: (lineId: string) => void;
  setStandardLineQuantity: (lineId: string, quantity: number) => void;
  incrementStandardLineQuantity: (lineId: string) => void;
  decrementStandardLineQuantity: (lineId: string) => void;
  replaceStandardLine: (lineId: string, nextLine: StandardCartLine) => void;
  applyCartLineRevalidation: (results: CartLineRevalidation[]) => void;
  applyCoupon: (code: string) => Promise<void>;
  revalidateHydratedCouponAfterInitialLoad: () => Promise<void>;
  clearCouponRequestError: () => void;
  retryCouponRevalidation: () => Promise<void>;
  clearCoupon: () => void;
  clearCart: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);
