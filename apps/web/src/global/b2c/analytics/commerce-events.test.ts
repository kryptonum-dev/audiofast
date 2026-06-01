import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/src/global/analytics/track-event';
import type {
  CartLine,
  CartState,
  CpoCartLine,
  StandardCartLine,
} from '@/src/global/b2c/cart/types';

import {
  buildAddPaymentInfoEvent,
  buildAddToCartEvent,
  buildBeginCheckoutEvent,
  buildGa4CartItem,
  buildPurchaseEvent,
  buildViewCartEvent,
  centsToAnalyticsValue,
  trackAddToCart,
  trackPurchaseOnce,
} from './commerce-events';

vi.mock('@/src/global/analytics/track-event', () => ({
  trackEvent: vi.fn(() => 'event-1'),
}));

const standardLine: StandardCartLine = {
  lineId: 'standard-line-1',
  lineType: 'standard',
  productId: 'product-1',
  productKey: '/produkty/test-product/',
  productName: 'Test product',
  brandName: 'Test brand',
  quantity: 2,
  unitPriceCents: 123_45,
  isReturnable: true,
  configurationSelection: {
    variantId: 'variant-1',
    selectedOptions: {
      model: 'reference',
    },
  },
  configurationSummary: [
    {
      label: 'Model',
      value: 'Reference',
    },
  ],
  configurationSignature: '[{"label":"Model","value":"Reference"}]',
  issues: [],
  product: {
    id: 'product-1',
    name: 'Test product',
    brandName: 'Test brand',
    kind: 'standard',
    image: { id: 'image-1' },
    basePrice: 123_45,
    configurationOptions: [
      {
        label: 'Model',
        value: 'Reference',
        priceDelta: 0,
      },
    ],
    totalPrice: 123_45,
  },
};

const cpoLine: CpoCartLine = {
  lineId: 'cpo-line-1',
  lineType: 'cpo',
  productId: 'cpo-1',
  productKey: '/certyfikowany-sprzet-uzywany/test-cpo/',
  productName: 'Test CPO',
  brandName: 'CPO brand',
  quantity: 1,
  unitPriceCents: 999_00,
  isReturnable: false,
  availabilityStatus: 'available',
  issues: [],
  product: {
    id: 'cpo-1',
    name: 'Test CPO',
    brandName: 'CPO brand',
    kind: 'cpo',
    image: { id: 'image-2' },
    basePrice: 999_00,
    configurationOptions: [],
    totalPrice: 999_00,
  },
};

const cart: CartState = {
  version: 1,
  lines: [standardLine, cpoLine],
  coupon: {
    code: 'WIOSNA10',
    couponId: 'coupon-1',
    discountType: 'fixed_order',
    discountValueCents: 10_00,
    discountPercent: null,
    productKeys: null,
    matchedProductKeys: ['/produkty/test-product/'],
    isValid: true,
    message: null,
    totalDiscountCents: 10_00,
    lineDiscounts: {},
  },
};

