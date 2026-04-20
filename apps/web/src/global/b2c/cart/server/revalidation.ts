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
import { validateStandardConfigurationSelection } from '@/src/global/b2c/configuration/standard-configuration';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { fetchProductPricing } from '@/src/global/supabase/queries';
import type { CompletePricingData } from '@/src/global/supabase/types';
import {
  getCpoProductBuyability,
  getStandardProductBuyability,
} from '@/src/global/b2c/utils/buyability';

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

const queryStandardProductRevalidationBySlug = `
  *[_type == "product" && slug.current == $slug][0] {
    isSellableOnline
  }
`;

const queryCpoProductRevalidationBySlug = `
  *[_type == "cpoProduct" && slug.current == $slug][0] {
    isArchived,
    isSellableOnline,
    priceCents,
    availabilityStatus
  }
`;

async function loadStandardRevalidationContext(
  productSlug: string,
): Promise<StandardRevalidationContext> {
  const routeSlug = buildCartProductRouteSlug(productSlug, 'standard');
  const [pricingData, product] = await Promise.all([
    fetchProductPricing(productSlug),
    routeSlug
      ? sanityFetch<StandardProductRevalidationSnapshot | null>({
          query: queryStandardProductRevalidationBySlug,
          params: { slug: routeSlug },
          tags: ['product', `product:${productSlug}`],
        })
      : Promise.resolve(null),
  ]);

  return {
    pricingData,
    product,
  };
}

async function loadStandardRevalidationContexts(
  lines: StandardCartLine[],
): Promise<Map<string, StandardRevalidationContext>> {
  const uniqueProductSlugs = Array.from(
    new Set(
      lines
        .map((line) => extractCartProductSlug(line.productKey))
        .filter((productSlug): productSlug is string => !!productSlug),
    ),
  );

  return new Map(
    await Promise.all(
      uniqueProductSlugs.map(
        async (
          productSlug,
        ): Promise<readonly [string, StandardRevalidationContext]> => [
          productSlug,
          await loadStandardRevalidationContext(productSlug),
        ],
      ),
    ),
  );
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

async function loadCpoRevalidationContext(
  productSlug: string,
): Promise<CpoProductRevalidationSnapshot | null> {
  const routeSlug = buildCartProductRouteSlug(productSlug, 'cpo');

  if (!routeSlug) {
    return null;
  }

  return sanityFetch<CpoProductRevalidationSnapshot | null>({
    query: queryCpoProductRevalidationBySlug,
    params: { slug: routeSlug },
    tags: ['cpoProduct', `cpoProduct:${productSlug}`],
  });
}

async function loadCpoRevalidationContexts(
  lines: CpoCartLine[],
): Promise<Map<string, CpoProductRevalidationSnapshot | null>> {
  const uniqueProductSlugs = Array.from(
    new Set(
      lines
        .map((line) => extractCartProductSlug(line.productKey))
        .filter((productSlug): productSlug is string => !!productSlug),
    ),
  );

  return new Map(
    await Promise.all(
      uniqueProductSlugs.map(
        async (
          productSlug,
        ): Promise<
          readonly [string, CpoProductRevalidationSnapshot | null]
        > => [productSlug, await loadCpoRevalidationContext(productSlug)],
      ),
    ),
  );
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

  const contexts = await loadStandardRevalidationContexts(lines);

  return lines.map((line) =>
    buildStandardLineRevalidation(
      line,
      contexts.get(extractCartProductSlug(line.productKey) ?? ''),
    ),
  );
}

export async function revalidateCpoCartLines(
  lines: CpoCartLine[],
): Promise<CpoLineRevalidation[]> {
  if (lines.length === 0) {
    return [];
  }

  const contexts = await loadCpoRevalidationContexts(lines);

  return lines.map((line) =>
    buildCpoLineRevalidation(
      line,
      contexts.get(extractCartProductSlug(line.productKey) ?? ''),
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

  const [standardResults, cpoResults] = await Promise.all([
    revalidateStandardCartLines(standardLines),
    revalidateCpoCartLines(cpoLines),
  ]);

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

  const [standardContexts, cpoContexts] = await Promise.all([
    loadStandardRevalidationContexts(standardLines),
    loadCpoRevalidationContexts(cpoLines),
  ]);

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
