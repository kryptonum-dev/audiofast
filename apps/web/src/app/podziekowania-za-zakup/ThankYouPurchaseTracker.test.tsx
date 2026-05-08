import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackPurchaseOnce } from '@/src/global/b2c/analytics/commerce-events';

import ThankYouPurchaseTracker from './ThankYouPurchaseTracker';

vi.mock('@/src/global/b2c/analytics/commerce-events', () => ({
  trackPurchaseOnce: vi.fn(),
}));

const payload = {
  orderId: 'order-1',
  orderNumber: 'AF-2026-00001',
  customerEmail: 'jan@example.com',
  customerProfileId: null,
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
  subtotalCents: 120_00,
  discountTotalCents: 0,
  grandTotalCents: 120_00,
  couponCode: null,
  items: [
    {
      lineType: 'standard' as const,
      productKey: '/produkty/test/',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 120_00,
      lineDiscountTotalCents: 0,
      lineTotalCents: 120_00,
    },
  ],
};

describe('ThankYouPurchaseTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks the paid purchase payload on mount', () => {
    render(<ThankYouPurchaseTracker payload={payload} />);

    expect(trackPurchaseOnce).toHaveBeenCalledWith(payload);
  });
});
