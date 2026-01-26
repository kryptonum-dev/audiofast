import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logError, logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryProductPdfBySlugAndKey } from '@/src/global/sanity/query';
import type { QueryProductPdfBySlugAndKeyResult } from '@/src/global/sanity/sanity.types';

type RouteParams = {
  params: Promise<{ slug: string; pdfKey: string }>;
};

export async function GET(request: NextRequest, props: RouteParams) {
  const { slug: slugParam, pdfKey } = await props.params;

  // Construct the full product slug as stored in Sanity
  const fullSlug = `/produkty/${slugParam.toLowerCase()}/`;

  try {
    // Fetch PDF data from Sanity using product slug and PDF key
    const pdfData = await sanityFetch<QueryProductPdfBySlugAndKeyResult>({
      query: queryProductPdfBySlugAndKey,
      params: { slug: fullSlug, pdfKey },
      tags: ['product'],
    });

    if (!pdfData || !pdfData.fileUrl) {
      logWarn(`PDF not found for product: ${fullSlug}, key: ${pdfKey}`);
      return new NextResponse('PDF not found', { status: 404 });
    }

    // Fetch the PDF from Sanity CDN
    const pdfResponse = await fetch(pdfData.fileUrl);

    if (!pdfResponse.ok) {
      logError(`Failed to fetch PDF from Sanity CDN: ${pdfData.fileUrl}`);
      return new NextResponse('Failed to fetch PDF', { status: 500 });
    }

    // Get the PDF buffer
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Prepare filename for Content-Disposition header
    // HTTP headers only support ASCII, so we need RFC 5987 encoding for UTF-8 filenames
    const originalFileName = pdfData.fileName || 'document.pdf';
    // Create ASCII-safe fallback by removing non-ASCII characters
    const asciiFileName = originalFileName.replace(/[^\x20-\x7E]/g, '_');
    // RFC 5987 encoded version for UTF-8 support
    const encodedFileName = encodeURIComponent(originalFileName);

    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': pdfData.mimeType || 'application/pdf',
        'Content-Disposition': `inline; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': String(pdfBuffer.byteLength),
        // Long cache - PDFs don't change
        'Cache-Control': 'public, max-age=31536000, immutable',
        // SEO: Tell search engines not to index this PDF URL
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    logError(
      `Error serving PDF for product ${fullSlug}, key ${pdfKey}:`,
      error,
    );
    return new NextResponse('Internal server error', { status: 500 });
  }
}
