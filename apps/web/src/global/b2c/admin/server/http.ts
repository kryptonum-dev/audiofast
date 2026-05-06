import { NextResponse } from 'next/server';

export type AdminErrorResponse = {
  ok: false;
  error: string;
  message: string;
};

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedOrigins(): Set<string> | null {
  const allowedOrigins = parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_ORIGINS);

  return allowedOrigins.length > 0 ? new Set(allowedOrigins) : null;
}

export function hasAdminAllowedOrigins(): boolean {
  return getAllowedOrigins() !== null;
}

export function getAdminCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  if (!origin || !allowedOrigins?.has(origin)) {
    return {
      Vary: 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}

export function adminJson<T>(
  request: Request,
  body: T,
  status = 200,
): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: getAdminCorsHeaders(request),
  });
}

export function adminErrorJson(
  request: Request,
  error: string,
  message: string,
  status: number,
): NextResponse<AdminErrorResponse> {
  return adminJson(
    request,
    {
      ok: false,
      error,
      message,
    },
    status,
  );
}

export function adminOptions(request: Request): Response {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  if (!allowedOrigins) {
    return adminErrorJson(
      request,
      'admin_cors_config_missing',
      'B2C admin allowed origins are not configured.',
      500,
    );
  }

  if (origin && !allowedOrigins.has(origin)) {
    return adminErrorJson(
      request,
      'origin_not_allowed',
      'This origin is not allowed to call the B2C admin API.',
      403,
    );
  }

  return new Response(null, {
    status: 204,
    headers: getAdminCorsHeaders(request),
  });
}
