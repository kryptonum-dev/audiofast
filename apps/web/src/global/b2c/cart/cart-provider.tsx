'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import { CartContext } from './cart-context';
import { createEmptyCart } from './cart-domain';
import { loadCartFromStorage, saveCartToStorage } from './cart-persistence';
import { cartReducer } from './cart-reducer';
import { getCartTotals } from './cart-selectors';
import type { CartLine, StandardCartLine } from './types';

type CartProviderProps = {
  children: React.ReactNode;
};

export function CartProvider({ children }: CartProviderProps) {
  const [cart, dispatch] = useReducer(cartReducer, undefined, createEmptyCart);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedCart = loadCartFromStorage();

    dispatch({
      type: 'hydrate',
      payload: storedCart,
    });

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    saveCartToStorage(cart);
  }, [cart, isHydrated]);

  const addLine = useCallback((line: CartLine) => {
    dispatch({
      type: 'add-line',
      payload: line,
    });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    dispatch({
      type: 'remove-line',
      payload: { lineId },
    });
  }, []);

  const setStandardLineQuantity = useCallback(
    (lineId: string, quantity: number) => {
      dispatch({
        type: 'set-standard-line-quantity',
        payload: { lineId, quantity },
      });
    },
    [],
  );

  const incrementStandardLineQuantity = useCallback((lineId: string) => {
    dispatch({
      type: 'increment-standard-line-quantity',
      payload: { lineId },
    });
  }, []);

  const decrementStandardLineQuantity = useCallback((lineId: string) => {
    dispatch({
      type: 'decrement-standard-line-quantity',
      payload: { lineId },
    });
  }, []);

  const replaceStandardLine = useCallback(
    (lineId: string, nextLine: StandardCartLine) => {
      dispatch({
        type: 'replace-standard-line',
        payload: { lineId, nextLine },
      });
    },
    [],
  );

  const clearCart = useCallback(() => {
    dispatch({
      type: 'clear',
    });
  }, []);

  const value = useMemo(
    () => ({
      cart,
      totals: getCartTotals(cart),
      isHydrated,
      addLine,
      removeLine,
      setStandardLineQuantity,
      incrementStandardLineQuantity,
      decrementStandardLineQuantity,
      replaceStandardLine,
      clearCart,
    }),
    [
      addLine,
      cart,
      clearCart,
      decrementStandardLineQuantity,
      incrementStandardLineQuantity,
      isHydrated,
      removeLine,
      replaceStandardLine,
      setStandardLineQuantity,
    ],
  );

  return <CartContext value={value}>{children}</CartContext>;
}
