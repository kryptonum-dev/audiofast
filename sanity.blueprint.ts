import {
  defineBlueprint,
  defineDocumentFunction,
  defineSyncTagInvalidateFunction,
} from '@sanity/blueprints';

/**
 * Infrastructure-as-code manifest for the Sanity Functions layer (project
 * `fsw3likv`). It lives at the REPO ROOT, next to `bun.lock`: the CLI resolves
 * every resource's `src` and the lockfile relative to this file.
 *
 * Deploys are manual: `bun run blueprints:deploy` from the repo root. Nothing
 * here runs in CI, so an edit that was never deployed looks exactly like one
 * that was, except in `bunx sanity functions logs <name>`.
 *
 * Each function directory under `apps/functions/<name>/` carries its OWN
 * `package.json`; bundles resolve dependencies from there, never from the
 * workspace.
 *
 * Rollback: delete a resource here and run `blueprints:deploy` again.
 */

/**
 * Pinned to the production dataset. The retired `/api/revalidate` webhook
 * listened to `*`, so it also fired for any other dataset.
 */
const DATASET = {
  type: 'dataset',
  id: 'fsw3likv.production',
} as const;

/**
 * Fires only when a denorm INPUT changes — this is loop guard #1 (guard #2 is
 * the handler's diff). The Function writes only `denorm*` fields, which no
 * branch compares, so its own patches never re-trigger it, and neither do the
 * price-sync, CPO or availability patches.
 *
 * Primitives only: delta comparisons do not deep-compare objects or arrays, so
 * category refs are compared as one joined string (order included — the
 * primary category is `categories[0]`).
 *
 * `!defined(after().denormCategorySlugs)` catches a product's first publish
 * or an API-created product; the handler writes `[]` at least once, so the
 * branch stops matching after that.
 */
const DENORM_FILTER = [
  '(_type == "product" && (',
  'before().brand._ref != after().brand._ref',
  '|| array::join(coalesce(before().categories[]._ref, []), ",") != array::join(coalesce(after().categories[]._ref, []), ",")',
  '|| !defined(after().denormCategorySlugs)',
  '))',
  '|| (_type == "brand" && (before().name != after().name || before().slug.current != after().slug.current))',
  '|| (_type == "productCategorySub" && before().slug.current != after().slug.current)',
].join(' ');

export default defineBlueprint({
  resources: [
    /**
     * Relays the sync tags a publish invalidated to
     * `https://audiofast.pl/api/revalidate-tags/`, which expires the matching
     * `sanity:` cache tags with stale-while-revalidate and warms `/` and
     * `/produkty/`. One sync-tag Function per dataset: more than one races.
     */
    defineSyncTagInvalidateFunction({
      name: 'invalidate-sync-tags',
      src: './apps/functions/invalidate-sync-tags',
      event: { resource: DATASET },
    }),

    /**
     * Maintains product `denormBrandSlug`, `denormBrandName` and
     * `denormCategorySlugs` on brand, sub-category and product changes.
     *
     * `create` + `update` (published documents only; drafts are excluded by
     * default) so Studio publishes AND API writes count. Brand or sub-category
     * deletes are not handled, matching the retired webhook.
     *
     * 60 s budget: the worst fan-out today is one brand with ~186 products,
     * i.e. one read plus four transactions of 50.
     */
    defineDocumentFunction({
      name: 'denormalize-products',
      src: './apps/functions/denormalize-products',
      timeout: 60,
      event: {
        on: ['create', 'update'],
        filter: DENORM_FILTER,
        // The handler re-reads everything it needs; keep the payload tiny.
        projection: '{_id, _type}',
        resource: DATASET,
      },
    }),
  ],
});
