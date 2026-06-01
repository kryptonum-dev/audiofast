import 'server-only';

import { extractCartProductSlug } from '@/src/global/b2c/cart/cart-product-key';
import {
  getCpoProductBuyability,
  getStandardProductBuyability,
} from '@/src/global/b2c/utils/buyability';
import { sanityFetchDynamic } from '@/src/global/sanity/fetch';
import { createClient } from '@/src/global/supabase/server';

type ProductImageDto = {
  id?: string | null;
  preview?: string | null;
  alt?: string | null;
  naturalWidth?: number | null;
  naturalHeight?: number | null;
} | null;

type StandardProductSnapshot = {
  _id: string;
  name?: string | null;
  slug?: string | null;
  isSellableOnline?: boolean | null;
  image: ProductImageDto;
  brand?: {
    name?: string | null;
  } | null;
};

type CpoProductSnapshot = {
  _id: string;
  name?: string | null;
  slug?: string | null;
  brandName?: string | null;
  priceCents?: number | null;
  isArchived?: boolean | null;
  isSellableOnline?: boolean | null;
  availabilityStatus?: string | null;
  image: ProductImageDto;
};

type PricingVariantSnapshot = {
  base_price_cents: number;
  price_key: string;
};

export type AdminCouponProductOptionDto = {
  id: string;
  lineType: 'standard' | 'cpo';
  productName: string;
  brandName: string | null;
  productKey: string;
  productKeys: string[];
  priceCents: number | null;
  image: ProductImageDto;
};

const PRODUCT_IMAGE_PROJECTION = `{
  "id": asset._ref,
  "preview": asset->metadata.lqip,
  "alt": asset->altText,
  "naturalWidth": asset->metadata.dimensions.width,
  "naturalHeight": asset->metadata.dimensions.height
}`;

const queryCouponStandardProducts = `
  *[
    _type == "product" &&
    !(_id in path("drafts.**")) &&
    defined(slug.current) &&
    isArchived != true &&
    brand->doNotShowBrand != true
  ] | order(coalesce(brand->name, "") asc, name asc) {
    _id,
    name,
    "slug": slug.current,
    isSellableOnline,
    "image": previewImage ${PRODUCT_IMAGE_PROJECTION},
    brand->{name}
  }
`;

const queryCouponCpoProducts = `
  *[
    _type == "cpoProduct" &&
    !(_id in path("drafts.**")) &&
    productType == "internal" &&
    defined(slug.current) &&
    isArchived != true
  ] | order(coalesce(brandName, "") asc, name asc) {
    _id,
    name,
    brandName,
    "slug": slug.current,
    priceCents,
    isArchived,
    isSellableOnline,
    availabilityStatus,
    "image": select(
      defined(previewImage.asset) => {
        "image": previewImage ${PRODUCT_IMAGE_PROJECTION}
      }.image,
      defined(internalProduct->previewImage.asset) => {
        "image": internalProduct->previewImage ${PRODUCT_IMAGE_PROJECTION}
      }.image,
      null
    )
  }
`;

async function loadPricingVariantsByProductSlug(): Promise<
  Map<string, PricingVariantSnapshot[]>
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pricing_variants')
    .select('base_price_cents, price_key')
    .gt('base_price_cents', 0)
    .order('price_key', { ascending: true });

  if (error) {
    throw error;
  }

  const grouped = new Map<string, PricingVariantSnapshot[]>();

  for (const variant of data ?? []) {
    const productSlug = extractCartProductSlug(variant.price_key);

    if (!productSlug) {
      continue;
    }

    const current = grouped.get(productSlug) ?? [];
    current.push(variant);
    grouped.set(productSlug, current);
  }

  return grouped;
}

function getLowestPrice(variants: PricingVariantSnapshot[]): number | null {
  const prices = variants
    .map((variant) => variant.base_price_cents)
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length > 0 ? Math.min(...prices) : null;
}

function mapStandardProductOption(
  product: StandardProductSnapshot,
  pricingVariants: PricingVariantSnapshot[],
): AdminCouponProductOptionDto | null {
  const productSlug = product.slug
    ? extractCartProductSlug(product.slug)
    : null;
  const productKeys = Array.from(
    new Set(pricingVariants.map((variant) => variant.price_key).filter(Boolean)),
  );
  const lowestPrice = getLowestPrice(pricingVariants);
  const buyability = getStandardProductBuyability({
    isSellableOnline: product.isSellableOnline,
    pricingData:
      lowestPrice && productKeys.length > 0
        ? {
            lowestPrice,
            variants: productKeys,
          }
        : null,
  });

  if (!productSlug || !buyability.isBuyable || productKeys.length === 0) {
    return null;
  }

  return {
    id: product._id,
    lineType: 'standard',
    productName: product.name?.trim() || productSlug,
    brandName: product.brand?.name?.trim() || null,
    productKey: productKeys[0] ?? product.slug ?? product._id,
    productKeys,
    priceCents: lowestPrice,
    image: product.image,
  };
}

function mapCpoProductOption(
  product: CpoProductSnapshot,
): AdminCouponProductOptionDto | null {
  const productKey = product.slug?.trim();
  const buyability = getCpoProductBuyability({
    isArchived: product.isArchived,
    isSellableOnline: product.isSellableOnline,
    priceCents: product.priceCents,
    availabilityStatus: product.availabilityStatus,
  });

  if (!productKey || !buyability.isBuyable) {
    return null;
  }

  return {
    id: product._id,
    lineType: 'cpo',
    productName: product.name?.trim() || productKey,
    brandName: product.brandName?.trim() || null,
    productKey,
    productKeys: [productKey],
    priceCents: product.priceCents ?? null,
    image: product.image,
  };
}

export async function loadAdminCouponProducts(): Promise<
  AdminCouponProductOptionDto[]
> {
  const [standardProducts, cpoProducts, pricingVariantsBySlug] =
    await Promise.all([
      sanityFetchDynamic<StandardProductSnapshot[]>({
        query: queryCouponStandardProducts,
      }),
      sanityFetchDynamic<CpoProductSnapshot[]>({
        query: queryCouponCpoProducts,
      }),
      loadPricingVariantsByProductSlug(),
    ]);

  const standardOptions = standardProducts
    .map((product) => {
      const productSlug = product.slug
        ? extractCartProductSlug(product.slug)
        : null;

      return mapStandardProductOption(
        product,
        productSlug ? (pricingVariantsBySlug.get(productSlug) ?? []) : [],
      );
    })
    .filter((option): option is AdminCouponProductOptionDto => !!option);
  const cpoOptions = cpoProducts
    .map(mapCpoProductOption)
    .filter((option): option is AdminCouponProductOptionDto => !!option);

  return [...standardOptions, ...cpoOptions].sort((left, right) => {
    const leftLabel = `${left.brandName ?? ''} ${left.productName}`;
    const rightLabel = `${right.brandName ?? ''} ${right.productName}`;

    return leftLabel.localeCompare(rightLabel, 'pl');
  });
}
