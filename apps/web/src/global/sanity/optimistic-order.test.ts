import { createElement, Fragment } from 'react';
import { describe, expect, it } from 'vitest';

import {
  getOptimisticBlockOrder,
  reorderBlockChildren,
} from './optimistic-order';

const documentId = 'homePage';
const document = {
  pageBuilder: [{ _key: 'second' }, { _key: 'first' }],
};

describe('getOptimisticBlockOrder', () => {
  it('returns the bare _key order of the patched document', () => {
    expect(
      getOptimisticBlockOrder(
        null,
        { id: documentId, document },
        documentId,
        'pageBuilder',
      ),
    ).toEqual(['second', 'first']);
  });

  it('keeps state for another document or an absent field', () => {
    const state = ['first', 'second'];
    expect(
      getOptimisticBlockOrder(
        state,
        { id: 'other', document },
        documentId,
        'pageBuilder',
      ),
    ).toBe(state);
    expect(
      getOptimisticBlockOrder(
        state,
        { id: documentId, document: {} },
        documentId,
        'pageBuilder',
      ),
    ).toBe(state);
  });
});

describe('reorderBlockChildren', () => {
  it('re-reducing its own output keeps raw keys (no re-prefix regression)', () => {
    const action = { id: documentId, document };
    const once = getOptimisticBlockOrder(
      null,
      action,
      documentId,
      'pageBuilder',
    );
    const twice = getOptimisticBlockOrder(
      once,
      action,
      documentId,
      'pageBuilder',
    );
    const thrice = getOptimisticBlockOrder(
      twice,
      action,
      documentId,
      'pageBuilder',
    );
    expect(thrice).toEqual(['second', 'first']);

    const first = createElement(
      Fragment,
      { key: 'first' },
      'fresh server text',
    );
    const second = createElement('div', { key: 'second' });
    expect(reorderBlockChildren([first, second], thrice)).toEqual([
      second,
      first,
    ]);
  });

  it('skips raw keys that were not rendered', () => {
    const first = createElement('div', { key: 'first' });
    const second = createElement('div', { key: 'second' });
    expect(
      reorderBlockChildren([first, second], ['second', 'filtered', 'first']),
    ).toEqual([second, first]);
  });

  it('keeps the server order for sparse events and pristine state', () => {
    const children = [
      createElement('div', { key: 'first' }),
      createElement('div', { key: 'second' }),
    ];
    expect(reorderBlockChildren(children, ['first'])).toBe(children);
    expect(reorderBlockChildren(children, null)).toBe(children);
  });

  it('returns the children untouched when a child is unkeyed', () => {
    const children = [
      createElement('div', { key: 'first' }),
      createElement('div', null),
    ];
    expect(reorderBlockChildren(children, ['first'])).toBe(children);
  });
});
