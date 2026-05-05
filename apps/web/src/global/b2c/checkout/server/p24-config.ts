import 'server-only';

export type P24Mode = 'mock' | 'sandbox' | 'production';

export type P24Config = {
  mode: Exclude<P24Mode, 'mock'>;
  merchantId: number;
  posId: number;
  apiKey: string;
  crc: string;
  apiBaseUrl: string;
  redirectBaseUrl: string;
  requestTimeoutMs: number;
  allowedStatusIps: string[];
};

type P24Env = Partial<NodeJS.ProcessEnv>;

const DEFAULT_P24_REQUEST_TIMEOUT_MS = 10_000;
const P24_SANDBOX_API_BASE_URL = 'https://sandbox.przelewy24.pl/api/v1';
const P24_SANDBOX_REDIRECT_BASE_URL = 'https://sandbox.przelewy24.pl';
const P24_PRODUCTION_API_BASE_URL = 'https://secure.przelewy24.pl/api/v1';
const P24_PRODUCTION_REDIRECT_BASE_URL = 'https://secure.przelewy24.pl';

export class P24ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'P24ConfigError';
  }
}

function normalizeMode(value: string | undefined): P24Mode {
  if (value === 'sandbox' || value === 'production') {
    return value;
  }

  return 'mock';
}

function parseRequiredInteger(args: { env: P24Env; key: string }): number {
  const rawValue = args.env[args.key]?.trim();

  if (!rawValue) {
    throw new P24ConfigError(
      `Missing required P24 environment variable ${args.key}.`,
    );
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new P24ConfigError(
      `P24 environment variable ${args.key} must be a positive integer.`,
    );
  }

  return parsedValue;
}

function parseRequiredString(args: { env: P24Env; key: string }): string {
  const value = args.env[args.key]?.trim();

  if (!value) {
    throw new P24ConfigError(
      `Missing required P24 environment variable ${args.key}.`,
    );
  }

  return value;
}

function parseOptionalUrl(args: {
  env: P24Env;
  key: string;
  fallback: string;
}): string {
  const envValue = args.env[args.key]?.trim();
  const rawValue = envValue && envValue.length > 0 ? envValue : args.fallback;

  try {
    const url = new URL(rawValue);

    if (url.protocol !== 'https:') {
      throw new P24ConfigError(
        `P24 environment variable ${args.key} must use HTTPS.`,
      );
    }

    return url.toString().replace(/\/$/, '');
  } catch (error) {
    if (error instanceof P24ConfigError) {
      throw error;
    }

    throw new P24ConfigError(
      `P24 environment variable ${args.key} must be a valid URL.`,
    );
  }
}

function parseTimeoutMs(env: P24Env): number {
  const rawValue = env.P24_REQUEST_TIMEOUT_MS?.trim();

  if (!rawValue) {
    return DEFAULT_P24_REQUEST_TIMEOUT_MS;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new P24ConfigError(
      'P24_REQUEST_TIMEOUT_MS must be a positive integer.',
    );
  }

  return parsedValue;
}

function parseAllowedStatusIps(env: P24Env): string[] {
  return (env.P24_STATUS_ALLOWED_IPS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getP24Mode(env: P24Env = process.env): P24Mode {
  if (env.P24_FORCE_MOCK === '1') {
    return 'mock';
  }

  return normalizeMode(env.P24_MODE);
}

export function isP24LiveMode(env: P24Env = process.env): boolean {
  return getP24Mode(env) !== 'mock';
}

export function loadP24Config(env: P24Env = process.env): P24Config {
  const mode = getP24Mode(env);

  if (mode === 'mock') {
    throw new P24ConfigError(
      'P24 live config was requested while P24 is in mock mode.',
    );
  }

  const defaultApiBaseUrl =
    mode === 'sandbox' ? P24_SANDBOX_API_BASE_URL : P24_PRODUCTION_API_BASE_URL;
  const defaultRedirectBaseUrl =
    mode === 'sandbox'
      ? P24_SANDBOX_REDIRECT_BASE_URL
      : P24_PRODUCTION_REDIRECT_BASE_URL;

  return {
    mode,
    merchantId: parseRequiredInteger({
      env,
      key: 'P24_MERCHANT_ID',
    }),
    posId: parseRequiredInteger({
      env,
      key: 'P24_POS_ID',
    }),
    apiKey: parseRequiredString({
      env,
      key: 'P24_API_KEY',
    }),
    crc: parseRequiredString({
      env,
      key: 'P24_CRC',
    }),
    apiBaseUrl: parseOptionalUrl({
      env,
      key: 'P24_API_BASE_URL',
      fallback: defaultApiBaseUrl,
    }),
    redirectBaseUrl: parseOptionalUrl({
      env,
      key: 'P24_PANEL_BASE_URL',
      fallback: defaultRedirectBaseUrl,
    }),
    requestTimeoutMs: parseTimeoutMs(env),
    allowedStatusIps: parseAllowedStatusIps(env),
  };
}
