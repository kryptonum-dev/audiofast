import { afterEach, describe, expect, it, vi } from "vitest";

import { adminOptions, getAdminCorsHeaders } from "./http";

function requestWithOrigin(origin: string): Request {
  return new Request("https://audiofast.pl/api/admin/orders", {
    headers: {
      Origin: origin,
    },
    method: "OPTIONS",
  });
}

describe("admin CORS helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows exact configured origins", () => {
    vi.stubEnv("B2C_ADMIN_ALLOWED_ORIGINS", "https://www.sanity.io");

    expect(
      getAdminCorsHeaders(requestWithOrigin("https://www.sanity.io")),
    ).toMatchObject({
      "Access-Control-Allow-Origin": "https://www.sanity.io",
    });
  });

  it("allows wildcard subdomain origins", () => {
    vi.stubEnv(
      "B2C_ADMIN_ALLOWED_ORIGINS",
      "https://*.sanity.io,https://*.sanity.build",
    );

    expect(
      getAdminCorsHeaders(requestWithOrigin("https://admin.sanity.io")),
    ).toMatchObject({
      "Access-Control-Allow-Origin": "https://admin.sanity.io",
    });
    expect(
      getAdminCorsHeaders(requestWithOrigin("https://abc123.sanity.build")),
    ).toMatchObject({
      "Access-Control-Allow-Origin": "https://abc123.sanity.build",
    });
  });

  it("does not allow wildcard parent domains or different protocols", async () => {
    vi.stubEnv("B2C_ADMIN_ALLOWED_ORIGINS", "https://*.sanity.io");

    expect(getAdminCorsHeaders(requestWithOrigin("https://sanity.io"))).toEqual(
      {
        Vary: "Origin",
      },
    );

    const response = adminOptions(requestWithOrigin("http://admin.sanity.io"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "origin_not_allowed",
    });
  });
});
