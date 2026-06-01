'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { lookupCouponDefinition } from '@/src/app/actions/cart-coupon';

import { CartContext, type CartCouponRevalidationNotice } from './cart-context';
import { applyCouponToCart } from './cart-coupon';
import { createEmptyCart } from './cart-domain';
import { loadCartFromStorage, saveCartToStorage } from './cart-persistence';
import { cartReducer } from './cart-reducer';
import { getCartTotals } from './cart-selectors';
import type { CartLine, CartLineRevalidation, StandardCartLine } from './types';

type CartProviderProps = {
  children: React.ReactNode;
};

function createChangedCouponNotice(
  reason: string | null | undefined,
): CartCouponRevalidationNotice {
  switch (reason) {
    case 'Kod rabatowy jest nieaktywny.':
      return {
        title: 'Kod zmienił się po odświeżeniu strony.',
        description:
          'Ten kod jest już nieaktywny, więc usunęliśmy go z koszyka.',
        tone: 'warning',
      };
    case 'Kod rabatowy jest poza aktywnym oknem czasowym.':
      return {
        title: 'Kod zmienił się po odświeżeniu strony.',
        description:
          'Ten kod wygasł lub nie jest jeszcze aktywny, więc usunęliśmy go z koszyka.',
        tone: 'warning',
      };
    case 'Kod rabatowy przekroczył limit użyć.':
      return {
        title: 'Kod zmienił się po odświeżeniu strony.',
        description:
          'Ten kod osiągnął już limit użyć, więc usunęliśmy go z koszyka.',
        tone: 'warning',
      };
    case 'Kod rabatowy nie pasuje do żadnego produktu w koszyku.':
    case 'Kod rabatowy nie pasuje już do produktów w koszyku.':
      return {
        title: 'Kod zmienił się po odświeżeniu strony.',
        description:
          'Ten kod nie pasuje już do produktów w koszyku, więc usunęliśmy go z zamówienia.',
        tone: 'warning',
      };
    default:
      return {
        title: 'Kod zmienił się po odświeżeniu strony.',
        description:
          'Zapisany kod nie jest już dostępny, więc usunęliśmy go z koszyka.',
        tone: 'warning',
      };
  }
}

function createCouponRevalidationErrorNotice(): CartCouponRevalidationNotice {
  return {
    title: 'Nie udało się odświeżyć kodu rabatowego.',
    description:
      'Zostawiliśmy obecny rabat w koszyku. Spróbuj ponownie, aby potwierdzić, czy kod nadal działa.',
    tone: 'neutral',
  };
}

