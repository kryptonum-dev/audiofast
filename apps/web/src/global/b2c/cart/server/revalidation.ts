import {
  createCartLinePricingResult,
  type FetchCartLinePricingResult,
} from '@/src/global/b2c/cart/cart-pricing-result';
import {
  buildCartProductRouteSlug,
  extractCartProductSlug,
} from '@/src/global/b2c/cart/cart-product-key';
import { canReconfigureStandardLineWithAddedOptions } from '@/src/global/b2c/cart/standard-cart-line-option-recovery';
import type {
  CartLine,
  CartLineRevalidation,
  CpoCartLine,
  CpoLineRevalidation,
  StandardCartLine,
  StandardLineRevalidation,
} from '@/src/global/b2c/cart/types';
import { releaseExpiredCpoHoldsBySlugs } from '@/src/global/b2c/checkout/server/cpo-availability';
import { validateStandardConfigurationSelection } from '@/src/global/b2c/configuration/standard-configuration';
import {
  getCpoProductBuyability,
  getStandardProductBuyability,
} from '@/src/global/b2c/utils/buyability';
import { sanityFetchFresh } from '@/src/global/sanity/fetch';
import { fetchProductPricing } from '@/src/global/supabase/queries';
import type { CompletePricingData } from '@/src/global/supabase/types';

type StandardProductRevalidationSnapshot = {
  isSellableOnline?: boolean | null;
};

type StandardRevalidationContext = {
  pricingData: CompletePricingData | null;
  product: StandardProductRevalidationSnapshot | null;
};

type CpoProductRevalidationSnapshot = {
  isArchived?: boolean | null;
  isSellableOnline?: boolean | null;
  priceCents?: number | null;
  availabilityStatus?: string | null;
};

export type LoadCartPageRuntimeResult = {
  revalidationResults: CartLineRevalidation[];
  standardPricingByProductKey: Record<string, FetchCartLinePricingResult>;
};

// One fresh Content Lake read per cart revalidation, whatever the number of
// lines: every standard and CPO product in the cart is fetched in one batched
// query (`slug.current in $slugs`) instead of one request per product.
const queryCartProductsRevalidationBySlugs = `{
  "standard": *[_type == "product" && slug.current in $standardSlugs] {
    "slug": slug.current,
    isSellableOnline
  },
  "cpo": *[_type == "cpoProduct" && slug.current in $cpoSlugs] {
    "slug": slug.current,
    isArchived,
    isSellableOnline,
    priceCents,
    availabilityStatus
  }
}`;

type CartProductsRevalidationResult = {
  standard?: Array<
    StandardProductRevalidationSnapshot & { slug?: string | null }
  > | null;
  cpo?: Array<CpoProductRevalidationSnapshot & { slug?: string | null }> | null;
};

type CartRevalidationContexts = {
  standard: Map<string, StandardRevalidationContext>;
  cpo: Map<string, CpoProductRevalidationSnapshot | null>;
};

function uniqueCartProductSlugs(lines: CartLine[]): string[] {
  return Array.from(
    new Set(
      lines
        .map((line) => extractCartProductSlug(line.productKey))
        .filter((productSlug): productSlug is string => !!productSlug),
    ),
  );
}

function toRouteSlugs(
  productSlugs: string[],
  lineType: CartLine['lineType'],
): Map<string, string> {
  return new Map(
    productSlugs.flatMap((productSlug) => {
      const routeSlug = buildCartProductRouteSlug(productSlug, lineType);

      return routeSlug ? [[productSlug, routeSlug] as const] : [];
    }),
  );
}

function indexBySlug<T extends { slug?: string | null }>(
  rows: T[] | null | undefined,
): Map<string, T> {
  return new Map(
    (rows ?? []).flatMap((row) => (row.slug ? [[row.slug, row] as const] : [])),
  );
}

async function fetchCartProductSnapshots(
  standardRouteSlugs: string[],
  cpoRouteSlugs: string[],
): Promise<CartProductsRevalidationResult> {
  if (standardRouteSlugs.length === 0 && cpoRouteSlugs.length === 0) {
    return { standard: [], cpo: [] };
  }

  if (cpoRouteSlugs.length > 0) {
    // Expired holds go back to `available` before the snapshot is read, so the
    // cart sees the released state in the same revalidation.
    await releaseExpiredCpoHoldsBySlugs(cpoRouteSlugs).catch((error) => {
      console.error(
        'Failed to release expired CPO holds before revalidation.',
        {
          productSlugs: cpoRouteSlugs,
          error,
        },
      );
    });
  }

  return (
    (await sanityFetchFresh<CartProductsRevalidationResult | null>({
      requestTag: 'cart.revalidate.products',
      query: queryCartProductsRevalidationBySlugs,
      params: { standardSlugs: standardRouteSlugs, cpoSlugs: cpoRouteSlugs },
    })) ?? { standard: [], cpo: [] }
  );
}

