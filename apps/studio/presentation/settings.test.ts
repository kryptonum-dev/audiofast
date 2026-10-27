import { afterEach, describe, expect, test, vi } from 'vitest';

import { isPresentationEnabled } from './settings';

describe('isPresentationEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('always on under `sanity dev`', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SANITY_STUDIO_PRESENTATION_ENABLED', 'false');
    expect(isPresentationEnabled()).toBe(true);
  });

  test('off in a built Studio unless the flag is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SANITY_STUDIO_PRESENTATION_ENABLED', '');
    expect(isPresentationEnabled()).toBe(false);
  });

  test('on in a built Studio with the flag', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SANITY_STUDIO_PRESENTATION_ENABLED', 'true');
    expect(isPresentationEnabled()).toBe(true);
  });
});
