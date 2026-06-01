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

export function limitBuildTimeStaticParams<TParam>(params: TParam[]): TParam[] {
  if (!shouldLimitBuildTimeStaticParams()) {
    return params;
  }

  // cacheComponents still requires at least one param for build-time validation.
  return params.slice(0, 1);
}
