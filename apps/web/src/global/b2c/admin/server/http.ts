import { NextResponse } from "next/server";

export type AdminErrorResponse = {
  ok: false;
  error: string;
  message: string;
};

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedOriginRules(): string[] | null {
  const allowedOrigins = parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_ORIGINS);

  return allowedOrigins.length > 0 ? allowedOrigins : null;
}

export function hasAdminAllowedOrigins(): boolean {
  return getAllowedOriginRules() !== null;
}

function isOriginAllowed(
  origin: string,
  allowedOriginRules: string[],
): boolean {
  if (allowedOriginRules.includes(origin)) {
    return true;
  }

  let parsedOrigin: URL;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  return allowedOriginRules.some((rule) =>
    matchesWildcardOriginRule(parsedOrigin, rule),
  );
}

function matchesWildcardOriginRule(origin: URL, rule: string): boolean {
  if (!rule.includes("*")) {
    return false;
  }

  let parsedRule: URL;

  try {
    parsedRule = new URL(rule);
  } catch {
    return false;
  }

  const wildcardPrefix = "*.";

  if (
    parsedRule.protocol !== origin.protocol ||
    !parsedRule.hostname.startsWith(wildcardPrefix) ||
    parsedRule.pathname !== "/" ||
    parsedRule.search ||
    parsedRule.hash
  ) {
    return false;
  }

  const domainSuffix = parsedRule.hostname.slice(wildcardPrefix.length);

  return (
    origin.hostname !== domainSuffix &&
    origin.hostname.endsWith(`.${domainSuffix}`) &&
    origin.port === parsedRule.port
  );
}

export function getAdminCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const allowedOriginRules = getAllowedOriginRules();

  if (
    !origin ||
    !allowedOriginRules ||
    !isOriginAllowed(origin, allowedOriginRules)
  ) {
    return {
      Vary: "Origin",
    };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
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
  const origin = request.headers.get("origin");
  const allowedOriginRules = getAllowedOriginRules();

  if (!allowedOriginRules) {
    return adminErrorJson(
      request,
      "admin_cors_config_missing",
      "B2C admin allowed origins are not configured.",
      500,
    );
  }

  if (origin && !isOriginAllowed(origin, allowedOriginRules)) {
    return adminErrorJson(
      request,
      "origin_not_allowed",
      "This origin is not allowed to call the B2C admin API.",
      403,
    );
  }

  return new Response(null, {
    status: 204,
    headers: getAdminCorsHeaders(request),
  });
}
