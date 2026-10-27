/**
 * One-time (and re-runnable) denorm backfill over the whole catalogue, using
 * the SAME pure diff as the `denormalize-products` Function, so it patches
 * exactly the products whose stored fields drift from the computed ones —
 * nothing else gets a new `_rev`.
 *
 * First use (2026-10-27): realign the 13 products whose `denormCategorySlugs`
 * held the right set in index order instead of the editor's `categories[]`
 * order (which changed their primary category on listings).
 *
 *   SANITY_API_TOKEN=<write-capable token> bun run backfill:denorm            # dry run
 *   SANITY_API_TOKEN=<write-capable token> bun run backfill:denorm --execute  # write
 *
 * Supersedes `apps/studio/scripts/migrate-denormalized-fields.ts` for drift
 * repair: that script rewrites every product unconditionally.
 */
import { createClient } from '@sanity/client';

import { applyDenormalization } from '../denormalize-products/apply.js';
import {
  ALL_PRODUCTS_QUERY,
  API_VERSION,
  type ProductDenormSource,
} from '../denormalize-products/denorm.js';

const execute = process.argv.includes('--execute');
// eslint-disable-next-line turbo/no-undeclared-env-vars -- one-off script, never run through turbo
const token = process.env.SANITY_API_TOKEN;
if (!token) {
  console.error('SANITY_API_TOKEN is required.');
  process.exit(2);
}

const client = createClient({
  projectId: 'fsw3likv',
  dataset: 'production',
  apiVersion: API_VERSION,
  token,
  useCdn: false,
  perspective: 'published',
});

const products = new Map<string, ProductDenormSource>();
const result = await applyDenormalization({
  client,
  read: async () => {
    const rows = await client.fetch<ProductDenormSource[]>(ALL_PRODUCTS_QUERY);
    for (const row of rows) products.set(row._id, row);
    return rows;
  },
  dryRun: !execute,
});

console.log(
  `${execute ? 'EXECUTE' : 'DRY RUN'}: ${products.size} products read, ${result.planned.length} drifted, ${result.patched} patched`,
);
for (const patch of result.planned) {
  const source = products.get(patch._id);
  console.log(
    `- ${patch._id} ${source?.slug ?? ''}: ${JSON.stringify(source?.denormCategorySlugs ?? null)} → ${JSON.stringify(patch.set.denormCategorySlugs)}${
      (source?.denormBrandName ?? null) !== patch.set.denormBrandName ||
      (source?.denormBrandSlug ?? null) !== patch.set.denormBrandSlug
        ? ` | brand ${source?.denormBrandSlug}/${source?.denormBrandName} → ${patch.set.denormBrandSlug}/${patch.set.denormBrandName}`
        : ''
    }`,
  );
}
