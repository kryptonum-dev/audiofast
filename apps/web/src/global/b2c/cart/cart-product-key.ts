import type { CartLineType } from './types';

const CART_PRODUCT_ROUTE_PREFIXES: Record<CartLineType, string> = {
  standard: '/produkty',
  cpo: '/certyfikowany-sprzet-uzywany',
};

function normalizeCartProductKey(productKey: string): string | null {
  const normalizedKey = productKey.trim();

  if (!normalizedKey || !normalizedKey.includes('/')) {
    return null;
  }

  return normalizedKey;
}

function normalizeCartProductSlug(slug: string): string | null {
  const normalizedSlug = slug.trim().split('/').filter(Boolean).at(-1);

  if (!normalizedSlug) {
    return null;
  }

  return normalizedSlug.toLowerCase();
}

export function extractCartProductSlug(productKey: string): string | null {
  const normalizedKey = normalizeCartProductKey(productKey);

  if (!normalizedKey) {
    return null;
  }

  const segments = normalizedKey.split('/').filter(Boolean);
  return normalizeCartProductSlug(segments.at(-1) ?? '');
}

export function buildCartProductRouteSlug(
  productSlug: string,
  lineType: CartLineType,
): string | null {
  const normalizedSlug = normalizeCartProductSlug(productSlug);

  if (!normalizedSlug) {
    return null;
  }

  return `${CART_PRODUCT_ROUTE_PREFIXES[lineType]}/${normalizedSlug}/`;
}
