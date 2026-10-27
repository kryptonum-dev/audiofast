/**
 * The tool-menu decisions that need no browser: which document is open,
 * which clicks the menu takes over, and which tool an anchor opens. Pane ids
 * follow audiofast's `structure.ts` (singletons under an item whose id is the
 * document id, products nested under brand lists).
 */
import { describe, expect, test } from 'vitest';

import {
  isPlainPrimaryClick,
  openDocumentFromPresentationState,
  openDocumentFromStructurePanes,
  openDocumentOf,
  PRESENTATION_TOOL,
  publishedIdOf,
  STRUCTURE_TOOL,
  toolForHref,
} from './tool-menu-state';

const pane = (id: string, params?: Record<string, string>) =>
  params ? { id, params } : { id };

describe('openDocumentFromStructurePanes', () => {
  test('a product nested under its brand list is the rightmost pane', () => {
    expect(
      openDocumentFromStructurePanes([
        [pane('produkty')],
        [pane('produkty-wg-marki')],
        [pane('brand.a')],
        [pane('product.1')],
      ]),
    ).toEqual({ id: 'product.1' });
  });

  test('a singleton opens under its document id', () => {
    expect(openDocumentFromStructurePanes([[pane('homePage')]])).toEqual({
      id: 'homePage',
    });
  });

  test('a lone `__edit__` editor strips the prefix and keeps its type', () => {
    expect(
      openDocumentFromStructurePanes([
        [pane('__edit__faq.1', { type: 'faq' })],
      ]),
    ).toEqual({ id: 'faq.1', type: 'faq' });
  });

  test('a split view reads the first sibling of the rightmost group', () => {
    expect(
      openDocumentFromStructurePanes([
        [pane('podstrony')],
        [pane('page.o-nas'), pane('page.o-nas', { view: 'filtry' })],
      ]),
    ).toEqual({ id: 'page.o-nas' });
  });

  test('the Structure root and non-pane state open nothing', () => {
    expect(openDocumentFromStructurePanes(undefined)).toBeNull();
    expect(openDocumentFromStructurePanes([])).toBeNull();
    expect(openDocumentFromStructurePanes([[]])).toBeNull();
    expect(openDocumentFromStructurePanes([[pane('__edit__')]])).toBeNull();
    expect(openDocumentFromStructurePanes('produkty')).toBeNull();
  });
});

describe('openDocumentFromPresentationState', () => {
  test('needs both id and type, and normalises the id', () => {
    expect(
      openDocumentFromPresentationState({ type: 'product', id: 'drafts.p' }),
    ).toEqual({ id: 'p', type: 'product' });
  });

  test('a page shown without a document in the URL opens nothing', () => {
    expect(openDocumentFromPresentationState(undefined)).toBeNull();
    expect(openDocumentFromPresentationState({})).toBeNull();
    expect(openDocumentFromPresentationState({ type: 'product' })).toBeNull();
    expect(openDocumentFromPresentationState({ id: 'p' })).toBeNull();
  });
});

describe('openDocumentOf', () => {
  test('Structure carries to Podgląd, Presentation to Treść', () => {
    expect(
      openDocumentOf({
        tool: STRUCTURE_TOOL,
        structure: { panes: [[pane('podstrony')], [pane('drafts.page.x')]] },
      }),
    ).toEqual({ id: 'page.x', target: PRESENTATION_TOOL });

    expect(
      openDocumentOf({
        tool: PRESENTATION_TOOL,
        presentation: { type: 'blog', id: 'blog' },
      }),
    ).toEqual({ id: 'blog', type: 'blog', target: STRUCTURE_TOOL });
  });

  test('nothing is carried from another tool or with no document open', () => {
    expect(openDocumentOf({ tool: 'newsletter' })).toBeNull();
    expect(openDocumentOf({ tool: STRUCTURE_TOOL })).toBeNull();
    expect(
      openDocumentOf({ tool: PRESENTATION_TOOL, presentation: {} }),
    ).toBeNull();
  });
});

describe('publishedIdOf', () => {
  test('strips draft and release prefixes', () => {
    expect(publishedIdOf('drafts.a')).toBe('a');
    expect(publishedIdOf('versions.r1.a.b')).toBe('a.b');
    expect(publishedIdOf('a')).toBe('a');
  });
});

describe('isPlainPrimaryClick', () => {
  const click = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };

  test('only an unmodified primary click is taken over', () => {
    expect(isPlainPrimaryClick(click)).toBe(true);
    expect(isPlainPrimaryClick({ ...click, metaKey: true })).toBe(false);
    expect(isPlainPrimaryClick({ ...click, ctrlKey: true })).toBe(false);
    expect(isPlainPrimaryClick({ ...click, shiftKey: true })).toBe(false);
    expect(isPlainPrimaryClick({ ...click, altKey: true })).toBe(false);
    expect(isPlainPrimaryClick({ ...click, button: 1 })).toBe(false);
  });
});

describe('toolForHref', () => {
  const toolPaths = {
    [STRUCTURE_TOOL]: '/structure',
    [PRESENTATION_TOOL]: '/presentation',
  };

  test('matches the tool root by pathname; sticky params never decide', () => {
    expect(toolForHref('/structure', toolPaths)).toBe(STRUCTURE_TOOL);
    expect(toolForHref('/presentation/', toolPaths)).toBe(PRESENTATION_TOOL);
    expect(toolForHref('/presentation?perspective=drafts', toolPaths)).toBe(
      PRESENTATION_TOOL,
    );
    expect(
      toolForHref('https://audiofast.sanity.studio/presentation', toolPaths),
    ).toBe(PRESENTATION_TOOL);
  });

  test('anything but a tool root is no tool tab', () => {
    expect(toolForHref('/newsletter', toolPaths)).toBeNull();
    expect(toolForHref('/structure/produkty', toolPaths)).toBeNull();
  });
});