async function loadRevalidationContexts(
  standardLines: StandardCartLine[],
  cpoLines: CpoCartLine[],
): Promise<CartRevalidationContexts> {
  const standardProductSlugs = uniqueCartProductSlugs(standardLines);
  const cpoProductSlugs = uniqueCartProductSlugs(cpoLines);
  const standardRouteSlugs = toRouteSlugs(standardProductSlugs, 'standard');
  const cpoRouteSlugs = toRouteSlugs(cpoProductSlugs, 'cpo');

  const [pricingEntries, snapshots] = await Promise.all([
    Promise.all(
      standardProductSlugs.map(
        async (productSlug) =>
          [productSlug, await fetchProductPricing(productSlug)] as const,
      ),
    ),
    fetchCartProductSnapshots(
      Array.from(standardRouteSlugs.values()),
      Array.from(cpoRouteSlugs.values()),
    ),
  ]);

  const standardBySlug = indexBySlug(snapshots.standard);
  const cpoBySlug = indexBySlug(snapshots.cpo);

  return {
    standard: new Map(
      pricingEntries.map(([productSlug, pricingData]) => {
        const routeSlug = standardRouteSlugs.get(productSlug);
        const product = routeSlug ? standardBySlug.get(routeSlug) : undefined;

        return [
          productSlug,
          {
            pricingData,
            product: product
              ? { isSellableOnline: product.isSellableOnline }
              : null,
          },
        ];
      }),
    ),
    cpo: new Map(
      cpoProductSlugs.map((productSlug) => {
        const routeSlug = cpoRouteSlugs.get(productSlug);
        const product = routeSlug ? cpoBySlug.get(routeSlug) : undefined;

        return [
          productSlug,
          product
            ? {
                isArchived: product.isArchived,
                isSellableOnline: product.isSellableOnline,
                priceCents: product.priceCents,
                availabilityStatus: product.availabilityStatus,
              }
            : null,
        ];
      }),
    ),
  };
}

function createUnavailableStandardLineRevalidation(
  line: StandardCartLine,
): StandardLineRevalidation {
  return {
    lineId: line.lineId,
    lineType: 'standard',
    isBuyable: false,
    isConfigurationValid: false,
    unitPriceCents: null,
  };
}

function createUnavailableCpoLineRevalidation(
  line: CpoCartLine,
): CpoLineRevalidation {
  return {
    lineId: line.lineId,
    lineType: 'cpo',
    isBuyable: false,
    availabilityStatus: null,
    unitPriceCents: null,
  };
}

function buildStandardLineRevalidation(
  line: StandardCartLine,
  context?: StandardRevalidationContext,
): StandardLineRevalidation {
  const productSlug = extractCartProductSlug(line.productKey);

  if (!productSlug || !context?.pricingData) {
    return createUnavailableStandardLineRevalidation(line);
  }

  const buyability = getStandardProductBuyability({
    isSellableOnline: context.product?.isSellableOnline,
    pricingData: context.pricingData,
  });
  const validation = line.configurationSelection
    ? validateStandardConfigurationSelection(
        context.pricingData,
        line.configurationSelection,
      )
    : {
        isValid: false,
        unitPriceCents: null,
      };
  const shouldRequireConfigurationReview =
    canReconfigureStandardLineWithAddedOptions(line, context.pricingData);

  return {
    lineId: line.lineId,
    lineType: 'standard',
    isBuyable: buyability.isBuyable,
    isConfigurationValid:
      validation.isValid && !shouldRequireConfigurationReview,
    unitPriceCents: shouldRequireConfigurationReview
      ? null
      : validation.unitPriceCents,
  };
}

