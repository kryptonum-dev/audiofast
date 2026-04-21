import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitCheckout } from '@/src/app/actions/checkout-submit';
import type { CartContextValue } from '@/src/global/b2c/cart/cart-context';
import { createEmptyCart } from '@/src/global/b2c/cart/cart-domain';
import { getCartTotals } from '@/src/global/b2c/cart/cart-selectors';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import type { CheckoutDraft } from '@/src/global/b2c/checkout/types';

import CheckoutPageClient from './CheckoutPageClient';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/src/global/b2c/cart/use-cart', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/src/app/actions/checkout-submit', () => ({
  submitCheckout: vi.fn(),
}));

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

function createStandardLine() {
  return createStandardCartLine({
    lineId: 'standard-line-1',
    productId: 'product-1',
    productKey: '/produkty/test-product/',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity: 2,
    unitPriceCents: 120_00,
    isReturnable: true,
    configurationSummary: [
      {
        label: 'Model',
        value: 'Reference',
      },
      {
        label: 'Kolor',
        value: 'Czarny',
      },
    ],
    product: {
      id: 'product-1',
      name: 'Test product',
      brandName: 'Test brand',
      kind: 'standard',
      image: { id: 'image-1' },
      basePrice: 120_00,
      configurationOptions: [],
      totalPrice: 120_00,
    },
  });
}

function createUseCartValue(
  overrides: Partial<CartContextValue> = {},
): CartContextValue {
  const cart = overrides.cart ?? {
    version: 1,
    lines: [createStandardLine()],
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
      lineDiscounts: {
        'standard-line-1': 10_00,
      },
    },
  };

  return {
    cart,
    totals: overrides.totals ?? getCartTotals(cart),
    isHydrated: overrides.isHydrated ?? true,
    isApplyingCoupon: overrides.isApplyingCoupon ?? false,
    isRevalidatingCoupon: overrides.isRevalidatingCoupon ?? false,
    couponRequestError: overrides.couponRequestError ?? null,
    couponRevalidationNotice: overrides.couponRevalidationNotice ?? null,
    canRetryCouponRevalidation: overrides.canRetryCouponRevalidation ?? false,
    addLine: vi.fn(),
    removeLine: vi.fn(),
    setStandardLineQuantity: vi.fn(),
    incrementStandardLineQuantity: vi.fn(),
    decrementStandardLineQuantity: vi.fn(),
    replaceStandardLine: vi.fn(),
    applyCartLineRevalidation: vi.fn(),
    applyCoupon: vi.fn(),
    revalidateHydratedCouponAfterInitialLoad: vi.fn(),
    clearCouponRequestError: vi.fn(),
    retryCouponRevalidation: vi.fn(),
    clearCoupon: vi.fn(),
    clearCart: vi.fn(),
    ...overrides,
  };
}

function createInitialDraft(overrides?: Partial<CheckoutDraft>): CheckoutDraft {
  return {
    contact: {
      email: 'jan@example.com',
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
    },
    shippingAddress: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '123123123',
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
      termsAccepted: false,
      privacyPolicyAccepted: false,
    },
    saveToProfile: false,
    updatedAt: null,
    ...overrides,
  };
}

