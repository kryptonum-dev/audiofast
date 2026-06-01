import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  limitBuildTimeStaticParams,
  shouldLimitBuildTimeStaticParams,
} from './build';

describe('build-time static params', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('limits params during production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('LIMIT_BUILD_TIME_STATIC_PARAMS', undefined);

    expect(shouldLimitBuildTimeStaticParams()).toBe(true);
    expect(limitBuildTimeStaticParams([{ slug: 'a' }, { slug: 'b' }])).toEqual([
      { slug: 'a' },
    ]);
  });

  it('allows production builds to opt out explicitly', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LIMIT_BUILD_TIME_STATIC_PARAMS', '0');

    expect(shouldLimitBuildTimeStaticParams()).toBe(false);
    expect(limitBuildTimeStaticParams([{ slug: 'a' }, { slug: 'b' }])).toEqual([
      { slug: 'a' },
      { slug: 'b' },
    ]);
  });
});
