'use client';

import { useCart } from '@/src/global/b2c/cart/use-cart';
import { formatPrice } from '@/src/global/utils';

export default function CartPage() {
  const { cart, totals, isHydrated } = useCart();

  return (
    <main
      id="main"
      className="max-width"
      style={{ padding: '6rem 1rem 4rem', minHeight: '100dvh' }}
    >
      <h1>Koszyk</h1>
      <p>
        Pierwszy widok koszyka jest juz gotowy i podlaczony do runtime cart.
      </p>
      {isHydrated ? (
        <>
          <p>Liczba pozycji: {cart.lines.length}</p>
          <p>Liczba produktow: {totals.itemCount}</p>
          <p>Wartosc koszyka: {formatPrice(totals.grandTotalCents)}</p>
        </>
      ) : (
        <p>Trwa ladowanie koszyka...</p>
      )}
    </main>
  );
}
