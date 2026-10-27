import { describe, expect, test, vi } from 'vitest';

import {
  isOpenInPresentationDisabled,
  resolveAndOpenInPresentation,
} from './open-in-presentation';

const noop = () => undefined;

describe('OpenInPresentationAction', () => {
  test('an older revision cannot keep the action enabled', () => {
    expect(
      isOpenInPresentationDisabled(
        { href: '/o-nas/', key: 'page.o-nas:page:rev-old' },
        'page.o-nas:page:rev-new',
        false,
      ),
    ).toBe(true);
  });

  test('an in-flight open disables the action', () => {
    expect(
      isOpenInPresentationDisabled({ href: '/o-nas/', key: 'k' }, 'k', true),
    ).toBe(true);
  });

  test('re-resolves the href on activation instead of using a stale menu snapshot', async () => {
    const navigate = vi.fn(noop);
    const onMissing = vi.fn(noop);

    const result = await resolveAndOpenInPresentation({
      resolveHref: async () => '/o-nas-nowe/',
      isCurrent: () => true,
      navigate,
      onMissing,
      onError: noop,
    });

    expect(result).toBe('opened');
    expect(navigate).toHaveBeenCalledWith('/o-nas-nowe/');
    expect(onMissing).not.toHaveBeenCalled();
  });

  test('an async resolution from before a slug save cannot re-navigate', async () => {
    let release: ((href: string | null) => void) | undefined;
    let current = true;
    const navigate = vi.fn(noop);
    const resolving = new Promise<string | null>((resolve) => {
      release = resolve;
    });

    const opening = resolveAndOpenInPresentation({
      resolveHref: () => resolving,
      isCurrent: () => current,
      navigate,
      onMissing: noop,
      onError: noop,
    });

    current = false;
    release?.('/o-nas/');

    expect(await opening).toBe('stale');
    expect(navigate).not.toHaveBeenCalled();
  });

  test('a settled missing href stays clickable and reports the problem', async () => {
    const navigate = vi.fn(noop);
    const onMissing = vi.fn(noop);

    expect(
      isOpenInPresentationDisabled(
        { href: null, key: 'product.x:product:rev' },
        'product.x:product:rev',
        false,
      ),
    ).toBe(false);

    const result = await resolveAndOpenInPresentation({
      resolveHref: async () => null,
      isCurrent: () => true,
      navigate,
      onMissing,
      onError: noop,
    });

    expect(result).toBe('missing');
    expect(onMissing).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('a failed read reports an error', async () => {
    const onError = vi.fn(noop);
    const result = await resolveAndOpenInPresentation({
      resolveHref: async () => {
        throw new Error('offline');
      },
      isCurrent: () => true,
      navigate: noop,
      onMissing: noop,
      onError,
    });
    expect(result).toBe('error');
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
