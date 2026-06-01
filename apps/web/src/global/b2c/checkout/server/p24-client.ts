import 'server-only';

import type { P24Currency, P24Language } from '../payment-contracts';
import type { P24Config } from './p24-config';

export type P24TransactionRegisterRequest = {
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  currency: P24Currency;
  description: string;
  email: string;
  country: string;
  language: P24Language;
  urlReturn: string;
  urlStatus: string;
  sign: string;
  client?: string;
  address?: string;
  zip?: string;
  city?: string;
  phone?: string | null;
  timeLimit?: number;
  ttl?: number;
  channel?: number;
  transferLabel?: string;
  cart?: Array<{
    sellerId: string;
    sellerCategory: string;
    name: string;
    description: string;
    quantity: number;
    price: number;
    number: string;
  }>;
};

export type P24TransactionRegisterResponse = {
  responseCode: number;
  data: {
    token: string;
  };
};

export type P24TransactionVerifyRequest = {
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  currency: P24Currency;
  orderId: number;
  sign: string;
};

export type P24TransactionVerifyResponse = {
  responseCode: number;
  data?: {
    status?: string;
  };
};

export class P24ClientError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'network_error'
      | 'http_error'
      | 'invalid_response'
      | 'p24_error',
    public readonly status: number | null = null,
    public readonly responseCode: number | null = null,
    public readonly responseBody: unknown = null,
  ) {
    super(message);
    this.name = 'P24ClientError';
  }
}

function buildBasicAuthHeader(config: P24Config): string {
  return `Basic ${Buffer.from(`${config.posId}:${config.apiKey}`).toString(
    'base64',
  )}`;
}

function buildP24Url(config: P24Config, path: string): string {
  return `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new P24ClientError(
      'Przelewy24 returned a non-JSON response.',
      'invalid_response',
      response.status,
    );
  }
}

function getResponseCode(value: unknown): number | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'responseCode' in value &&
    typeof value.responseCode === 'number'
  ) {
    return value.responseCode;
  }

  return null;
}

function assertSuccessfulP24Response(args: {
  response: Response;
  body: unknown;
  operation: string;
}): void {
  const responseCode = getResponseCode(args.body);

  if (!args.response.ok) {
    throw new P24ClientError(
      `Przelewy24 ${args.operation} request failed with HTTP ${args.response.status}.`,
      'http_error',
      args.response.status,
      responseCode,
      args.body,
    );
  }

  if (responseCode !== null && responseCode !== 0) {
    throw new P24ClientError(
      `Przelewy24 ${args.operation} request returned responseCode ${responseCode}.`,
      'p24_error',
      args.response.status,
      responseCode,
      args.body,
    );
  }
}

function isRegisterResponse(
  value: unknown,
): value is P24TransactionRegisterResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'responseCode' in value &&
    value.responseCode === 0 &&
    'data' in value &&
    typeof value.data === 'object' &&
    value.data !== null &&
    'token' in value.data &&
    typeof value.data.token === 'string' &&
    value.data.token.length > 0
  );
}

function isVerifyResponse(
  value: unknown,
): value is P24TransactionVerifyResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'responseCode' in value &&
    value.responseCode === 0
  );
}

export class P24Client {
  constructor(private readonly config: P24Config) {}

  private async request(args: {
    method: 'GET' | 'POST' | 'PUT';
    path: string;
    operation: string;
    body?: unknown;
  }): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(buildP24Url(this.config, args.path), {
        method: args.method,
        headers: {
          Authorization: buildBasicAuthHeader(this.config),
          Accept: 'application/json',
          ...(args.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: args.body ? JSON.stringify(args.body) : undefined,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error) {
      throw new P24ClientError(
        `Przelewy24 ${args.operation} request could not be completed.`,
        'network_error',
        null,
        null,
      );
    }

    const body = await parseJsonResponse(response);
    assertSuccessfulP24Response({
      response,
      body,
      operation: args.operation,
    });

    return body;
  }

  async testAccess(): Promise<boolean> {
    await this.request({
      method: 'GET',
      path: '/testAccess',
      operation: 'testAccess',
    });

    return true;
  }

  async registerTransaction(
    payload: P24TransactionRegisterRequest,
  ): Promise<P24TransactionRegisterResponse> {
    const body = await this.request({
      method: 'POST',
      path: '/transaction/register',
      operation: 'transaction/register',
      body: payload,
    });

    if (!isRegisterResponse(body)) {
      throw new P24ClientError(
        'Przelewy24 transaction/register returned an invalid response.',
        'invalid_response',
      );
    }

    return body;
  }

  async verifyTransaction(
    payload: P24TransactionVerifyRequest,
  ): Promise<P24TransactionVerifyResponse> {
    const body = await this.request({
      method: 'PUT',
      path: '/transaction/verify',
      operation: 'transaction/verify',
      body: payload,
    });

    if (!isVerifyResponse(body)) {
      throw new P24ClientError(
        'Przelewy24 transaction/verify returned an invalid response.',
        'invalid_response',
      );
    }

    return body;
  }
}
