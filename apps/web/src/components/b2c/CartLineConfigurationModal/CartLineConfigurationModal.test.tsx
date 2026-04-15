import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';
import type { CompletePricingData } from '@/src/global/supabase/types';

import CartLineConfigurationModal from '.';

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock(
  '@/src/components/b2c/CartLineConfigurationModal/CartLineConfigurator',
  async () => {
    const React = await import('react');

    function MockCartLineConfigurator({
      initialSelection,
      onSelectionChange,
    }: {
      initialSelection?: {
        variantId: string | null;
        selectedOptions: Record<string, string>;
      } | null;
      onSelectionChange?: (...args: unknown[]) => void;
    }) {
      React.useEffect(() => {
        const currentVariantId = initialSelection?.variantId ?? 'variant-1';
        const currentSelectedOptions = initialSelection?.selectedOptions ?? {
          finish: 'matte',
        };
        const isVariantTwo = currentVariantId === 'variant-2';

        onSelectionChange?.(
          {
            variantId: currentVariantId,
            selectedOptions: currentSelectedOptions,
            calculatedPrice: isVariantTwo ? 150_00 : 120_00,
          },
          {
            basePrice: isVariantTwo ? 120_00 : 100_00,
            options: [
              {
                label: 'Finish',
                value: isVariantTwo ? 'Walnut' : 'Matte',
                priceDelta: isVariantTwo ? 30_00 : 0,
              },
            ],
            totalPrice: isVariantTwo ? 150_00 : 120_00,
          },
        );
      }, [initialSelection, onSelectionChange]);

      const handleChange = () => {
        onSelectionChange?.(
          {
            variantId: 'variant-2',
            selectedOptions: {
              finish: 'walnut',
            },
            calculatedPrice: 150_00,
          },
          {
            basePrice: 120_00,
            options: [
              {
                label: 'Finish',
                value: 'Walnut',
                priceDelta: 30_00,
              },
            ],
            totalPrice: 150_00,
          },
        );
      };

      return (
        <>
          <div
            data-testid="cart-line-configurator"
            data-initial-selection={JSON.stringify(initialSelection) ?? 'null'}
          />
          <button type="button" onClick={handleChange}>
            Zmień konfigurację testowo
          </button>
        </>
      );
    }

    return {
      default: MockCartLineConfigurator,
    };
  },
);

function createStandardLine() {
  return createStandardCartLine({
    lineId: 'line-1',
    productId: 'product-1',
    productKey: '/produkty/test',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity: 2,
    unitPriceCents: 120_00,
    isReturnable: true,
    configurationSelection: {
      variantId: 'variant-1',
      selectedOptions: {
        finish: 'matte',
      },
    },
    product: {
      id: 'product-1',
      name: 'Test product',
      brandName: 'Test brand',
      kind: 'standard',
      image: { id: 'image-1' },
      basePrice: 100_00,
      configurationOptions: [
        {
          label: 'Finish',
          value: 'Matte',
          priceDelta: 0,
        },
      ],
      totalPrice: 120_00,
    },
  });
}

function createMatchingStandardLine() {
  return createStandardCartLine({
    lineId: 'line-2',
    productId: 'product-1',
    productKey: '/produkty/test',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity: 1,
    unitPriceCents: 150_00,
    isReturnable: true,
    configurationSelection: {
      variantId: 'variant-2',
      selectedOptions: {
        finish: 'walnut',
      },
    },
    product: {
      id: 'product-1',
      name: 'Test product',
      brandName: 'Test brand',
      kind: 'standard',
      image: { id: 'image-1' },
      basePrice: 120_00,
      configurationOptions: [
        {
          label: 'Finish',
          value: 'Walnut',
          priceDelta: 30_00,
        },
      ],
      totalPrice: 150_00,
    },
  });
}

