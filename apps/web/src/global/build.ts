export function shouldLimitBuildTimeStaticParams(): boolean {
  if (process.env.LIMIT_BUILD_TIME_STATIC_PARAMS === '0') {
    return false;
  }

  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.LIMIT_BUILD_TIME_STATIC_PARAMS === '1'
  );
}

export function limitBuildTimeStaticParams<TParam>(
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

  if (!shouldLimitBuildTimeStaticParams()) {
    return params;
  }

  return params.slice(0, 1);
}
