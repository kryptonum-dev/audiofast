import 'server-only';

import type { LivePerspective } from 'next-sanity/live';

import { sanityFetchCached } from '../sanity/live';
import { queryComparisonPageData } from '../sanity/query';
import type { ComparisonProduct, EnabledParameter } from './types';

/**
 * Combined response type for comparison page data
 */
export type ComparisonPageData = {
  products: ComparisonProduct[];
  /**
   * Enabled comparison parameters for the shared category.
   * - `undefined` -> no comparator config exists for the category; the table
   *   falls back to showing ALL technical parameters of the compared products.
   * - `[]` -> a config exists but enables zero parameters (show nothing).
   * Keep this distinction; do not coerce `undefined`/`null` into `[]`.
   */
  enabledParameters: EnabledParameter[] | undefined;
};

type ComparisonPageQueryResult = {
  products: ComparisonProduct[] | null;
  categoryConfigs: Array<{
    categorySlug: string | null;
    enabledParameters: EnabledParameter[] | null;
  }> | null;
};

/**
 * All comparison page data in one cached query: the shared categories'
 * products (narrowed through `denormCategorySlugs`) and their comparator
 * config. A plain server module, not a server action, so it can no longer be
 * invoked from the browser.
 *
 * `/porownaj` reads cookies anyway (shape D): it resolves the perspective
 * inline and passes it in. Always stega off — the table string-matches
 * parameter names against technical-data rows.
 *
 * @param categorySlugs - Shared category slugs of the comparison
 */
export async function getComparisonPageData({
  categorySlugs,
  perspective,
}: {
  categorySlugs: string[];
  perspective: LivePerspective;
}): Promise<ComparisonPageData> {
  try {
    const result = await sanityFetchCached<ComparisonPageQueryResult>({
      requestTag: 'comparison.page-data',
      query: queryComparisonPageData,
      params: { categorySlugs },
      perspective,
      stega: false,
      tags: ['product', 'comparatorConfig'],
    });

    // The comparison can share more than one category (a product may belong to
    // several). Pick the parameter set deterministically: the first shared
    // category — in the cookie's order, which follows the first product's
    // editorial order and is preserved through intersection narrowing — that
    // actually has a comparator config. This avoids depending on the order
    // categoryConfigs happen to have in the Studio document.
    const configs = result?.categoryConfigs ?? [];
    const matched = categorySlugs
      .map((slug) => configs.find((config) => config.categorySlug === slug))
      .find((config) => config != null);

    return {
      products: result?.products || [],
      // No config for any shared category -> `undefined` so the table falls back
      // to showing ALL technical parameters. A matched config with an empty list
      // means "configured, show none" and stays `[]`.
      enabledParameters: matched
        ? (matched.enabledParameters ?? [])
        : undefined,
    };
  } catch (error) {
    console.error('Error fetching comparison page data:', error);
    return {
      products: [],
      enabledParameters: undefined,
    };
  }
}
