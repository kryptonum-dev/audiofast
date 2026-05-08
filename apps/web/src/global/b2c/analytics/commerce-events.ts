import type { TrackEventUser } from '@/src/global/analytics/track-event';
import { trackEvent } from '@/src/global/analytics/track-event';
import {
  getCartGrandTotalCents,
  getCartItemCount,
} from '@/src/global/b2c/cart/cart-selectors';
import type { CartLine, CartState } from '@/src/global/b2c/cart/types';
import type { CheckoutSubmitInput } from '@/src/global/b2c/checkout/types';

const ANALYTICS_CURRENCY = 'PLN';
const PURCHASE_STORAGE_KEY = 'audiofast:b2c-analytics:purchase';
const PURCHASE_DEDUPE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type CommerceOrderItemAnalyticsPayload = {
  lineType: 'standard' | 'cpo';
  productKey: string;
  productName: string;
  brandName: string;
  quantity: number;
  unitPriceCents: number;
  lineDiscountTotalCents: number;
  lineTotalCents: number;
};

export type CommercePurchaseAnalyticsPayload = {
  orderId: string;
  orderNumber: string;
  customerEmail: string | null;
  customerProfileId: string | null;
  customer: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
  shippingAddress: {
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  couponCode: string | null;
  items: CommerceOrderItemAnalyticsPayload[];
};

export function centsToAnalyticsValue(cents: number): number {
  return Math.round(cents) / 100;
}

function resolveCartLineVariant(line: CartLine): string {
  return line.lineType === 'cpo' ? 'CPO' : line.configurationSignature;
}

export function buildGa4CartItem(line: CartLine): Record<string, unknown> {
  return {
    item_id: line.productKey,
    item_name: line.productName,
    item_brand: line.brandName,
    item_variant: resolveCartLineVariant(line),
    item_category: line.lineType,
    price: centsToAnalyticsValue(line.unitPriceCents),
    quantity: line.quantity,
  };
}

export function buildGa4OrderItem(
  item: CommerceOrderItemAnalyticsPayload,
): Record<string, unknown> {
  return {
    item_id: item.productKey,
    item_name: item.productName,
    item_brand: item.brandName,
    item_variant: item.lineType === 'cpo' ? 'CPO' : undefined,
    item_category: item.lineType,
    price: centsToAnalyticsValue(item.unitPriceCents),
    quantity: item.quantity,
    ...(item.lineDiscountTotalCents > 0
      ? { discount: centsToAnalyticsValue(item.lineDiscountTotalCents) }
      : {}),
  };
}

function getCartCouponCode(cart: CartState): string | undefined {
  return cart.coupon?.isValid && cart.coupon.code
    ? cart.coupon.code
    : undefined;
}

function buildCartEventBaseParams(cart: CartState) {
  return {
    value: centsToAnalyticsValue(getCartGrandTotalCents(cart)),
    currency: ANALYTICS_CURRENCY,
    coupon: getCartCouponCode(cart),
  };
}

function buildMetaCartParams(cart: CartState) {
  return {
    content_ids: cart.lines.map((line) => line.productKey),
    content_type: 'product',
    num_items: getCartItemCount(cart),
    value: centsToAnalyticsValue(getCartGrandTotalCents(cart)),
    currency: ANALYTICS_CURRENCY,
    coupon: getCartCouponCode(cart),
  };
}

export function buildAddToCartEvent(line: CartLine) {
  const value = centsToAnalyticsValue(line.unitPriceCents * line.quantity);

  return {
    meta: {
      eventName: 'AddToCart' as const,
      params: {
        content_ids: [line.productKey],
        content_type: 'product',
        content_name: line.productName,
        value,
        currency: ANALYTICS_CURRENCY,
        line_type: line.lineType,
      },
    },
    ga4: {
      eventName: 'add_to_cart' as const,
      params: {
        currency: ANALYTICS_CURRENCY,
        value,
        items: [buildGa4CartItem(line)],
      },
    },
  };
}

export function trackAddToCart(line: CartLine) {
  return trackEvent(buildAddToCartEvent(line));
}

export function buildViewCartEvent(cart: CartState) {
  return {
    meta: {
      eventName: 'ViewCart' as const,
      params: buildMetaCartParams(cart),
    },
    ga4: {
      eventName: 'view_cart' as const,
      params: {
        ...buildCartEventBaseParams(cart),
        items: cart.lines.map(buildGa4CartItem),
      },
    },
  };
}

export function trackViewCart(cart: CartState) {
  return trackEvent(buildViewCartEvent(cart));
}

export function buildBeginCheckoutEvent(cart: CartState) {
  return {
    meta: {
      eventName: 'InitiateCheckout' as const,
      params: buildMetaCartParams(cart),
    },
    ga4: {
      eventName: 'begin_checkout' as const,
      params: {
        ...buildCartEventBaseParams(cart),
        items: cart.lines.map(buildGa4CartItem),
      },
    },
  };
}

export function trackBeginCheckout(cart: CartState) {
  return trackEvent(buildBeginCheckoutEvent(cart));
}

export function buildAnalyticsUserFromCheckoutInput(
  input: CheckoutSubmitInput,
  externalId?: string | null,
): TrackEventUser {
  return {
    email: input.contact.email,
    phone: input.contact.phone ?? undefined,
    first_name: input.contact.firstName,
    last_name: input.contact.lastName,
    city: input.shippingAddress.city,
    postal_code: input.shippingAddress.postalCode,
    country_code: input.shippingAddress.country.toLowerCase(),
    ...(externalId ? { external_id: externalId } : {}),
  };
}

export function buildAddPaymentInfoEvent(args: {
  cart: CartState;
  orderNumber: string;
  paymentType: 'przelewy24';
  checkoutInput: CheckoutSubmitInput;
}) {
  return {
    user: buildAnalyticsUserFromCheckoutInput(
      args.checkoutInput,
      args.orderNumber,
    ),
    meta: {
      eventName: 'AddPaymentInfo' as const,
      params: {
        ...buildMetaCartParams(args.cart),
        payment_type: args.paymentType,
        order_number: args.orderNumber,
      },
    },
    ga4: {
      eventName: 'add_payment_info' as const,
      params: {
        ...buildCartEventBaseParams(args.cart),
        payment_type: args.paymentType,
        items: args.cart.lines.map(buildGa4CartItem),
      },
    },
  };
}

export function trackAddPaymentInfo(args: {
  cart: CartState;
  orderNumber: string;
  paymentType: 'przelewy24';
  checkoutInput: CheckoutSubmitInput;
}) {
  return trackEvent(buildAddPaymentInfoEvent(args));
}

function buildAnalyticsUserFromPurchase(
  payload: CommercePurchaseAnalyticsPayload,
): TrackEventUser {
  return {
    email: payload.customerEmail ?? undefined,
    phone: payload.customer.phone ?? undefined,
    first_name: payload.customer.firstName ?? undefined,
    last_name: payload.customer.lastName ?? undefined,
    city: payload.shippingAddress.city ?? undefined,
    postal_code: payload.shippingAddress.postalCode ?? undefined,
    country_code: payload.shippingAddress.country?.toLowerCase() ?? undefined,
    external_id: payload.customerProfileId ?? payload.orderNumber,
  };
}

export function buildPurchaseEvent(payload: CommercePurchaseAnalyticsPayload) {
  return {
    user: buildAnalyticsUserFromPurchase(payload),
    meta: {
      eventName: 'Purchase' as const,
      params: {
        content_ids: payload.items.map((item) => item.productKey),
        content_type: 'product',
        num_items: payload.items.reduce(
          (total, item) => total + item.quantity,
          0,
        ),
        value: centsToAnalyticsValue(payload.grandTotalCents),
        currency: ANALYTICS_CURRENCY,
        order_number: payload.orderNumber,
        coupon: payload.couponCode ?? undefined,
      },
    },
    ga4: {
      eventName: 'purchase' as const,
      params: {
        transaction_id: payload.orderNumber,
        currency: ANALYTICS_CURRENCY,
        value: centsToAnalyticsValue(payload.grandTotalCents),
        shipping: 0,
        coupon: payload.couponCode ?? undefined,
        items: payload.items.map(buildGa4OrderItem),
      },
    },
  };
}

function readTrackedPurchaseMap(): Record<string, number> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(PURCHASE_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const now = Date.now();
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([, trackedAt]) =>
        typeof trackedAt === 'number' &&
        now - trackedAt <= PURCHASE_DEDUPE_RETENTION_MS,
    );

    return Object.fromEntries(entries) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeTrackedPurchaseMap(value: Record<string, number>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(value));
}

export function hasTrackedPurchase(orderNumber: string): boolean {
  return typeof readTrackedPurchaseMap()[orderNumber] === 'number';
}

export function markPurchaseTracked(orderNumber: string) {
  writeTrackedPurchaseMap({
    ...readTrackedPurchaseMap(),
    [orderNumber]: Date.now(),
  });
}

export function trackPurchaseOnce(payload: CommercePurchaseAnalyticsPayload) {
  if (hasTrackedPurchase(payload.orderNumber)) {
    return null;
  }

  const eventId = trackEvent(buildPurchaseEvent(payload));
  markPurchaseTracked(payload.orderNumber);

  return eventId;
}
