import type { SanityClient } from '@sanity/client';

import {
  chunk,
  type DenormPatch,
  PATCH_BATCH_SIZE,
  planDenormPatches,
  type ProductDenormSource,
} from './denorm.js';

const MAX_ATTEMPTS = 4;

/**
 * Wait before re-reading after a 409. The query API is eventually consistent:
 * an immediate re-read after another writer's `visibility: 'async'` commit
 * still returns the OLD `_rev` (observed 2026-10-27: three back-to-back
 * attempts inside one second all lost to the same stale read). Total budget
 * stays far below the Function's 60 s timeout.
 */
const RETRY_DELAYS_MS = [1000, 3000, 6000];

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface ApplyResult {
  /** Products whose stored fields drifted on the FIRST read. */
  planned: DenormPatch[];
  /** Products actually patched, summed over every attempt. */
  patched: number;
}

function isRevisionConflict(error: unknown): boolean {
  return (error as { statusCode?: number } | null)?.statusCode === 409;
}

/**
 * Read → diff → patch, in transactions of {@link PATCH_BATCH_SIZE}, each patch
 * guarded by `ifRevisionId`. A 409 means an editor (or another delivery of the
 * same event) touched one of the products between the read and the write:
 * after a back-off the whole round is re-read and re-planned, and products
 * that already landed now diff to zero, so a retry never double-writes. Four
 * rounds, then throw, so the failure shows up in
 * `sanity functions logs denormalize-products`.
 *
 * `dryRun` stops after the first plan — used by `context.local` and the
 * backfill's default mode.
 */
export async function applyDenormalization(args: {
  client: SanityClient;
  read: () => Promise<ProductDenormSource[]>;
  dryRun: boolean;
  now?: () => string;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ApplyResult> {
  const now = args.now ?? (() => new Date().toISOString());
  const sleep = args.sleep ?? defaultSleep;
  let planned: DenormPatch[] | null = null;
  let patched = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const patches = planDenormPatches(await args.read(), now());
    planned ??= patches;
    if (patches.length === 0 || args.dryRun) {
      return { planned, patched };
    }

    try {
      for (const batch of chunk(patches, PATCH_BATCH_SIZE)) {
        const transaction = args.client.transaction();
        for (const patch of batch) {
          transaction.patch(patch._id, (p) =>
            p.ifRevisionId(patch._rev).set(patch.set),
          );
        }
        await transaction.commit({ visibility: 'async' });
        patched += batch.length;
      }
      return { planned, patched };
    } catch (error) {
      if (!isRevisionConflict(error) || attempt === MAX_ATTEMPTS) throw error;
      console.warn(
        `[denormalize-products] revision conflict, re-reading (attempt ${attempt}/${MAX_ATTEMPTS})`,
      );
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 6000);
    }
  }

  // Unreachable: the loop either returns or throws on its last attempt.
  return { planned: planned ?? [], patched };
}
