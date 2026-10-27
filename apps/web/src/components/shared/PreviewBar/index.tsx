'use client';

import dynamic from 'next/dynamic';

/**
 * A client component whose ONLY job is to be a split boundary.
 *
 * The implementation imports `useIsPresentationTool` from `next-sanity/hooks`,
 * which statically pulls the visual-editing overlay code into whatever chunk
 * group reaches it. The root layout gates the bar on `isDraft` at RUNTIME, and
 * a runtime gate removes zero bytes from a build-time graph: without this shim
 * every published page view would carry the visual-editing bundle for a bar
 * only draft-cookie holders ever see.
 *
 * `ssr: false` is correct HERE, and only here: the bar renders nothing on the
 * server anyway (it waits for the Presentation probe), so there is no SSR
 * output to lose. A shim that wraps `children` must never use it.
 */
const PreviewBarImpl = dynamic(() => import('./PreviewBarImpl'), {
  ssr: false,
});

export default function PreviewBar() {
  return <PreviewBarImpl />;
}
