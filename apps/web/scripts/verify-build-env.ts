const requiredProductionEnv = [
  'P24_MODE',
  'P24_MERCHANT_ID',
  'P24_POS_ID',
  'P24_API_KEY',
  'P24_CRC',
  'P24_STATUS_CALLBACK_BASE_URL',
] as const;

const optionalP24Env = [
  'P24_API_BASE_URL',
  'P24_PANEL_BASE_URL',
  'P24_STATUS_ALLOWED_IPS',
  'P24_REQUEST_TIMEOUT_MS',
  'P24_FORCE_MOCK',
] as const;

function describeEnvValue(key: string): string {
  const value = process.env[key]?.trim() ?? '';

  if (!value) {
    return 'missing';
  }

  return `present, trimmed length ${value.length}`;
}

console.log('[build-env] VERCEL_ENV:', process.env.VERCEL_ENV ?? 'missing');
console.log('[build-env] NODE_ENV:', process.env.NODE_ENV ?? 'missing');

for (const key of requiredProductionEnv) {
  console.log(`[build-env] ${key}: ${describeEnvValue(key)}`);
}

for (const key of optionalP24Env) {
  console.log(`[build-env] ${key}: ${describeEnvValue(key)}`);
}

if (process.env.VERCEL_ENV === 'production') {
  const missingKeys = requiredProductionEnv.filter((key) => {
    const value = process.env[key]?.trim();

    return !value;
  });

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required production build environment variables: ${missingKeys.join(
        ', ',
      )}`,
    );
  }

  if (process.env.P24_MODE?.trim() !== 'production') {
    throw new Error('Production builds require P24_MODE=production.');
  }
}
