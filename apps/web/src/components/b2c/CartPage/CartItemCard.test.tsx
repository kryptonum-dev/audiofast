import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { createCpoCartLine } from '@/src/global/b2c/cart/cpo-cart-line';
import { createStandardCartLine } from '@/src/global/b2c/cart/standard-cart-line';

import CartItemCard from './CartItemCard';

vi.mock('@/components/shared/Image', () => ({
  default: () => <div data-testid="mock-image" />,
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}));

function createStandardLine(quantity = 2) {
  return createStandardCartLine({
    lineId: 'standard-line-1',
    productId: 'product-1',
    productKey: '/produkty/test',
    productName: 'Test product',
    brandName: 'Test brand',
    quantity,
    unitPriceCents: 120_00,
    isReturnable: true,
    configurationSummary: [
      {
        label: 'Model',
        value: 'Default',
      },
      {
        label: 'Kolor',
        value: 'Black',
      },
    ],
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
}

function createCpoLine() {
  return createCpoCartLine({
    lineId: 'cpo-line-1',
    productId: 'cpo-1',
    productKey: 'CPO-KEY-1',
    productName: 'Test CPO',
    brandName: 'Test brand',
    unitPriceCents: 220_00,
    isReturnable: false,
    availabilityStatus: 'available',
    product: {
      id: 'cpo-1',
      name: 'Test CPO',
      brandName: 'Test brand',
      kind: 'cpo',
      image: { id: 'image-2' },
      basePrice: 220_00,
      configurationOptions: [],
      totalPrice: 220_00,
    },
  });
}

describe('CartItemCard', () => {
  it('renders a standard cart line with quantity controls and configuration summary', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onSetQuantity = vi.fn();
    const onIncrementQuantity = vi.fn();
    const onDecrementQuantity = vi.fn();
    const onReconfigure = vi.fn();

    render(
      <CartItemCard
        line={createStandardLine()}
        onRemove={onRemove}
        onSetQuantity={onSetQuantity}
        onIncrementQuantity={onIncrementQuantity}
        onDecrementQuantity={onDecrementQuantity}
        onReconfigure={onReconfigure}
      />,
    );

    expect(screen.getByText('Test product')).toBeInTheDocument();
    expect(screen.getByText('Test brand')).toBeInTheDocument();
    expect(screen.getByText('240 zł')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Kolor')).toBeInTheDocument();
    expect(screen.getByText('Black')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zwiększ ilość' }));
    expect(onIncrementQuantity).toHaveBeenCalledWith('standard-line-1');

    await user.click(screen.getByRole('button', { name: 'Zmniejsz ilość' }));
    expect(onDecrementQuantity).toHaveBeenCalledWith('standard-line-1');

    await user.click(
      screen.getByRole('button', { name: 'Edytuj konfigurację' }),
    );
    expect(onReconfigure).toHaveBeenCalledWith('standard-line-1');

    await user.click(screen.getByRole('button', { name: 'Usuń z koszyka' }));
    expect(
      screen.getByRole('heading', { name: 'Usunąć produkt z koszyka?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń produkt' }));
    expect(onRemove).toHaveBeenCalledWith('standard-line-1');
  });

  it('allows entering the quantity manually from the keyboard', async () => {
    const user = userEvent.setup();
    const onSetQuantity = vi.fn();

    render(
      <CartItemCard
        line={createStandardLine()}
        onRemove={vi.fn()}
        onSetQuantity={onSetQuantity}
        onIncrementQuantity={vi.fn()}
        onDecrementQuantity={vi.fn()}
        onReconfigure={vi.fn()}
      />,
    );

    const quantityInput = screen.getByRole('textbox', { name: 'Ilość' });

    await user.clear(quantityInput);
    await user.type(quantityInput, '90');
    await user.tab();

    expect(onSetQuantity).toHaveBeenCalledWith('standard-line-1', 90);
  });

  it('restores the previous quantity when manual quantity is set to zero', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onSetQuantity = vi.fn();

    render(
      <CartItemCard
        line={createStandardLine(1)}
        onRemove={onRemove}
        onSetQuantity={onSetQuantity}
        onIncrementQuantity={vi.fn()}
        onDecrementQuantity={vi.fn()}
        onReconfigure={vi.fn()}
      />,
    );

    const quantityInput = screen.getByRole('textbox', { name: 'Ilość' });

    await user.clear(quantityInput);
    await user.type(quantityInput, '0');
    await user.tab();

    expect(onSetQuantity).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(quantityInput).toHaveValue('1');
    expect(
      screen.queryByRole('heading', { name: 'Usunąć produkt z koszyka?' }),
    ).not.toBeInTheDocument();
  });

  it('caps manual quantity at 99 and shows a toast', async () => {
    const user = userEvent.setup();
    const onSetQuantity = vi.fn();

    render(
      <CartItemCard
        line={createStandardLine()}
        onRemove={vi.fn()}
        onSetQuantity={onSetQuantity}
        onIncrementQuantity={vi.fn()}
        onDecrementQuantity={vi.fn()}
        onReconfigure={vi.fn()}
      />,
    );

    const quantityInput = screen.getByRole('textbox', { name: 'Ilość' });

    await user.clear(quantityInput);
    await user.type(quantityInput, '120');
    await user.tab();

    expect(quantityInput).toHaveValue('99');
    expect(onSetQuantity).toHaveBeenCalledWith('standard-line-1', 99);
    expect(toast.info).toHaveBeenCalledWith(
      'Maksymalna ilość dla jednej pozycji to 99.',
    );
  });

  it('disables the increment button when quantity is already 99', async () => {
    const user = userEvent.setup();
    const onIncrementQuantity = vi.fn();

    render(
      <CartItemCard
        line={createStandardLine(99)}
        onRemove={vi.fn()}
        onSetQuantity={vi.fn()}
        onIncrementQuantity={onIncrementQuantity}
        onDecrementQuantity={vi.fn()}
        onReconfigure={vi.fn()}
      />,
    );

    const incrementButton = screen.getByRole('button', {
      name: 'Zwiększ ilość',
    });

    expect(incrementButton).toBeDisabled();

    await user.click(incrementButton);
    expect(onIncrementQuantity).not.toHaveBeenCalled();
  });

  it('renders a cpo line without quantity controls or reconfiguration action', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(<CartItemCard line={createCpoLine()} onRemove={onRemove} />);

    expect(screen.getByText('Test CPO')).toBeInTheDocument();
    expect(screen.getByText('Test brand')).toBeInTheDocument();
    expect(screen.getByText('220 zł')).toBeInTheDocument();
    expect(screen.getByText('Egzemplarz CPO')).toBeInTheDocument();
    expect(
      screen.queryByText('Stały egzemplarz z ilością ustawioną na 1 sztukę.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Zwiększ ilość' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Zmniejsz ilość' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edytuj konfigurację' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń z koszyka' }));
    await user.click(screen.getByRole('button', { name: 'Usuń produkt' }));
    expect(onRemove).toHaveBeenCalledWith('cpo-line-1');
  });

  it('renders blocking line issue messaging for invalid standard items', () => {
    const line = createStandardLine();

    line.issues = [
      {
        code: 'configuration_invalid',
        blocking: true,
        message: 'Wybrana konfiguracja nie jest już dostępna.',
      },
    ];

    render(
      <CartItemCard
        line={line}
        onRemove={vi.fn()}
        onIncrementQuantity={vi.fn()}
        onDecrementQuantity={vi.fn()}
        onReconfigure={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Wybrana konfiguracja nie jest już dostępna.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edytuj konfigurację' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Usuń z koszyka' }),
    ).toBeInTheDocument();
  });
});
