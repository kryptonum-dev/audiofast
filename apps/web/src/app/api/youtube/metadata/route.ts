import { parseYouTubeUrl } from '@workspace/youtube';
import { type NextRequest, NextResponse } from 'next/server';

import {
  getNewsletterCorsHeaders,
  isNewsletterOriginAllowed,
  validateNewsletterRequest,
} from '@/src/global/sanity/operator-auth';
import { fetchYouTubeMetadata } from '@/src/global/youtube/metadata';

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: origin && !isNewsletterOriginAllowed(origin) ? 403 : 204,
    headers: getNewsletterCorsHeaders(req),
  });
}

export async function POST(req: NextRequest) {
  const authError = await validateNewsletterRequest(req);
  if (authError) return authError;
  const headers = getNewsletterCorsHeaders(req);
  let url: unknown;
  try {
    ({ url } = await req.json());
  } catch {
    /* Handled as invalid input. */
  }
  if (typeof url !== 'string' || !parseYouTubeUrl(url)) {
    return NextResponse.json(
      { error: 'Podaj poprawny link do filmu YouTube.' },
      { status: 400, headers },
    );
  }
  const metadata = await fetchYouTubeMetadata(url);
  return NextResponse.json(metadata, { headers });
}