function buildCpoLineRevalidation(
  line: CpoCartLine,
  product?: CpoProductRevalidationSnapshot | null,
): CpoLineRevalidation {
  const productSlug = extractCartProductSlug(line.productKey);

  if (!productSlug || !product) {
    return createUnavailableCpoLineRevalidation(line);
  }

  const buyability = getCpoProductBuyability({
    isArchived: product.isArchived,
    isSellableOnline: product.isSellableOnline,
    priceCents: product.priceCents,
    availabilityStatus: product.availabilityStatus,
  });

  return {
    lineId: line.lineId,
    lineType: 'cpo',
    isBuyable: buyability.isBuyable,
    availabilityStatus: product.availabilityStatus ?? null,
    unitPriceCents:
      typeof product.priceCents === 'number' ? product.priceCents : null,
  };
}

function buildStandardPricingByProductKey(
  lines: StandardCartLine[],
  contexts: Map<string, StandardRevalidationContext>,
): Record<string, FetchCartLinePricingResult> {
  return Object.fromEntries(
    Array.from(new Set(lines.map((line) => line.productKey))).map(
      (productKey) => {
        const productSlug = extractCartProductSlug(productKey);
        const pricingData = productSlug
          ? (contexts.get(productSlug)?.pricingData ?? null)
          : null;

        return [
          productKey,
          createCartLinePricingResult(productKey, pricingData),
        ];
      },
    ),
  );
}

export async function revalidateStandardCartLines(
  lines: StandardCartLine[],
): Promise<StandardLineRevalidation[]> {
  if (lines.length === 0) {
    return [];
  }

  const contexts = await loadRevalidationContexts(lines, []);

  return lines.map((line) =>
    buildStandardLineRevalidation(
      line,
      contexts.standard.get(extractCartProductSlug(line.productKey) ?? ''),
    ),
  );
}

export async function revalidateCpoCartLines(
  lines: CpoCartLine[],
): Promise<CpoLineRevalidation[]> {
  if (lines.length === 0) {
    return [];
  }

  const contexts = await loadRevalidationContexts([], lines);

  return lines.map((line) =>
    buildCpoLineRevalidation(
      line,
      contexts.cpo.get(extractCartProductSlug(line.productKey) ?? ''),
    ),
  );
}

export async function revalidateCartLines(
  lines: CartLine[],
): Promise<CartLineRevalidation[]> {
  if (lines.length === 0) {
    return [];
  }

  const standardLines = lines.filter(
    (line): line is StandardCartLine => line.lineType === 'standard',
  );
  const cpoLines = lines.filter(
    (line): line is CpoCartLine => line.lineType === 'cpo',
  );

  const contexts = await loadRevalidationContexts(standardLines, cpoLines);
  const standardResults = standardLines.map((line) =>
    buildStandardLineRevalidation(
      line,
      contexts.standard.get(extractCartProductSlug(line.productKey) ?? ''),
    ),
  );
  const cpoResults = cpoLines.map((line) =>
    buildCpoLineRevalidation(
      line,
      contexts.cpo.get(extractCartProductSlug(line.productKey) ?? ''),
    ),
  );

  const resultMap = new Map<string, CartLineRevalidation>(
    [...standardResults, ...cpoResults].map((result) => [
      result.lineId,
      result,
    ]),
  );

  return lines.map((line) => {
    const result = resultMap.get(line.lineId);

    if (!result) {
      throw new Error(
        `Missing cart revalidation result for line ${line.lineId}.`,
      );
    }

    return result;
  });
}

export async function loadCartPageRuntime(
  lines: CartLine[],
): Promise<LoadCartPageRuntimeResult> {
  if (lines.length === 0) {
    return {
      revalidationResults: [],
      standardPricingByProductKey: {},
    };
  }

  const standardLines = lines.filter(
    (line): line is StandardCartLine => line.lineType === 'standard',
  );
  const cpoLines = lines.filter(
    (line): line is CpoCartLine => line.lineType === 'cpo',
  );

  const { standard: standardContexts, cpo: cpoContexts } =
    await loadRevalidationContexts(standardLines, cpoLines);

  const revalidationResults = lines.map<CartLineRevalidation>((line) => {
    if (line.lineType === 'standard') {
      return buildStandardLineRevalidation(
        line,
        standardContexts.get(extractCartProductSlug(line.productKey) ?? ''),
      );
    }

    return buildCpoLineRevalidation(
      line,
      cpoContexts.get(extractCartProductSlug(line.productKey) ?? ''),
    );
  });

  return {
    revalidationResults,
    standardPricingByProductKey: buildStandardPricingByProductKey(
      standardLines,
      standardContexts,
    ),
  };
}
