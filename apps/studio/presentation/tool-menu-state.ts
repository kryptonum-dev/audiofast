/**
 * The decisions behind the „Treść" / „Podgląd" tool menu
 * (`contextual-tool-menu.tsx`) that need no browser: which document is open,
 * which clicks the menu takes over, and which tool an anchor opens.
 */

/** Tool names as registered in `sanity.config.ts` — never the visible titles. */
export const STRUCTURE_TOOL = 'structure';
export const PRESENTATION_TOOL = 'presentation';

export type CarryingTool = typeof STRUCTURE_TOOL | typeof PRESENTATION_TOOL;

/** The pane id prefix Structure gives a document opened outside the tree. */
const EDIT_PANE_PREFIX = '__edit__';

/** Any base works: only the pathname of an absolute path is compared. */
const URL_BASE = 'http://studio.invalid';

export type OpenDocument = { id: string; type?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** `drafts.x` / `versions.<release>.x` → `x` (sanity's `getPublishedId`). */
export function publishedIdOf(id: string): string {
  if (id.startsWith('drafts.')) return id.slice('drafts.'.length);
  if (id.startsWith('versions.')) return id.split('.').slice(2).join('.');
  return id;
}

/**
 * The document open in Structure, read off the router state: the RIGHTMOST
 * pane (`panes` is one group per column; siblings within a group are a split
 * view of the same pane). A `__edit__<id>` pane is a document opened outside
 * the tree, and carries its type as a param.
 *
 * Returns a CANDIDATE: the router state names panes, not pane kinds, so a list
 * path (`…;produkty-wg-marki;<brandId>`) yields its last item id, and it is
 * the resolver's one-shot read that answers "not a document" (or, for a list
 * keyed by a document id, previews that document). Singletons open under list
 * items whose id IS the document id (`structure.ts` `createSingleTon`), so
 * they resolve directly. `null` only for the root and non-pane state.
 */
export function openDocumentFromStructurePanes(
  panes: unknown,
): OpenDocument | null {
  if (!Array.isArray(panes)) return null;

  const group: unknown = panes.at(-1);
  if (!Array.isArray(group)) return null;

  const pane: unknown = group[0];
  if (!isRecord(pane) || typeof pane.id !== 'string') return null;

  const id = pane.id.startsWith(EDIT_PANE_PREFIX)
    ? pane.id.slice(EDIT_PANE_PREFIX.length)
    : pane.id;
  if (!id) return null;

  const type = isRecord(pane.params) ? pane.params.type : undefined;
  return typeof type === 'string' && type ? { id, type } : { id };
}

/**
 * The document open in Presentation: both `id` and `type` from its router
 * state, or nothing (a page shown without a document in the URL).
 */
export function openDocumentFromPresentationState(
  state: unknown,
): Required<OpenDocument> | null {
  if (!isRecord(state)) return null;

  const { id, type } = state;
  return typeof id === 'string' && id && typeof type === 'string' && type
    ? { id: publishedIdOf(id), type }
    : null;
}

export type ClickLike = {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/** An unmodified primary-button click — the only click the menu takes over. */
export function isPlainPrimaryClick(event: ClickLike): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function pathnameOf(href: string): string | null {
  try {
    const { pathname } = new URL(href, URL_BASE);
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  } catch {
    return null;
  }
}

/**
 * Which tool an anchor opens: its pathname compared with each tool's resolved
 * root path (`router.resolvePathFromState({tool})`, which carries the
 * workspace `basePath`). Search params — the sticky `perspective` among them
 * — and a trailing slash never decide; anything deeper is no tool's tab.
 */
export function toolForHref<Tool extends string>(
  href: string,
  toolPaths: Readonly<Record<Tool, string>>,
): Tool | null {
  const pathname = pathnameOf(href);
  if (!pathname) return null;

  for (const [tool, path] of Object.entries(toolPaths) as [Tool, string][]) {
    if (pathnameOf(path) === pathname) return tool;
  }

  return null;
}

/**
 * The document open in the active tool, as the tab it carries across to:
 * Structure's open document rides the „Podgląd" tab, Presentation's the
 * „Treść" tab. `null` while no document is open, or in any other tool.
 */
export function openDocumentOf(
  state: Record<string, unknown>,
): (OpenDocument & { target: CarryingTool }) | null {
  if (state.tool === STRUCTURE_TOOL) {
    const structure = state[STRUCTURE_TOOL];
    const document = openDocumentFromStructurePanes(
      isRecord(structure) ? structure.panes : undefined,
    );
    return document
      ? {
          ...document,
          id: publishedIdOf(document.id),
          target: PRESENTATION_TOOL,
        }
      : null;
  }

  if (state.tool === PRESENTATION_TOOL) {
    const document = openDocumentFromPresentationState(
      state[PRESENTATION_TOOL],
    );
    return document ? { ...document, target: STRUCTURE_TOOL } : null;
  }

  return null;
}
