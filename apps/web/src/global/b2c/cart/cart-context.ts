'use client';

import { createContext } from 'react';

import type {
  CartLine,
  CartState,
  CartTotals,
  StandardCartLine,
} from './types';

export type CartContextValue = {
  cart: CartState;
  totals: CartTotals;
  isHydrated: boolean;
  addLine: (line: CartLine) => void;
  removeLine: (lineId: string) => void;
  setStandardLineQuantity: (lineId: string, quantity: number) => void;
  incrementStandardLineQuantity: (lineId: string) => void;
  decrementStandardLineQuantity: (lineId: string) => void;
  replaceStandardLine: (lineId: string, nextLine: StandardCartLine) => void;
  clearCart: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);
