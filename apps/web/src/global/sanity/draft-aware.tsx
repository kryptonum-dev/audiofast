import 'server-only';

import { draftMode } from 'next/headers';
import {
  createElement,
  type ReactElement,
  type ReactNode,
  Suspense,
} from 'react';

import {
  type DynamicFetchOptions,
  getDynamicFetchOptions,
  PUBLISHED,
} from './live';

/**
 * Props every cached (L3) component receives from the dispatcher. `perspective`
 * and `stega` are resolved outside the `'use cache'` scope and threaded in as
 * plain serializable props (strict `defineLive`). They are never accepted from
 * server-action input.
 */
export type CachedProps = DynamicFetchOptions & { isDraft?: boolean };

type CachedComponent<P> = (
  props: P & CachedProps,
) => ReactNode | Promise<ReactNode>;

/**
 * The orchestrator (L1) half of the three-layer page shape:
 *
 * - Published (and every prerender, where `draftMode()` resolves to `false`):
 *   renders the cached component directly with `PUBLISHED`, so the route
 *   stays fully static.
 * - Draft: renders a Suspense-wrapped dynamic layer (L2) that resolves the
 *   Presentation perspective from the cookie and renders the SAME cached
 *   component with draft options. Next bypasses `'use cache'` while draft mode
 *   is on, so the draft render always reads live.
 *
 * Never pass layout `children` through here: a cached scope around the route
 * slot is what hung Najbar's cold `next dev` loads (research/01 §5.9). A
 * listing slot built outside the scope (shape B) is fine — it is opaque to the
 * cache key.
 */
export async function renderDraftAware<P extends object>(
  Cached: CachedComponent<P>,
  props: P,
  fallback: ReactNode = null,
): Promise<ReactElement> {
  const { isEnabled: isDraft } = await draftMode();

  if (!isDraft) {
    return createElement(Cached as CachedComponent<object>, {
      ...props,
      ...PUBLISHED,
    });
  }

  return (
    <Suspense fallback={fallback}>
      <DraftLayer Cached={Cached as CachedComponent<object>} props={props} />
    </Suspense>
  );
}

async function DraftLayer({
  Cached,
  props,
}: {
  Cached: CachedComponent<object>;
  props: object;
}) {
  const options = await getDynamicFetchOptions();
  return createElement(Cached, { ...props, ...options, isDraft: true });
}
