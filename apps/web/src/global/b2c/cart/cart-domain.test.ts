import { describe, expect, it } from 'vitest';

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
import { createCpoCartLine } from './cpo-cart-line';
import { createStandardCartLine } from './standard-cart-line';

describe('cart-domain', () => {
  it('creates an empty cart', () => {
    expect(createEmptyCart()).toEqual({
      version: 1,
      lines: [],
      coupon: null,
    });
  });

  it('adds a line to the cart', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const nextState = addCartLine(createEmptyCart(), line);

    expect(nextState.lines).toHaveLength(1);
    expect(nextState.lines[0]?.lineId).toBe('line-1');
  });

  it('merges identical standard lines into one line with increased quantity', () => {
    const initialLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'A' }],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const incomingLine = createStandardCartLine({
      lineId: 'line-2',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 2,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'A' }],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const nextState = addCartLine(
      addCartLine(createEmptyCart(), initialLine),
      incomingLine,
    );

    expect(nextState.lines).toHaveLength(1);
    expect(nextState.lines[0]?.quantity).toBe(3);
  });

  it('keeps differently configured standard lines separate', () => {
    const initialLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'A' }],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const incomingLine = createStandardCartLine({
      lineId: 'line-2',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 120_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'B' }],
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

    const nextState = addCartLine(
      addCartLine(createEmptyCart(), initialLine),
      incomingLine,
    );

    expect(nextState.lines).toHaveLength(2);
  });

  it('prevents duplicate cpo specimen lines by refreshing the existing one', () => {
    const initialLine = createCpoCartLine({
      lineId: 'line-1',
      productId: 'cpo-1',
      productKey: 'CPO-1',
      productName: 'Test CPO',
      brandName: 'Test brand',
      unitPriceCents: 200_00,
      isReturnable: false,
      availabilityStatus: 'available',
      product: {
        id: 'cpo-1',
        name: 'Test CPO',
        brandName: 'Test brand',
        kind: 'cpo',
        image: { id: 'image-1' },
        basePrice: 200_00,
        configurationOptions: [],
        totalPrice: 200_00,
      },
    });

    const incomingLine = createCpoCartLine({
      lineId: 'line-2',
      productId: 'cpo-1',
      productKey: 'CPO-1',
      productName: 'Test CPO refreshed',
      brandName: 'Test brand',
      unitPriceCents: 220_00,
      isReturnable: false,
      availabilityStatus: 'available',
      product: {
        id: 'cpo-1',
        name: 'Test CPO refreshed',
        brandName: 'Test brand',
        kind: 'cpo',
        image: { id: 'image-1' },
        basePrice: 220_00,
        configurationOptions: [],
        totalPrice: 220_00,
      },
    });

    const nextState = addCartLine(
      addCartLine(createEmptyCart(), initialLine),
      incomingLine,
    );

    expect(nextState.lines).toHaveLength(1);
    expect(nextState.lines[0]?.productName).toBe('Test CPO refreshed');
  });

  it('removes a line from the cart', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const state = addCartLine(createEmptyCart(), line);
    const nextState = removeCartLine(state, 'line-1');

    expect(nextState.lines).toHaveLength(0);
  });

  it('clears the cart back to the empty state', () => {
    expect(clearCart()).toEqual(createEmptyCart());
  });

  it('updates standard quantity and removes the line when quantity reaches zero', () => {
    const line = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const state = addCartLine(createEmptyCart(), line);
    const incremented = incrementStandardLineQuantity(state, 'line-1');
    const decremented = decrementStandardLineQuantity(incremented, 'line-1');
    const removed = setStandardLineQuantity(decremented, 'line-1', 0);

    expect(incremented.lines[0]?.quantity).toBe(2);
    expect(decremented.lines[0]?.quantity).toBe(1);
    expect(removed.lines).toHaveLength(0);
  });

  it('replaces a standard cart line and merges when the new configuration already exists', () => {
    const firstLine = createStandardCartLine({
      lineId: 'line-1',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 100_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'A' }],
      product: {
        id: 'product-1',
        name: 'Test product',
        brandName: 'Test brand',
        kind: 'standard',
        image: { id: 'image-1' },
        basePrice: 100_00,
        configurationOptions: [],
        totalPrice: 100_00,
      },
    });

    const secondLine = createStandardCartLine({
      lineId: 'line-2',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 2,
      unitPriceCents: 120_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'B' }],
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

    const replacement = createStandardCartLine({
      lineId: 'line-3',
      productId: 'product-1',
      productKey: '/produkty/test',
      productName: 'Test product',
      brandName: 'Test brand',
      quantity: 1,
      unitPriceCents: 120_00,
      isReturnable: true,
      configurationSummary: [{ label: 'Model', value: 'B' }],
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

    const state = addCartLine(
      addCartLine(createEmptyCart(), firstLine),
      secondLine,
    );
    const nextState = replaceStandardCartLine(state, 'line-1', replacement);
    const mergedLine = nextState.lines[0];

    expect(nextState.lines).toHaveLength(1);
    expect(mergedLine?.quantity).toBe(3);
    expect(
      mergedLine?.lineType === 'standard' ? mergedLine.configurationSummary : null,
    ).toEqual([
      {
        label: 'Model',
        value: 'B',
      },
    ]);
  });
});
