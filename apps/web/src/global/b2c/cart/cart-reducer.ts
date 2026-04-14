import {
  applyCouponToCart,
  applyInvalidCouponToCart,
  clearCoupon as clearCouponState,
} from './cart-coupon';
import {
  addCartLine,
  clearCart,
  createEmptyCart,
  decrementStandardLineQuantity,
  incrementStandardLineQuantity,
  removeCartLine,
  replaceStandardCartLine,
  setStandardLineQuantity,
} from './cart-domain';
import type {
  CartCouponDefinition,
  CartLine,
  CartState,
  StandardCartLine,
} from './types';

export type CartAction =
  | {
      type: 'hydrate';
      payload: CartState;
    }
  | {
      type: 'add-line';
      payload: CartLine;
    }
  | {
      type: 'remove-line';
      payload: {
        lineId: string;
      };
    }
  | {
      type: 'set-standard-line-quantity';
      payload: {
        lineId: string;
        quantity: number;
      };
    }
  | {
      type: 'increment-standard-line-quantity';
      payload: {
        lineId: string;
      };
    }
  | {
      type: 'decrement-standard-line-quantity';
      payload: {
        lineId: string;
      };
    }
  | {
      type: 'replace-standard-line';
      payload: {
        lineId: string;
        nextLine: StandardCartLine;
      };
    }
  | {
      type: 'apply-coupon';
      payload: {
        coupon: CartCouponDefinition;
      };
    }
  | {
      type: 'apply-invalid-coupon';
      payload: {
        code: string;
        message: string;
      };
    }
  | {
      type: 'clear-coupon';
    }
  | {
      type: 'clear';
    };

export function cartReducer(
  state: CartState | undefined,
  action: CartAction,
): CartState {
  const currentState = state ?? createEmptyCart();

  switch (action.type) {
    case 'hydrate':
      return action.payload;
    case 'add-line':
      return addCartLine(currentState, action.payload);
    case 'remove-line':
      return removeCartLine(currentState, action.payload.lineId);
    case 'set-standard-line-quantity':
      return setStandardLineQuantity(
        currentState,
        action.payload.lineId,
        action.payload.quantity,
      );
    case 'increment-standard-line-quantity':
      return incrementStandardLineQuantity(currentState, action.payload.lineId);
    case 'decrement-standard-line-quantity':
      return decrementStandardLineQuantity(currentState, action.payload.lineId);
    case 'replace-standard-line':
      return replaceStandardCartLine(
        currentState,
        action.payload.lineId,
        action.payload.nextLine,
      );
    case 'apply-coupon':
      return applyCouponToCart(currentState, action.payload.coupon);
    case 'apply-invalid-coupon':
      return applyInvalidCouponToCart(
        currentState,
        action.payload.code,
        action.payload.message,
      );
    case 'clear-coupon':
      return clearCouponState(currentState);
    case 'clear':
      return clearCart();
    default:
      return currentState;
  }
}
