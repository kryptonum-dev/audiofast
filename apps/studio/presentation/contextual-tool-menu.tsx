/**
 * The navbar tool menu, with document-carrying „Treść" / „Podgląd" tabs.
 *
 * Sanity's tool links clear the target tool's state on purpose (`ToolLink`:
 * `{tool, [name]: undefined}`), so a tab click always opens the tool's root
 * and the editor loses the document they were on. This wrapper keeps Sanity's
 * own menu — `props.renderDefault(props)`, the topbar menu with its overflow
 * menu and the sidebar menu alike — and changes one thing: a plain left click
 * on the OTHER tool's tab, while the current tool has a document open, becomes
 * an `edit` intent for that document.
 *
 *   Treść → Podgląd: `navigateIntent('edit', {id, type, mode: 'presentation',
 *     preview})`, the page from `resolvePreviewTarget` (own page → parent
 *     rows → first referrer → home page).
 *   Podgląd → Treść: `navigateIntent('edit', {id, type, mode: 'structure'})`.
 *
 * Every other click passes through untouched: a modified or non-primary click
 * (cmd/middle-click keep opening the tool root in a new tab), the active tab,
 * any other tool, and both tabs while no document is open.
 *
 * ⚠️ `@beta` API RISK. `studio.components.toolMenu` and `ToolMenuProps` are
 * `@beta @hidden` Sanity API, and the interception leans on an internal
 * detail: `useLink` returns early when the event is already
 * `isDefaultPrevented()`, and checks that BEFORE it calls an `onClick` prop —
 * so only a capture-phase ancestor handler that calls `preventDefault`
 * synchronously, before any `await`, can cancel the navigation to the tool
 * root. Re-check both tabs (topbar, sidebar, and the overflow menu at a narrow
 * width) after every `sanity` bump. Rollback = delete the `toolMenu` line in
 * `sanity.config.ts`.
 */