describe('commerce events', () => {
  beforeEach(() => {
    let storageValue: string | null = null;

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => storageValue),
        setItem: vi.fn((_, value: string) => {
          storageValue = value;
        }),
      },
      configurable: true,
    });
    vi.mocked(trackEvent).mockClear();
  });

  it('converts cents into analytics PLN values', () => {
    expect(centsToAnalyticsValue(123_45)).toBe(123.45);
  });

  it('maps a standard cart line into a GA4 ecommerce item', () => {
    expect(buildGa4CartItem(standardLine)).toEqual({
      item_id: '/produkty/test-product/',
      item_name: 'Test product',
      item_brand: 'Test brand',
      item_variant: '[{"label":"Model","value":"Reference"}]',
      item_category: 'standard',
      price: 123.45,
      quantity: 2,
    });
  });

  it('maps a CPO cart line into a GA4 ecommerce item', () => {
    expect(buildGa4CartItem(cpoLine)).toEqual({
      item_id: '/certyfikowany-sprzet-uzywany/test-cpo/',
      item_name: 'Test CPO',
      item_brand: 'CPO brand',
      item_variant: 'CPO',
      item_category: 'cpo',
      price: 999,
      quantity: 1,
    });
  });

  it('builds AddToCart payloads for Meta and GA4 from one cart line', () => {
    expect(buildAddToCartEvent(standardLine)).toEqual({
      meta: {
        eventName: 'AddToCart',
        params: {
          content_ids: ['/produkty/test-product/'],
          content_type: 'product',
          content_name: 'Test product',
          value: 246.9,
          currency: 'PLN',
          line_type: 'standard',
        },
      },
      ga4: {
        eventName: 'add_to_cart',
        params: {
          currency: 'PLN',
          value: 246.9,
          items: [buildGa4CartItem(standardLine)],
        },
      },
    });
  });

  it('tracks AddToCart through the shared analytics helper', () => {
    const eventId = trackAddToCart(cpoLine as CartLine);

    expect(eventId).toBe('event-1');
    expect(trackEvent).toHaveBeenCalledWith(buildAddToCartEvent(cpoLine));
  });

  it('builds view-cart and begin-checkout events from cart totals', () => {
    expect(buildViewCartEvent(cart)).toMatchObject({
      meta: {
        eventName: 'ViewCart',
        params: {
          content_ids: [
            '/produkty/test-product/',
            '/certyfikowany-sprzet-uzywany/test-cpo/',
          ],
          num_items: 3,
          value: 1235.9,
          currency: 'PLN',
          coupon: 'WIOSNA10',
        },
      },
      ga4: {
        eventName: 'view_cart',
        params: {
          value: 1235.9,
          currency: 'PLN',
          coupon: 'WIOSNA10',
        },
      },
    });
    expect(buildBeginCheckoutEvent(cart).ga4.eventName).toBe('begin_checkout');
  });

  it('builds add-payment-info with checkout user matching fields', () => {
    expect(
      buildAddPaymentInfoEvent({
        cart,
        orderNumber: 'AF-2026-00001',
        paymentType: 'przelewy24',
        checkoutInput: {
          contact: {
            email: 'jan@example.com',
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '123456789',
          },
          shippingAddress: {
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '123456789',
            streetName: 'Testowa',
            buildingNumber: '1',
            apartmentNumber: null,
            postalCode: '00-001',
            city: 'Warszawa',
            country: 'PL',
          },
          invoice: {
            recipientType: 'private',
            companyName: null,
            taxId: null,
            invoiceAddress: null,
          },
          consents: {
            termsAccepted: true,
            privacyPolicyAccepted: true,
          },
          newsletterOptIn: false,
          saveToProfile: false,
        },
      }),
    ).toMatchObject({
      user: {
        email: 'jan@example.com',
        first_name: 'Jan',
        last_name: 'Kowalski',
        external_id: 'AF-2026-00001',
      },
      meta: {
        eventName: 'AddPaymentInfo',
        params: {
          payment_type: 'przelewy24',
          order_number: 'AF-2026-00001',
        },
      },
      ga4: {
        eventName: 'add_payment_info',
      },
    });
  });

  it('builds purchase events and dedupes them by order number', () => {
    const payload = {
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      customerEmail: 'jan@example.com',
      customerProfileId: 'profile-1',
      customer: {
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '123456789',
      },
      shippingAddress: {
        city: 'Warszawa',
        postalCode: '00-001',
        country: 'PL',
      },
      subtotalCents: 123_45,
      discountTotalCents: 10_00,
      grandTotalCents: 113_45,
      couponCode: 'WIOSNA10',
      items: [
        {
          lineType: 'standard' as const,
          productKey: '/produkty/test-product/',
          productName: 'Test product',
          brandName: 'Test brand',
          quantity: 1,
          unitPriceCents: 123_45,
          lineDiscountTotalCents: 10_00,
          lineTotalCents: 113_45,
        },
      ],
    };

    expect(buildPurchaseEvent(payload)).toMatchObject({
      user: {
        email: 'jan@example.com',
        external_id: 'profile-1',
      },
      meta: {
        eventName: 'Purchase',
        params: {
          value: 113.45,
          order_number: 'AF-2026-00001',
          coupon: 'WIOSNA10',
        },
      },
      ga4: {
        eventName: 'purchase',
        params: {
          transaction_id: 'AF-2026-00001',
          value: 113.45,
        },
      },
    });

    expect(trackPurchaseOnce(payload)).toBe('event-1');
    expect(trackPurchaseOnce(payload)).toBeNull();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('allows purchase tracking again when the stored dedupe marker is older than 90 days', () => {
    const now = new Date('2026-05-08T12:00:00.000Z').getTime();

    vi.spyOn(Date, 'now').mockReturnValue(now);
    window.localStorage.setItem(
      'audiofast:b2c-analytics:purchase',
      JSON.stringify({
        'AF-2026-00001': now - 91 * 24 * 60 * 60 * 1000,
      }),
    );

    const payload = {
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      customerEmail: null,
      customerProfileId: null,
      customer: {},
      shippingAddress: {},
      subtotalCents: 120_00,
      discountTotalCents: 0,
      grandTotalCents: 120_00,
      couponCode: null,
      items: [
        {
          lineType: 'standard' as const,
          productKey: '/produkty/test-product/',
          productName: 'Test product',
          brandName: 'Test brand',
          quantity: 1,
          unitPriceCents: 120_00,
          lineDiscountTotalCents: 0,
          lineTotalCents: 120_00,
        },
      ],
    };

    expect(trackPurchaseOnce(payload)).toBe('event-1');
    expect(trackPurchaseOnce(payload)).toBeNull();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});
