/**
 * Production deploys prerender every slug (P6): all ~1.4k product, review,
 * blog, CPO, brand and category pages are in the static output, so nothing
 * goes cold after a deploy. Every other build (local, CI, Vercel preview)
 * prerenders one row per route family to stay fast.
 *
 * `LIMIT_BUILD_TIME_STATIC_PARAMS=0|1` overrides either way.
 */
export function shouldLimitBuildTimeStaticParams(): boolean {
  if (process.env.LIMIT_BUILD_TIME_STATIC_PARAMS === '0') {
    return false;
  }
  if (process.env.LIMIT_BUILD_TIME_STATIC_PARAMS === '1') {
    return true;
  }

  return process.env.VERCEL_ENV !== 'production';
}

export function allBuildTimeStaticParams<TParam>(
  params: TParam[],
  fallback?: TParam,
): TParam[] {
  // cacheComponents requires at least one param for build-time validation, even
  // when the underlying dataset is currently empty. When a fallback is provided
  // and there is nothing to build, emit it so the route still validates — the
  // page is expected to `notFound()` for it at runtime.
  if (params.length === 0 && fallback !== undefined) {
    return [fallback];
  }

  return params;
}

export function limitBuildTimeStaticParams<TParam>(
  params: TParam[],
  fallback?: TParam,
): TParam[] {
  const resolved = allBuildTimeStaticParams(params, fallback);

  if (!shouldLimitBuildTimeStaticParams()) {
    return resolved;
  }

  return resolved.slice(0, 1);
}
