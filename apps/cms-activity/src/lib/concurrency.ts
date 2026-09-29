/** Split `items` into chunks of at most `size` elements. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const safeSize = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    chunks.push(items.slice(i, i + safeSize));
  }
  return chunks;
}

/**
 * Map `items` through an async `worker` with at most `concurrency` calls in
 * flight. Results keep input order. The first rejection rejects the whole
 * call (remaining workers stop picking up new items).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;

  async function run(): Promise<void> {
    while (!failed && next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await worker(items[index] as T, index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }

  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

/** Throw the standard `AbortError` when `signal` is already aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('Przerwano pobieranie raportu.', 'AbortError');
  }
}