describe('CheckoutPageClient', () => {
  const localStorageMock = {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
  };

  beforeEach(() => {
    let storageValue: string | null = null;

    vi.clearAllMocks();
    localStorageMock.getItem.mockImplementation(() => storageValue);
    localStorageMock.setItem.mockImplementation((_, value) => {
      storageValue = value;
    });
    localStorageMock.removeItem.mockImplementation(() => {
      storageValue = null;
    });

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    vi.mocked(useCart).mockReturnValue(createUseCartValue());
    vi.mocked(submitCheckout).mockResolvedValue({
      ok: true,
      value: {
        orderId: 'order-1',
        orderNumber: 'AF-2026-00001',
        createdAt: '2026-04-20T10:00:00.000Z',
        orderDraft: {
          customerEmail: 'jan@example.com',
          customerProfileId: null,
          customerSnapshot: {
            firstName: 'Jan',
            lastName: 'Kowalski',
            email: 'jan@example.com',
            phone: '123123123',
          },
          shippingAddressSnapshot: {
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '123123123',
            streetName: 'Testowa',
            buildingNumber: '1',
            apartmentNumber: null,
            postalCode: '00-001',
            city: 'Warszawa',
            country: 'PL',
          },
          invoiceData: null,
          subtotalCents: 240_00,
          discountTotalCents: 10_00,
          grandTotalCents: 230_00,
          usedDiscount: null,
          currentStatus: 'awaiting_payment',
          statusHistory: [],
          paymentProvider: 'przelewy24',
          paymentReference: null,
          paymentVerifiedAt: null,
          payableUntil: '2026-04-20T10:15:00.000Z',
          paidAt: null,
          shipmentData: null,
          items: [],
          sessionContext: {
            isAuthenticated: false,
            authUserId: null,
            authenticatedEmail: null,
            customerProfileId: null,
          },
          profilePersistence: {
            shouldEnsureProfileAfterSuccessfulPayment: true,
            shouldStoreCheckoutDefaultsAfterSuccessfulPayment: false,
            reason: 'create_profile_without_defaults',
          },
        },
        insertedItemCount: 1,
        input: createInitialDraft(),
        revalidatedCart: createUseCartValue().cart,
        paymentRegistrationInput: {
          provider: 'przelewy24',
          sessionId: 'AF-2026-00001',
          amountCents: 230_00,
          currency: 'PLN',
          description: 'Zamówienie AF-2026-00001',
          customerEmail: 'jan@example.com',
          customerName: 'Jan Kowalski',
          country: 'PL',
          language: 'pl',
          urlReturn: 'http://localhost:3000/podziekowania-za-zakup/',
          urlStatus: 'http://localhost:3000/api/platnosci/przelewy24/status/',
          orderNumber: 'AF-2026-00001',
          orderId: 'order-1',
        },
      },
    } as never);
  });

  it('renders the checkout structure with form sections and a read-only summary sidebar', () => {
    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={{
          paragraph: 'Masz pytania o zamówienie? Chętnie pomożemy.',
          phoneNumber: '855 855 855',
          image: { id: 'image-1' },
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Koszyk (1)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Kontakt' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Dane do dostawy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Kupuję jako' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Osoba fizyczna' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Firma/przedsiębiorca' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('heading', { name: 'Zgody i finalizacja' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Podsumowanie' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Kod rabatowy (WIOSNA10)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Wróć do koszyka' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '855 855 855' }),
    ).toBeInTheDocument();
  });

  it('locks the email field for authenticated customers and shows save-to-profile checkbox', () => {
    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked
        sessionContext={{
          isAuthenticated: true,
          authUserId: 'user-1',
          authenticatedEmail: 'jan@example.com',
          customerProfileId: 'profile-1',
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={null}
      />,
    );

    const emailField = screen.getByLabelText('Adres e-mail');

    expect(emailField).toHaveAttribute('readonly');
    expect(
      screen.getByLabelText('Zapisz te dane do kolejnych zamówień'),
    ).toBeInTheDocument();
  });

  it('keeps a separate delivery recipient optional and reveals it with a checkbox', async () => {
    const user = userEvent.setup();

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={null}
      />,
    );

    expect(screen.queryByLabelText('Imię odbiorcy')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Nazwisko odbiorcy'),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Telefon odbiorcy')).not.toBeInTheDocument();

    await user.click(
      screen.getByLabelText('Chcę wysłać zamówienie na inne dane odbiorcy'),
    );

    expect(screen.getByLabelText('Imię odbiorcy')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwisko odbiorcy')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon odbiorcy')).toBeInTheDocument();
  });

  it('reveals the company invoice branch and maps same-as-shipping data on submit', async () => {
    const user = userEvent.setup();

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('radio', { name: 'Firma/przedsiębiorca' }),
    );

    expect(screen.getByLabelText('Nazwa firmy')).toBeInTheDocument();
    expect(screen.getByLabelText('NIP')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Nazwa firmy'),
      'Audiofast Sp. z o.o.',
    );
    await user.type(screen.getByLabelText('NIP'), '1234567890');
    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(submitCheckout).toHaveBeenCalledTimes(1);
    });

    expect(submitCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice: {
          recipientType: 'company',
          companyName: 'Audiofast Sp. z o.o.',
          taxId: '1234567890',
          invoiceAddress: {
            streetName: 'Testowa',
            buildingNumber: '1',
            apartmentNumber: null,
            postalCode: '00-001',
            city: 'Warszawa',
            country: 'PL',
          },
        },
      }),
      expect.objectContaining({
        lines: expect.any(Array),
      }),
    );
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        '/podziekowania-za-zakup/?order=AF-2026-00001',
      );
    });
  });

  it('shows server-side field errors returned by checkout submit', async () => {
    const user = userEvent.setup();

    vi.mocked(submitCheckout).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'form_invalid',
        message:
          'Nie udało się przejść dalej, ponieważ formularz zawiera błędy.',
        fieldErrors: {
          contact: {
            email: 'Ten adres e-mail jest już w użyciu.',
          },
          formErrors: [
            'Nie udało się przejść dalej, ponieważ formularz zawiera błędy.',
          ],
        },
      },
      revalidatedCart: null,
      revalidationResults: null,
    } as never);

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    expect(
      await screen.findByText('Ten adres e-mail jest już w użyciu.'),
    ).toBeInTheDocument();
  });

  it('renders nested consent checkboxes with a select-all control', async () => {
    const user = userEvent.setup();

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={null}
      />,
    );

    const selectAll = screen.getByLabelText('Zaznacz wszystkie');
    const requiredConsent = screen.getByRole('checkbox', {
      name: /Akceptuję regulamin i politykę prywatności/,
    });
    const newsletterConsent = screen.getByRole('checkbox', {
      name: /Wyrażam zgodę na przetwarzanie moich danych osobowych przez Audiofast/i,
    });

    await user.click(selectAll);

    expect(requiredConsent).toBeChecked();
    expect(newsletterConsent).toBeChecked();
  });

  it('shows the blur overlay and dispatches revalidation when submit returns cart_invalid', async () => {
    const user = userEvent.setup();
    const applyCartLineRevalidation = vi.fn();

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({ applyCartLineRevalidation }),
    );

    vi.mocked(submitCheckout).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'cart_invalid',
        message:
          'Nie udało się przejść dalej, ponieważ koszyk zawiera pozycje wymagające poprawy.',
        blockingReasonCodes: ['invalid_lines'],
      },
      revalidatedCart: createUseCartValue().cart,
      revalidationResults: [
        {
          lineId: 'standard-line-1',
          lineType: 'standard',
          isBuyable: false,
          isConfigurationValid: true,
          unitPriceCents: 120_00,
        },
      ],
    } as never);

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(applyCartLineRevalidation).toHaveBeenCalledTimes(1);
    });

    expect(applyCartLineRevalidation).toHaveBeenCalledWith([
      expect.objectContaining({
        lineId: 'standard-line-1',
        isBuyable: false,
      }),
    ]);
    expect(
      await screen.findByRole('heading', {
        name: 'Koszyk wymaga aktualizacji',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Wróć do koszyka' }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the price-change notice and keeps the form usable when submit returns cart_price_updated', async () => {
    const user = userEvent.setup();
    const applyCartLineRevalidation = vi.fn();

    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({ applyCartLineRevalidation }),
    );

    vi.mocked(submitCheckout).mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'cart_price_updated',
        message:
          'Ceny w koszyku zostały zaktualizowane. Sprawdź nową łączną kwotę i potwierdź zamówienie ponownie.',
      },
      revalidatedCart: createUseCartValue().cart,
      revalidationResults: [
        {
          lineId: 'standard-line-1',
          lineType: 'standard',
          isBuyable: true,
          isConfigurationValid: true,
          unitPriceCents: 130_00,
        },
      ],
    } as never);

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={null}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', {
        name: /Akceptuję regulamin i politykę prywatności/,
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    );

    await waitFor(() => {
      expect(applyCartLineRevalidation).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText('Ceny zostały zaktualizowane'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Koszyk wymaga aktualizacji' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Przejdź do płatności' }),
    ).toBeEnabled();
  });

  it('renders an empty-cart guard when checkout is opened without lines', () => {
    vi.mocked(useCart).mockReturnValue(
      createUseCartValue({
        cart: createEmptyCart(),
        totals: getCartTotals(createEmptyCart()),
      }),
    );

    render(
      <CheckoutPageClient
        initialDraft={createInitialDraft()}
        isEmailLocked={false}
        sessionContext={{
          isAuthenticated: false,
          authUserId: null,
          authenticatedEmail: null,
          customerProfileId: null,
        }}
        customerProfile={null}
        canPrefillFromProfile={false}
        supportCard={null}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Twój koszyk jest pusty' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Wróć do koszyka' }),
    ).toBeInTheDocument();
  });
});