export function CartProvider({ children }: CartProviderProps) {
  const [cart, dispatch] = useReducer(cartReducer, undefined, createEmptyCart);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isRevalidatingCoupon, setIsRevalidatingCoupon] = useState(false);
  const [couponRequestError, setCouponRequestError] = useState<string | null>(
    null,
  );
  const [couponRevalidationNotice, setCouponRevalidationNotice] =
    useState<CartCouponRevalidationNotice | null>(null);
  const [canRetryCouponRevalidation, setCanRetryCouponRevalidation] =
    useState(false);
  const [hydratedCouponCodeToVerify, setHydratedCouponCodeToVerify] = useState<
    string | null
  >(null);
  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const clearCouponFeedback = useCallback(() => {
    setCouponRequestError(null);
    setCouponRevalidationNotice(null);
    setCanRetryCouponRevalidation(false);
  }, []);

  useEffect(() => {
    const storedCart = loadCartFromStorage();

    dispatch({
      type: 'hydrate',
      payload: storedCart,
    });

    setHydratedCouponCodeToVerify(
      storedCart.coupon?.isValid ? storedCart.coupon.code : null,
    );
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    saveCartToStorage(cart);
  }, [cart, isHydrated]);

  const revalidateCoupon = useCallback(
    async (code: string) => {
      const normalizedCode = code.trim();

      if (!normalizedCode) {
        clearCouponFeedback();
        return;
      }

      setCouponRevalidationNotice(null);
      setCanRetryCouponRevalidation(false);
      setIsRevalidatingCoupon(true);

      try {
        const result = await lookupCouponDefinition(normalizedCode);
        const currentCoupon = cartRef.current.coupon;

        if (
          !currentCoupon ||
          !currentCoupon.isValid ||
          currentCoupon.code !== normalizedCode
        ) {
          return;
        }

        switch (result.status) {
          case 'found': {
            const previewCart = applyCouponToCart(
              cartRef.current,
              result.coupon,
            );

            if (!previewCart.coupon?.isValid) {
              dispatch({
                type: 'clear-coupon',
              });
              setCouponRevalidationNotice(
                createChangedCouponNotice(previewCart.coupon?.message),
              );
              break;
            }

            dispatch({
              type: 'apply-coupon',
              payload: {
                coupon: result.coupon,
              },
            });
            break;
          }
          case 'not_found':
            dispatch({
              type: 'clear-coupon',
            });
            setCouponRevalidationNotice(createChangedCouponNotice(null));
            break;
          case 'error':
            setCouponRevalidationNotice(createCouponRevalidationErrorNotice());
            setCanRetryCouponRevalidation(true);
            break;
        }
      } catch (error) {
        console.error('Unexpected coupon revalidation failure.', error);
        setCouponRevalidationNotice(createCouponRevalidationErrorNotice());
        setCanRetryCouponRevalidation(true);
      } finally {
        setIsRevalidatingCoupon(false);
      }
    },
    [clearCouponFeedback],
  );

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

  const applyCartLineRevalidation = useCallback(
    (results: CartLineRevalidation[]) => {
      dispatch({
        type: 'apply-line-revalidation',
        payload: {
          results,
        },
      });
    },
    [],
  );

  const revalidateHydratedCouponAfterInitialLoad = useCallback(async () => {
    const hydratedCouponCode = hydratedCouponCodeToVerify?.trim();

    if (!hydratedCouponCode) {
      return;
    }

    setHydratedCouponCodeToVerify(null);

    const currentCoupon = cartRef.current.coupon;

    if (
      !currentCoupon ||
      !currentCoupon.isValid ||
      currentCoupon.code !== hydratedCouponCode
    ) {
      return;
    }

    await revalidateCoupon(hydratedCouponCode);
  }, [hydratedCouponCodeToVerify, revalidateCoupon]);

  const applyCoupon = useCallback(
    async (code: string) => {
      const normalizedCode = code.trim();

      if (!normalizedCode) {
        setCouponRequestError('Wpisz kod rabatowy.');
        return;
      }

      clearCouponFeedback();
      setIsApplyingCoupon(true);

      try {
        const result = await lookupCouponDefinition(normalizedCode);

        switch (result.status) {
          case 'found': {
            const previewCart = applyCouponToCart(cart, result.coupon);

            if (!previewCart.coupon?.isValid) {
              setCouponRequestError(
                previewCart.coupon?.message ??
                  'Nie udało się zastosować kodu rabatowego.',
              );
              break;
            }

            dispatch({
              type: 'apply-coupon',
              payload: {
                coupon: result.coupon,
              },
            });
            break;
          }
          case 'not_found':
            setCouponRequestError(result.message);
            break;
          case 'error':
            setCouponRequestError(result.message);
            break;
        }
      } catch (error) {
        console.error('Unexpected coupon apply failure.', error);
        setCouponRequestError(
          'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.',
        );
      } finally {
        setIsApplyingCoupon(false);
      }
    },
    [cart, clearCouponFeedback],
  );

  const clearCouponRequestError = useCallback(() => {
    clearCouponFeedback();
  }, [clearCouponFeedback]);

  const retryCouponRevalidation = useCallback(async () => {
    const currentCoupon = cartRef.current.coupon;

    if (!currentCoupon?.isValid) {
      clearCouponFeedback();
      return;
    }

    await revalidateCoupon(currentCoupon.code);
  }, [clearCouponFeedback, revalidateCoupon]);

  const clearCoupon = useCallback(() => {
    dispatch({
      type: 'clear-coupon',
    });
    clearCouponFeedback();
  }, [clearCouponFeedback]);

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
      isApplyingCoupon,
      isRevalidatingCoupon,
      couponRequestError,
      couponRevalidationNotice,
      canRetryCouponRevalidation,
      addLine,
      removeLine,
      setStandardLineQuantity,
      incrementStandardLineQuantity,
      decrementStandardLineQuantity,
      replaceStandardLine,
      applyCartLineRevalidation,
      applyCoupon,
      revalidateHydratedCouponAfterInitialLoad,
      clearCouponRequestError,
      retryCouponRevalidation,
      clearCoupon,
      clearCart,
    }),
    [
      addLine,
      applyCoupon,
      canRetryCouponRevalidation,
      cart,
      clearCart,
      clearCoupon,
      clearCouponRequestError,
      couponRequestError,
      couponRevalidationNotice,
      decrementStandardLineQuantity,
      incrementStandardLineQuantity,
      isApplyingCoupon,
      isHydrated,
      isRevalidatingCoupon,
      removeLine,
      replaceStandardLine,
      applyCartLineRevalidation,
      retryCouponRevalidation,
      revalidateHydratedCouponAfterInitialLoad,
      setStandardLineQuantity,
    ],
  );

  return <CartContext value={value}>{children}</CartContext>;
}
