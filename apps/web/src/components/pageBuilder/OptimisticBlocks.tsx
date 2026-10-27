'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode, Suspense } from 'react';

import type { AuthoredBlockField } from '@/src/global/sanity/optimistic-order';

/**
 * Client split boundary in front of the draft-only reorder layer.
 *
 * `OptimisticReorder` imports `useOptimistic` from `next-sanity/hooks`, which
 * statically pulls the whole overlay bundle into any chunk that imports it.
 * `dynamic()` moves it behind a chunk only draft sessions request; PageBuilder
 * mounts this component in draft mode only.
 *
 * Deliberately WITHOUT `ssr: false`: this wraps `children`, and a
 * `BailoutToCSR` would strip every block out of the draft SSR HTML, so the
 * editor would open Presentation to an empty page.
 *
 * The wrapper adds no element: the reorder matches children on their raw
 * `child.key`, so the keyed blocks must arrive here directly (a provider or
 * wrapper around them makes every optimistic update bail).
 *
 * Every failure mode falls back to `children` untouched: the Suspense
 * fallback while the chunk loads (instead of blanking every block), and the
 * error boundary if the chunk fails to load.
 */
const OptimisticReorder = dynamic(() => import('./OptimisticReorder'));

class ReorderBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function OptimisticBlocks({
  documentId,
  fieldName,
  children,
}: {
  documentId: string;
  fieldName: AuthoredBlockField;
  children: ReactNode;
}) {
  return (
    <ReorderBoundary fallback={children}>
      <Suspense fallback={children}>
        <OptimisticReorder documentId={documentId} fieldName={fieldName}>
          {children}
        </OptimisticReorder>
      </Suspense>
    </ReorderBoundary>
  );
}