const pricingData = {
  variants: [
    {
      id: 'variant-1',
      price_key: '/produkty/test',
      brand: 'Brand',
      product: 'Product',
      model: 'Default',
      base_price_cents: 100_00,
      currency: 'PLN',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      groups: [
        {
          id: 'finish',
          variant_id: 'variant-1',
          name: 'Finish',
          input_type: 'select',
          unit: null,
          required: true,
          position: 0,
          parent_value_id: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          values: [
            {
              id: 'matte',
              group_id: 'finish',
              name: 'Matte',
              price_delta_cents: 0,
              position: 0,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          numeric_rule: null,
        },
      ],
    },
    {
      id: 'variant-2',
      price_key: '/produkty/test',
      brand: 'Brand',
      product: 'Product',
      model: 'Walnut',
      base_price_cents: 120_00,
      currency: 'PLN',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      groups: [
        {
          id: 'finish',
          variant_id: 'variant-2',
          name: 'Finish',
          input_type: 'select',
          unit: null,
          required: true,
          position: 0,
          parent_value_id: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          values: [
            {
              id: 'walnut',
              group_id: 'finish',
              name: 'Walnut',
              price_delta_cents: 30_00,
              position: 0,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          numeric_rule: null,
        },
      ],
    },
  ],
  hasMultipleModels: true,
  lowestPrice: 100_00,
} satisfies CompletePricingData;

const foundPricingState = {
  status: 'found' as const,
  pricingData,
};

describe('CartLineConfigurationModal', () => {
  it('requests pricing when opened without a prefetched cache entry', async () => {
    const onLoadPricing = vi.fn();

    render(
      <CartLineConfigurationModal
        isOpen
        line={createStandardLine()}
        standardLines={[]}
        pricingState={{ status: 'idle' }}
        onLoadPricing={onLoadPricing}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(onLoadPricing).toHaveBeenCalledWith('/produkty/test'),
    );
    expect(
      screen.getByText('Wczytujemy aktualną konfigurację produktu...'),
    ).toBeInTheDocument();
  });

  it('loads pricing data, preloads the saved selection, and saves the updated line', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <CartLineConfigurationModal
        isOpen
        line={createStandardLine()}
        standardLines={[]}
        pricingState={foundPricingState}
        onLoadPricing={vi.fn()}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('cart-line-configurator')).toHaveAttribute(
        'data-initial-selection',
        JSON.stringify({
          variantId: 'variant-1',
          selectedOptions: {
            finish: 'matte',
          },
        }),
      ),
    );

    await waitFor(() =>
      expect(screen.getByText(/120.*zł/)).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole('button', { name: 'Zmień konfigurację testowo' }),
    );

    await waitFor(() =>
      expect(screen.getByText(/150.*zł/)).toBeInTheDocument(),
    );

    expect(screen.getByText(/120.*zł/)).toBeInTheDocument();
    expect(screen.queryByText('Cena całkowita:')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Zapisz konfigurację' }),
    );

    expect(onSave).toHaveBeenCalledWith(
      'line-1',
      expect.objectContaining({
        lineId: 'line-1',
        productKey: '/produkty/test',
        unitPriceCents: 150_00,
        quantity: 2,
        configurationSelection: {
          variantId: 'variant-2',
          selectedOptions: {
            finish: 'walnut',
          },
        },
        configurationSummary: [
          {
            label: 'Finish',
            value: 'Walnut',
          },
        ],
        product: expect.objectContaining({
          basePrice: 120_00,
          totalPrice: 150_00,
          configurationOptions: [
            {
              label: 'Finish',
              value: 'Walnut',
              priceDelta: 30_00,
            },
          ],
        }),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      'Konfiguracja produktu została zaktualizowana.',
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prompts before closing when the configuration has unsaved changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <CartLineConfigurationModal
        isOpen
        line={createStandardLine()}
        standardLines={[]}
        pricingState={foundPricingState}
        onLoadPricing={vi.fn()}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('cart-line-configurator')).toHaveAttribute(
        'data-initial-selection',
        JSON.stringify({
          variantId: 'variant-1',
          selectedOptions: {
            finish: 'matte',
          },
        }),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Zmień konfigurację testowo' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Zamknij edycję konfiguracji' }),
    );

    expect(screen.getByText('Zamknąć bez zapisywania?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Kontynuuj edycję' }));

    expect(
      screen.queryByText('Zamknąć bez zapisywania?'),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Zamknij edycję konfiguracji' }),
    );
    await user.click(screen.getByRole('button', { name: 'Odrzuć zmiany' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('warns before saving when the edited configuration would merge with another line', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <CartLineConfigurationModal
        isOpen
        line={createStandardLine()}
        standardLines={[createStandardLine(), createMatchingStandardLine()]}
        pricingState={foundPricingState}
        onLoadPricing={vi.fn()}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('cart-line-configurator')).toHaveAttribute(
        'data-initial-selection',
        JSON.stringify({
          variantId: 'variant-1',
          selectedOptions: {
            finish: 'matte',
          },
        }),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Zmień konfigurację testowo' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Zapisz konfigurację' }),
    );

    expect(screen.getByText('Zapisać i połączyć pozycje?')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Wróć do edycji' }));

    expect(
      screen.queryByText('Zapisać i połączyć pozycje?'),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Zapisz konfigurację' }),
    );
    await user.click(screen.getByRole('button', { name: 'Zapisz i połącz' }));

    expect(onSave).toHaveBeenCalledWith(
      'line-1',
      expect.objectContaining({
        lineId: 'line-1',
        configurationSelection: {
          variantId: 'variant-2',
          selectedOptions: {
            finish: 'walnut',
          },
        },
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses the merge prompt on backdrop click without opening the discard prompt', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <CartLineConfigurationModal
        isOpen
        line={createStandardLine()}
        standardLines={[createStandardLine(), createMatchingStandardLine()]}
        pricingState={foundPricingState}
        onLoadPricing={vi.fn()}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('cart-line-configurator')).toHaveAttribute(
        'data-initial-selection',
        JSON.stringify({
          variantId: 'variant-1',
          selectedOptions: {
            finish: 'matte',
          },
        }),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Zmień konfigurację testowo' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Zapisz konfigurację' }),
    );

    expect(screen.getByText('Zapisać i połączyć pozycje?')).toBeInTheDocument();

    await user.click(
      screen.getByRole('dialog', { name: 'Edytuj konfigurację' }),
    );

    expect(
      screen.queryByText('Zapisać i połączyć pozycje?'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Zamknąć bez zapisywania?'),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to default configurator mode when the stored variant is unavailable', async () => {
    const unavailableLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 120_00,
      isReturnable: true,
      configurationSelection: {
        variantId: 'missing-variant',
        selectedOptions: {
          finish: 'matte',
        },
      },
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 120_00,
      },
    });

    render(
      <CartLineConfigurationModal
        isOpen
        line={unavailableLine}
        standardLines={[]}
        pricingState={foundPricingState}
        onLoadPricing={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(
        'Poprzednio wybrana konfiguracja nie jest już dostępna. Wybierz nową i zapisz pozycję ponownie.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('cart-line-configurator')).toHaveAttribute(
      'data-initial-selection',
      'null',
    );
  });

  it('shows a blocking load error when pricing cannot be fetched', async () => {
    render(
      <CartLineConfigurationModal
        isOpen
        line={createStandardLine()}
        standardLines={[]}
        pricingState={{
          status: 'not_found',
          message: 'Ta konfiguracja produktu nie jest już dostępna.',
        }}
        onLoadPricing={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(
        'Ta konfiguracja produktu nie jest już dostępna.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Zapisz konfigurację' }),
    ).not.toBeInTheDocument();
  });
});
