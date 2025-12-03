import { createHash, randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { AnalyticsUser } from "@/global/analytics/types";
import { client as sanityClient } from "@/global/sanity/client";

type MetaRequestBody = {
  event_name: string;
  event_id?: string;
  url?: string;
  event_time?: number;
  content_name?: string;
  user?: AnalyticsUser;
  custom_event_params?: Record<string, unknown>;
  utm?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  };
};

const META_ANALYTICS_QUERY = `
  {
    "metaPixelId": *[_type == "settings"][0].analytics.metaPixelId,
    "metaConversionToken": *[_type == "settings"][0].analytics.metaConversionToken
  }
`;

type MetaAnalyticsConfig = {
  metaPixelId: string | null;
  metaConversionToken: string | null;
};

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

function getCookie(headers: Headers, name: string): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.slice(name.length + 1));
    }
  }
  return null;
}

function sha256(value?: string | null) {
  if (!value) return undefined;
  return createHash("sha256").update(value).digest("hex");
}

function phoneToE164(raw?: string, defaultCountry = "+48"): string | undefined {
  if (!raw) return undefined;
  let v = raw.replace(/\s+/g, "").trim();
  if (!v) return undefined;
  if (!v.startsWith("+")) {
    if (v.startsWith("0")) v = v.replace(/^0+/, "");
    v = `${defaultCountry}${v}`;
  }
  return v;
}

function computeFbc(fbcCookie?: string | null, urlOrRef?: string) {
  if (fbcCookie) return fbcCookie || undefined;
  const src = urlOrRef || "";
  const match = src.match(/[?&]fbclid=([^&#]+)/);
  if (!match?.[1]) return undefined;
  const ts = Math.floor(Date.now() / 1000);
  return `fb.1.${ts}.${match[1]}`;
}

async function postWithRetry(url: string, body: unknown, maxRetries = 2) {
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status >= 500 || res.status === 429) {
        attempt += 1;
        if (attempt > maxRetries) return res;
        const wait = attempt === 1 ? 1000 : 3000;
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }

      return res;
    } catch (error) {
      lastErr = error;
      attempt += 1;
      if (attempt > maxRetries) throw lastErr;
      const wait = attempt === 1 ? 1000 : 3000;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("request failed");
}

export async function POST(request: NextRequest) {
  let config: MetaAnalyticsConfig;
  try {
    config =
      await sanityClient.fetch<MetaAnalyticsConfig>(META_ANALYTICS_QUERY);
  } catch (error) {
    console.error(
      "[Meta CAPI] Failed to load analytics config from Sanity",
      error,
    );
    return NextResponse.json(
      { success: false, message: "Meta not configured" },
      { status: 500 },
    );
  }

  const pixelId = config.metaPixelId;
  const accessToken = config.metaConversionToken;

  if (!pixelId || !accessToken) {
    console.error("[Meta CAPI] Missing Meta Pixel configuration in Sanity");
    return NextResponse.json(
      { success: false, message: "Meta not configured" },
      { status: 400 },
    );
  }

  let body: MetaRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (!body?.event_name) {
    return NextResponse.json(
      { success: false, message: "event_name is required" },
      { status: 400 },
    );
  }

  const consentRaw = getCookie(request.headers, "cookie-consent");
  let conversion_api = "denied";
  let advanced_matching = "denied";

  if (consentRaw) {
    try {
      const parsed = JSON.parse(consentRaw) as {
        conversion_api?: string;
        advanced_matching?: string;
      };
      conversion_api = parsed.conversion_api ?? "denied";
      advanced_matching = parsed.advanced_matching ?? "denied";
    } catch (error) {
      console.warn("[Meta CAPI] Unable to parse consent cookie", error);
    }
  }

  if (conversion_api !== "granted") {
    return NextResponse.json(
      { success: false, message: "Conversion API not permitted by user" },
      { status: 403 },
    );
  }

  const forwardedIp = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const realIp = request.headers.get("x-real-ip") || undefined;
  const ip =
    forwardedIp ||
    realIp ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  const ua = request.headers.get("user-agent") || undefined;
  const referer = request.headers.get("referer") || undefined;
  const fbp = getCookie(request.headers, "_fbp") || undefined;
  const fbc = computeFbc(
    getCookie(request.headers, "_fbc"),
    body.url || referer,
  );

  const event_time =
    typeof body.event_time === "number"
      ? body.event_time
      : Math.floor(Date.now() / 1000);
  const event_id = body.event_id || randomUUID();
  const event_source_url = body.url || referer;

  const user_data: Record<string, string | string[] | undefined> = {};
  if (ip) user_data.client_ip_address = ip;
  if (ua) user_data.client_user_agent = ua;

  if (advanced_matching === "granted") {
    const em = body.user?.email?.trim().toLowerCase();
    const ph = phoneToE164(body.user?.phone);
    const fn = body.user?.first_name?.trim().toLowerCase();
    const ln = body.user?.last_name?.trim().toLowerCase();
    const xid = body.user?.external_id?.toString().trim().toLowerCase();
    const zip = body.user?.postal_code?.trim().toLowerCase();
    const ct = body.user?.city?.trim().toLowerCase();
    const country = body.user?.country_code?.trim().toLowerCase();

    const hashedEmail = sha256(em);
    if (hashedEmail) user_data.em = [hashedEmail];

    const hashedPhone = sha256(ph);
    if (hashedPhone) user_data.ph = [hashedPhone];

    const hashedFirstName = sha256(fn);
    if (hashedFirstName) user_data.fn = [hashedFirstName];

    const hashedLastName = sha256(ln);
    if (hashedLastName) user_data.ln = [hashedLastName];

    const hashedExternalId = sha256(xid);
    if (hashedExternalId) user_data.external_id = [hashedExternalId];

    const hashedZip = sha256(zip);
    if (hashedZip) user_data.zip = [hashedZip];

    const hashedCity = sha256(ct);
    if (hashedCity) user_data.ct = [hashedCity];

    const hashedCountry = sha256(country);
    if (hashedCountry) user_data.country = [hashedCountry];

    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;
  }

  const data = {
    event_name: body.event_name,
    event_time,
    event_id,
    action_source: "website" as const,
    user_data,
    ...(event_source_url && { event_source_url }),
    ...(body.content_name && { content_name: body.content_name }),
    ...(body.custom_event_params && { custom_data: body.custom_event_params }),
  };

  console.info("[Meta CAPI] Event dispatched", {
    event_name: data.event_name,
    event_id: data.event_id,
    event_source_url: data.event_source_url,
    utm: body.utm,
    user_data_flags: {
      email: Boolean(body.user?.email),
      phone: Boolean(body.user?.phone),
      location: Boolean(body.user?.city || body.user?.postal_code),
    },
  });

  const url = `https://graph.facebook.com/v23.0/${encodeURIComponent(
    pixelId,
  )}/events?access_token=${encodeURIComponent(accessToken)}`;

  try {
    const res = await postWithRetry(url, {
      data: [data],
      ...(IS_DEVELOPMENT && { test_event_code: "TEST12345" }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[Meta CAPI] Error response", json);
      return NextResponse.json(
        { success: false, message: "Meta API error" },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true, event_id }, { status: 200 });
  } catch (error) {
    console.error("[Meta CAPI] Request failed", error);
    return NextResponse.json(
      { success: false, message: "Request failed" },
      { status: 500 },
    );
  }
}
