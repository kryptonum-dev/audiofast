import { EarthGlobeIcon } from '@sanity/icons/EarthGlobe';
import { useToast } from '@sanity/ui/toast';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type DocumentActionComponent,
  getPublishedId,
  useClient,
} from 'sanity';
import { useRouter } from 'sanity/router';

import {
  type HrefResolution,
  isOpenInPresentationDisabled,
  resolveAndOpenInPresentation,
} from '../presentation/open-in-presentation';
import { resolveOwnHref } from '../presentation/preview-target';
import { isRoutedType } from '../presentation/routes';
import { PRESENTATION_API_VERSION } from '../presentation/settings';

/**
 * Tool name registered by `presentationTool()` in `sanity.config.ts` — the
 * `mode` that routes an `edit` intent to Presentation rather than to whichever
 * tool is current.
 */
const PRESENTATION_TOOL = 'presentation';

/**
 * „Otwórz w podglądzie" — jumps from the structure tool into the Presentation
 * tool with this document's page loaded in the iframe AND this document open
 * in the edit panel.
 *
 * It navigates through an `edit` intent — `{id, type, mode: 'presentation',
 * preview: href}` — never `navigateUrl('/presentation?preview=…')`: the raw
 * path drops the sticky `perspective` param and pushes about three history
 * entries through Presentation's main-document push. Never pass any param
 * Presentation does not know: it becomes a URL search param.
 *
 * The href is the document's OWN page, resolved from the shared GROQ route
 * table (`presentation/routes.ts`) on the `drafts` perspective — so a slug
 * typed seconds ago, never published, still opens. It is re-resolved on every
 * `_rev` and again at click time, never read from the menu's snapshot.
 *
 * Two states complete the contract: a non-routed type returns `null`, removing
 * the item instead of showing a permanently disabled one; and a routed
 * document with no href keeps the item enabled so its „Brak adresu strony"
 * toast is reachable. Only an unsettled or in-flight resolution is disabled.
 *
 * ⚠️ Append it LAST in `document.actions`: the first action is the primary
 * button, which stays Publish.
 */
export const OpenInPresentationAction: DocumentActionComponent = ({
  id,
  type,
  draft,
  published,
}) => {
  const client = useClient({ apiVersion: PRESENTATION_API_VERSION });
  const router = useRouter();
  const toast = useToast();
  const [resolution, setResolution] = useState<HrefResolution | null>(null);
  const [opening, setOpening] = useState(false);
  const openAttempt = useRef(0);

  const routed = isRoutedType(type);
  // Re-resolve on every mutation: the slug the editor just typed is the one
  // the preview should open.
  const revision = draft?._rev ?? published?._rev ?? null;
  const publishedId = getPublishedId(id);
  const resolutionKey = `${publishedId}:${type}:${revision ?? 'unrevisioned'}`;
  const currentResolutionKey = useRef(resolutionKey);
  currentResolutionKey.current = resolutionKey;

  const resolveHref = useCallback(
    () => resolveOwnHref(client, publishedId, type),
    [client, publishedId, type],
  );

  useEffect(() => {
    if (!routed) return;

    let cancelled = false;

    resolveHref()
      .then((value) => {
        if (!cancelled) {
          setResolution({ href: value ?? null, key: resolutionKey });
        }
      })
      .catch(() => {
        if (!cancelled) setResolution({ href: null, key: resolutionKey });
      });

    return () => {
      cancelled = true;
    };
  }, [resolutionKey, resolveHref, routed]);

  const onHandle = useCallback(async () => {
    const attempt = ++openAttempt.current;
    setOpening(true);

    try {
      await resolveAndOpenInPresentation({
        resolveHref,
        isCurrent: () =>
          attempt === openAttempt.current &&
          currentResolutionKey.current === resolutionKey,
        navigate: (href) =>
          router.navigateIntent('edit', {
            id: publishedId,
            type,
            mode: PRESENTATION_TOOL,
            preview: href,
          }),
        onMissing: () =>
          toast.push({
            status: 'warning',
            title: 'Brak adresu strony',
            description: 'Uzupełnij adres URL dokumentu, aby otworzyć podgląd.',
          }),
        onError: () =>
          toast.push({
            status: 'error',
            title: 'Nie udało się odczytać adresu strony',
            description: 'Spróbuj ponownie za chwilę.',
          }),
      });
    } finally {
      if (attempt === openAttempt.current) setOpening(false);
    }
  }, [publishedId, resolutionKey, resolveHref, router, toast, type]);

  if (!routed) return null;

  return {
    label: 'Otwórz w podglądzie',
    icon: EarthGlobeIcon,
    disabled: isOpenInPresentationDisabled(resolution, resolutionKey, opening),
    onHandle,
  };
};
