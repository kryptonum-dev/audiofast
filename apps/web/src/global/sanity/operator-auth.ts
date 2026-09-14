import { createClient, type CurrentSanityUser } from '@sanity/client';
import { type NextRequest, NextResponse } from 'next/server';

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNewsletterAllowedOrigins(): string[] {
  const configuredOrigins = parseCsvEnv(
    process.env.NEWSLETTER_GENERATE_ALLOWED_ORIGINS,
  );
  const sanityStudioUrl = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL?.trim();
  const localStudioOrigins =
    process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:3333', 'http://127.0.0.1:3333'];

  return Array.from(
    new Set([
      ...configuredOrigins,
      ...(sanityStudioUrl ? [sanityStudioUrl] : []),
      ...localStudioOrigins,
    ]),
  );
}

export function isNewsletterOriginAllowed(origin: string): boolean {
  return getNewsletterAllowedOrigins().includes(origin);
}

export function getNewsletterCorsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get('origin');

  if (!origin || !isNewsletterOriginAllowed(origin)) {
    return {
      Vary: 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}

function getBearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function getNewsletterOperatorAllowlist(): {
  emails: string[];
  userIds: string[];
} {
  return {
    emails: parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_EMAILS).map((email) =>
      email.toLowerCase(),
    ),
    userIds: parseCsvEnv(process.env.B2C_ADMIN_ALLOWED_USER_IDS),
  };
}

function isNewsletterOperatorAllowlisted(user: CurrentSanityUser): boolean {
  const allowlist = getNewsletterOperatorAllowlist();

  return (
    allowlist.emails.includes(user.email.toLowerCase()) ||
    allowlist.userIds.includes(user.id)
  );
}

function hasNewsletterOperatorAllowlist(): boolean {
  const allowlist = getNewsletterOperatorAllowlist();

  return allowlist.emails.length > 0 || allowlist.userIds.length > 0;
}

async function verifyNewsletterOperatorToken(token: string): Promise<boolean> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION;

  if (!projectId || !dataset || !apiVersion) {
    throw new Error('Newsletter Sanity auth configuration is missing.');
  }

  const sanityClient = createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
  });
  const user = await sanityClient.users.getById('me');

  return isNewsletterOperatorAllowlisted(user);
}

export async function validateNewsletterRequest(
  req: NextRequest,
): Promise<NextResponse | null> {
  const origin = req.headers.get('origin');
  const corsHeaders = getNewsletterCorsHeaders(req);

  if (origin && !isNewsletterOriginAllowed(origin)) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403, headers: corsHeaders },
    );
  }

  if (!hasNewsletterOperatorAllowlist()) {
    console.error(
      '[Newsletter API] Missing B2C admin operator allowlist for newsletter generation.',
    );
    return NextResponse.json(
      { error: 'Newsletter operator allowlist is not configured' },
      { status: 500, headers: corsHeaders },
    );
  }

  const token = getBearerToken(req);

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    const isAllowed = await verifyNewsletterOperatorToken(token);

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Operator not allowed' },
        { status: 403, headers: corsHeaders },
      );
    }

    return null;
  } catch (error) {
    console.error('[Newsletter API] Failed to verify Sanity operator.', error);

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders },
    );
  }
}
