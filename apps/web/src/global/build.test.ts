import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  limitBuildTimeStaticParams,
  shouldLimitBuildTimeStaticParams,
} from './build';

describe('build-time static params', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('limits params in local / CI builds (no VERCEL_ENV)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('LIMIT_BUILD_TIME_STATIC_PARAMS', undefined);

    expect(shouldLimitBuildTimeStaticParams()).toBe(true);
    expect(limitBuildTimeStaticParams([{ slug: 'a' }, { slug: 'b' }])).toEqual([
      { slug: 'a' },
    ]);
  });

  it('limits params in Vercel preview builds', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('LIMIT_BUILD_TIME_STATIC_PARAMS', undefined);

    expect(shouldLimitBuildTimeStaticParams()).toBe(true);
  });

  it('prerenders every slug in Vercel production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('LIMIT_BUILD_TIME_STATIC_PARAMS', undefined);

    expect(shouldLimitBuildTimeStaticParams()).toBe(false);
    expect(
      limitBuildTimeStaticParams([{ slug: 'a' }, { slug: 'b' }]),
    ).toHaveLength(2);
  });

  it('honours an explicit limit in production builds', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('LIMIT_BUILD_TIME_STATIC_PARAMS', '1');

    expect(shouldLimitBuildTimeStaticParams()).toBe(true);
  });

  it('allows builds to opt out explicitly', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LIMIT_BUILD_TIME_STATIC_PARAMS', '0');

    expect(shouldLimitBuildTimeStaticParams()).toBe(false);
    expect(limitBuildTimeStaticParams([{ slug: 'a' }, { slug: 'b' }])).toEqual([
      { slug: 'a' },
      { slug: 'b' },
    ]);
  });
});