import {
  type MouseEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { type ToolMenuProps, useClient } from 'sanity';
import {
  type IntentParameters,
  type RouterContextValue,
  useRouter,
} from 'sanity/router';

import {
  type PreviewTargetClient,
  resolvePreviewTarget,
} from './preview-target';
import { PRESENTATION_API_VERSION } from './settings';
import {
  type CarryingTool,
  isPlainPrimaryClick,
  openDocumentOf,
  PRESENTATION_TOOL,
  STRUCTURE_TOOL,
  toolForHref,
} from './tool-menu-state';

/**
 * A settled resolution older than this is re-resolved when the pointer or the
 * focus reaches a tab — the navbar holds no document listener, so this is what
 * picks up a slug typed after the document was opened.
 */
const REFRESH_AFTER_MS = 1500;

/** What one open document carries across: which tab, and how to resolve it. */
type Carry = {
  target: CarryingTool;
  key: string;
  resolve: () => Promise<IntentParameters | null>;
};

function carryFor(
  target: CarryingTool,
  id: string,
  type: string | undefined,
  client: PreviewTargetClient,
): Carry {
  if (target === PRESENTATION_TOOL) {
    return {
      target,
      key: `${target}:${id}`,
      resolve: async () => {
        const previewTarget = await resolvePreviewTarget(client, id);
        return previewTarget
          ? {
              id,
              type: previewTarget.type,
              mode: PRESENTATION_TOOL,
              preview: previewTarget.href,
            }
          : null;
      },
    };
  }

  return {
    target,
    key: `${target}:${type ?? ''}:${id}`,
    resolve: async () => (type ? { id, type, mode: STRUCTURE_TOOL } : null),
  };
}

type Resolution = {
  key: string;
  startedAt: number;
  settled: boolean;
  promise: Promise<IntentParameters | null>;
};

function startResolution(carry: Carry): Resolution {
  const resolution: Resolution = {
    key: carry.key,
    startedAt: Date.now(),
    settled: false,
    promise: Promise.resolve(null),
  };

  resolution.promise = carry.resolve().then(
    (params) => {
      resolution.settled = true;
      return params;
    },
    () => {
      resolution.settled = true;
      return null;
    },
  );

  return resolution;
}

function toolAnchorOf(event: SyntheticEvent): HTMLAnchorElement | null {
  const { target } = event;
  if (!(target instanceof Element)) return null;

  const anchor = target.closest('a[href]');
  return anchor instanceof HTMLAnchorElement ? anchor : null;
}

function carryingToolOf(
  anchor: HTMLAnchorElement,
  router: RouterContextValue,
): CarryingTool | null {
  const href = anchor.getAttribute('href');
  if (!href) return null;

  return toolForHref(href, {
    [STRUCTURE_TOOL]: router.resolvePathFromState({ tool: STRUCTURE_TOOL }),
    [PRESENTATION_TOOL]: router.resolvePathFromState({
      tool: PRESENTATION_TOOL,
    }),
  });
}

/**
 * `studio.components.toolMenu`. `display: contents` keeps the wrapper out of
 * the layout, so the topbar and the sidebar render exactly what Sanity
 * renders; React delivers the overflow menu's portalled clicks here too.
 */
export function ContextualToolMenu(props: ToolMenuProps) {
  const router = useRouter();
  const client = useClient({ apiVersion: PRESENTATION_API_VERSION });

  const routerRef = useRef(router);
  routerRef.current = router;

  // Primitives, so the carry — and its pre-resolution — changes with the open
  // document and not with every router state change.
  const open = openDocumentOf(router.state);
  const target = open?.target;
  const id = open?.id;
  const type = open?.type;

  const carry = useMemo(
    () => (target && id ? carryFor(target, id, type, client) : null),
    [client, id, target, type],
  );
  const carryRef = useRef(carry);
  carryRef.current = carry;

  const resolutionRef = useRef<Resolution | null>(null);
  const clickAttemptRef = useRef(0);

  // Pre-resolve per open document, so a click usually navigates at once.
  useEffect(() => {
    if (carry && resolutionRef.current?.key !== carry.key) {
      resolutionRef.current = startResolution(carry);
    }
  }, [carry]);

  // Pointer or focus on the carrying tab: refresh a settled resolution that
  // has aged, so the slug the editor just typed is the one „Podgląd" opens.
  const onIntentCapture = useCallback((event: SyntheticEvent) => {
    const current = carryRef.current;
    const existing = resolutionRef.current;
    if (
      !current ||
      existing?.key !== current.key ||
      !existing.settled ||
      Date.now() - existing.startedAt < REFRESH_AFTER_MS
    ) {
      return;
    }

    const anchor = toolAnchorOf(event);
    if (
      anchor &&
      carryingToolOf(anchor, routerRef.current) === current.target
    ) {
      resolutionRef.current = startResolution(current);
    }
  }, []);

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !isPlainPrimaryClick(event)) return;

    const current = carryRef.current;
    if (!current) return;

    const anchor = toolAnchorOf(event);
    if (!anchor || (anchor.target && anchor.target !== '_self')) return;
    if (carryingToolOf(anchor, routerRef.current) !== current.target) return;

    const rootHref = anchor.getAttribute('href');
    if (!rootHref) return;

    // Synchronously, before any await: `useLink` checks isDefaultPrevented()
    // first and then leaves the navigation to us.
    event.preventDefault();

    const attempt = ++clickAttemptRef.current;
    const resolution =
      resolutionRef.current?.key === current.key
        ? resolutionRef.current
        : (resolutionRef.current = startResolution(current));

    void resolution.promise.then((params) => {
      // A later click, or a different open document, supersedes this one.
      if (
        attempt !== clickAttemptRef.current ||
        carryRef.current?.key !== current.key
      ) {
        return;
      }

      try {
        if (params) {
          routerRef.current.navigateIntent('edit', params);
          return;
        }
      } catch {
        // Fall through to the tool root: the tab never becomes a dead button.
      }

      routerRef.current.navigateUrl({ path: rootHref });
    });
  }, []);

  return (
    <div
      style={{ display: 'contents' }}
      onClickCapture={onClickCapture}
      onFocusCapture={onIntentCapture}
      onPointerDownCapture={onIntentCapture}
      onPointerOverCapture={onIntentCapture}
    >
      {props.renderDefault(props)}
    </div>
  );
}
