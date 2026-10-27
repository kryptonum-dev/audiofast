import { useEffect, useRef } from 'react';
import { getPublishedId, useClient, usePerspective } from 'sanity';
import {
  usePresentationNavigate,
  usePresentationParams,
} from 'sanity/presentation';

import { HREF_EXPRESSIONS, isRoutedType } from './routes';
import { PRESENTATION_API_VERSION } from './settings';
import {
  isSavedPreviewRoute,
  renamedPreviewUrl,
  type SavedRoute,
} from './slug-navigation';

type Props = {
  documentId: string;
  documentType: string;
  /** The public path the slug resolves to (`publicPathForSlug`). */
  pathname: string;
  /** The stored `slug.current`. */
  segment: string;
  valid: boolean;
};

/**
 * Mounted inside the slug field. When a slug rename is SAVED in the
 * perspective the iframe shows, keeps the Presentation preview on the renamed
 * page — without it the iframe stays on the old path and 404s.
 *
 * Navigates only once the slug is saved in that perspective (polling up to
 * 20 × 500 ms), keeps the previous path across keystrokes, and never moves the
 * host page when a REFERENCED document is edited (its path is not the one
 * shown). Renders nothing, and only mounts its hooks where Presentation
 * supplies its context.
 */
export function SlugPreviewNavigation(props: Props) {
  const presentation = usePresentationParams(false);
  return presentation && isRoutedType(props.documentType) ? (
    <ActiveSlugPreviewNavigation {...props} />
  ) : null;
}

function ActiveSlugPreviewNavigation({
  documentId,
  documentType,
  pathname,
  segment,
  valid,
}: Props) {
  const client = useClient({ apiVersion: PRESENTATION_API_VERSION });
  const { preview } = usePresentationParams();
  const navigate = usePresentationNavigate();
  const { perspectiveStack } = usePerspective();
  // Keep the original path through intermediate keystrokes, which have not
  // navigated yet.
  const previousPath = useRef(pathname);

  useEffect(() => {
    const target = renamedPreviewUrl(preview, previousPath.current, pathname);
    if (!valid || !target) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const checkSavedSlug = async () => {
      try {
        const saved = await isSavedPreviewRoute(
          (perspective) =>
            client
              .withConfig({ useCdn: false })
              .fetch<SavedRoute>(
                `*[_id == $id][0]{"segment": slug.current, "href": ${HREF_EXPRESSIONS[documentType]}}`,
                { id: getPublishedId(documentId) },
                { perspective, tag: 'presentation.slug-navigation' },
              ),
          perspectiveStack,
          segment,
          pathname,
        );
        if (cancelled) return;
        if (saved) {
          previousPath.current = pathname;
          navigate(target, {
            id: getPublishedId(documentId),
            type: documentType,
          });
          return;
        }
      } catch {
        // A brief save/network delay must not navigate to an unsaved URL.
      }
      if (!cancelled && ++attempts < 20) {
        timer = setTimeout(checkSavedSlug, 500);
      }
    };
    timer = setTimeout(checkSavedSlug, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    client,
    documentId,
    documentType,
    navigate,
    pathname,
    perspectiveStack,
    preview,
    segment,
    valid,
  ]);

  return null;
}
