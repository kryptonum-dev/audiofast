import { createClient } from '@sanity/client';
import { documentEventHandler } from '@sanity/functions';

import { applyDenormalization } from './apply.js';
import {
  AFFECTED_PRODUCTS_QUERY,
  API_VERSION,
  type ProductDenormSource,
} from './denorm.js';

/**
 * Keeps product `denorm*` fields (brand slug/name, category slugs) in sync with
 * the brand, sub-category and product documents they are copied from.
 *
 * Replaced the denorm block of the retired Next.js revalidation webhook, which ran
 * fire-and-forget on Vercel (not awaited, so it could be frozen mid-run), fired
 * on every brand save regardless of what changed, and resolved category refs
 * one product at a time in index order.
 *
 * Two loop guards:
 * 1. The blueprint filter fires only when an INPUT changed (brand ref,
 *    category refs, brand name/slug, sub-category slug). This Function writes
 *    only `denorm*` fields, which no filter branch compares, so its own patches
 *    never re-trigger it — and neither do the ~869 price-sync patches per Excel
 *    run.
 * 2. The handler diffs before writing (`denorm.ts`), so a redelivery or a
 *    retry writes nothing. Retry-on-throw semantics are undocumented;
 *    idempotency is the safety mechanism.
 *
 * Needs no env: `context.clientOptions` carries the robot token the blueprint
 * deploy mints for this Function. Never create one by hand.
 */

interface DenormEventData {
  _id: string;
  _type: string;
}

export const handler = documentEventHandler<DenormEventData>(
  async ({ context, event }) => {
    const { _id: id, _type: type } = event.data ?? {};
    if (!id) {
      throw new Error(
        `Denorm event carried no _id: ${JSON.stringify(event.data ?? null).slice(0, 200)}`,
      );
    }

    const client = createClient({
      ...context.clientOptions,
      apiVersion: API_VERSION,
      useCdn: false,
      perspective: 'published',
    });

    const { planned, patched } = await applyDenormalization({
      client,
      read: () =>
        client.fetch<ProductDenormSource[]>(AFFECTED_PRODUCTS_QUERY, { id }),
      // `sanity functions test` runs against the real dataset: plan, never write.
      dryRun: context.local === true,
    });

    if (planned.length === 0) {
      console.log(`[denormalize-products] ${type} ${id}: no drift`);
      return;
    }

    const summary = planned
      .slice(0, 20)
      .map((patch) => `${patch._id} → ${JSON.stringify(patch.set)}`)
      .join('\n');

    if (context.local) {
      console.log(
        `[denormalize-products] LOCAL dry run, ${type} ${id}: ${planned.length} product(s) would be patched\n${summary}`,
      );
      return;
    }

    console.log(
      `[denormalize-products] ${type} ${id}: patched ${patched} product(s)\n${summary}`,
    );
  },
);
