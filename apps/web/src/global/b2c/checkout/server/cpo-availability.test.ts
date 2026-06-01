import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/src/global/supabase/admin';

import type { CheckoutOrderDraft } from '../order-draft';
import {
  markCpoItemsSoldForOrder,
  reserveCpoItemsForOrder,
} from './cpo-availability';

const sanityClient = {
  fetch: vi.fn(),
  transaction: vi.fn(),
  patch: vi.fn(),
};

vi.mock('@sanity/client', () => ({
  createClient: vi.fn(() => sanityClient),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/src/global/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

function createPatchBuilder() {
  return {
    ifRevisionId: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    unset: vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue({}),
  };
}

function createOrderDraft(): CheckoutOrderDraft {
  return {
    customerEmail: 'jan@example.com',
    customerProfileId: null,
    customerSnapshot: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      email: 'jan@example.com',
      phone: null,
    },
    shippingAddressSnapshot: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: null,
      streetName: 'Testowa',
      buildingNumber: '1',
      apartmentNumber: null,
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    },
    invoiceData: null,
    subtotalCents: 200_00,
    discountTotalCents: 0,
    grandTotalCents: 200_00,
    usedDiscount: null,
    currentStatus: 'awaiting_payment',
    statusHistory: [],
    paymentProvider: 'przelewy24',
    paymentReference: null,
    paymentVerifiedAt: null,
    payableUntil: '2026-04-20T10:15:00.000Z',
    paidAt: null,
    shipmentData: null,
    items: [
      {
        lineId: 'cpo-line-1',
        lineType: 'cpo',
        linePosition: 1,
        productId: 'cpo-1',
        productKey: '/certyfikowany-sprzet-uzywany/test-cpo/',
        productName: 'Test CPO',
        brandName: 'Test brand',
        quantity: 1,
        unitPriceCents: 200_00,
        lineSubtotalCents: 200_00,
        lineDiscountTotalCents: 0,
        lineTotalCents: 200_00,
        isReturnable: false,
        itemSnapshot: {
          availabilityStatusAtPurchase: 'available',
          archivedAtPurchase: false,
          productImage: null,
        },
      },
    ],
    sessionContext: {
      isAuthenticated: false,
      authUserId: null,
      authenticatedEmail: null,
      customerProfileId: null,
    },
    profilePersistence: {
      shouldEnsureProfileAfterSuccessfulPayment: false,
      shouldStoreCheckoutDefaultsAfterSuccessfulPayment: false,
      authUserIdAtCheckout: null,
      reason: 'create_profile_without_defaults',
    },
  };
}

describe('CPO availability transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SANITY_API_WRITE_TOKEN', 'sanity-write-token');
    vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', 'project-id');
    vi.stubEnv('NEXT_PUBLIC_SANITY_DATASET', 'production');

    sanityClient.fetch.mockImplementation(async (_query, params) => {
      if ('slug' in params) {
        return {
          _id: 'cpo-1',
          _rev: 'rev-1',
          slug: params.slug,
          isArchived: false,
          isSellableOnline: true,
          priceCents: 200_00,
          availabilityStatus: 'available',
          holdUntil: null,
          holdOrderNumber: null,
          holdPaymentSessionId: null,
          soldOrderNumber: null,
        };
      }

      return params.slugs.map((slug: string) => ({
        _id: 'cpo-1',
        _rev: 'rev-1',
        slug,
        isArchived: false,
        isSellableOnline: true,
        priceCents: 200_00,
        availabilityStatus: 'available',
        holdUntil: null,
        holdOrderNumber: null,
        holdPaymentSessionId: null,
        soldOrderNumber: null,
      }));
    });
  });

  it('reserves buyable CPO items with an optimistic Sanity revision patch', async () => {
    const transactionPatch = vi.fn();
    const transactionCommit = vi.fn().mockResolvedValue({});
    sanityClient.transaction.mockReturnValue({
      patch: transactionPatch,
      commit: transactionCommit,
    });

    await reserveCpoItemsForOrder({
      orderDraft: createOrderDraft(),
      orderNumber: 'AF-2026-00001',
      paymentSessionId: 'AF-2026-00001-session',
      now: new Date('2026-04-20T10:00:00.000Z'),
    });

    expect(transactionPatch).toHaveBeenCalledWith(
      'cpo-1',
      expect.any(Function),
    );

    const patchBuilder = createPatchBuilder();
    transactionPatch.mock.calls[0]?.[1](patchBuilder);

    expect(patchBuilder.ifRevisionId).toHaveBeenCalledWith('rev-1');
    expect(patchBuilder.set).toHaveBeenCalledWith({
      availabilityStatus: 'on_hold',
      holdUntil: '2026-04-20T10:15:00.000Z',
      holdOrderNumber: 'AF-2026-00001',
      holdPaymentSessionId: 'AF-2026-00001-session',
      availabilityUpdatedAt: '2026-04-20T10:00:00.000Z',
    });
    expect(transactionCommit).toHaveBeenCalledTimes(1);
  });

  it('marks held CPO items sold after payment confirmation', async () => {
    const patchBuilder = createPatchBuilder();
    sanityClient.patch.mockReturnValue(patchBuilder);
    sanityClient.fetch.mockResolvedValueOnce([
      {
        _id: 'cpo-1',
        _rev: 'rev-2',
        slug: '/certyfikowany-sprzet-uzywany/test-cpo/',
        availabilityStatus: 'on_hold',
        holdOrderNumber: 'AF-2026-00001',
        holdPaymentSessionId: 'AF-2026-00001-session',
        soldOrderNumber: null,
      },
    ]);

    const eqLineType = vi.fn().mockResolvedValue({
      data: [
        {
          product_key: '/certyfikowany-sprzet-uzywany/test-cpo/',
        },
      ],
      error: null,
    });
    const eqOrderId = vi.fn(() => ({
      eq: eqLineType,
    }));
    const select = vi.fn(() => ({
      eq: eqOrderId,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select,
      })),
    } as never);

    await markCpoItemsSoldForOrder({
      orderId: 'order-1',
      orderNumber: 'AF-2026-00001',
      paymentSessionId: 'AF-2026-00001-session',
      soldAt: '2026-04-20T10:05:00.000Z',
    });

    expect(sanityClient.patch).toHaveBeenCalledWith('cpo-1');
    expect(patchBuilder.ifRevisionId).toHaveBeenCalledWith('rev-2');
    expect(patchBuilder.set).toHaveBeenCalledWith({
      availabilityStatus: 'sold_out',
      soldOrderNumber: 'AF-2026-00001',
      availabilityUpdatedAt: '2026-04-20T10:05:00.000Z',
    });
    expect(patchBuilder.unset).toHaveBeenCalledWith([
      'holdUntil',
      'holdOrderNumber',
      'holdPaymentSessionId',
    ]);
  });
});
