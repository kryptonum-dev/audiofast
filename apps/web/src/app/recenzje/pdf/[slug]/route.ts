import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logError, logWarn } from '@/src/global/logger';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryPdfReviewBySlug } from '@/src/global/sanity/query';
import type { QueryPdfReviewBySlugResult } from '@/src/global/sanity/sanity.types';

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, props: RouteParams) {
  const { slug } = await props.params;

  try {
    // Fetch PDF review data from Sanity
    // The slug is just the filename without extension (e.g., "test-produktu")
    const pdfReview = await sanityFetch<QueryPdfReviewBySlugResult>({
      query: queryPdfReviewBySlug,
      params: { slug: slug.toLowerCase() },
      tags: ['review'],
    });

    if (!pdfReview || !pdfReview.pdfUrl) {
      logWarn(`PDF review not found for slug: ${slug}`);
      return new NextResponse('PDF not found', { status: 404 });
    }

    // Fetch the PDF from Sanity CDN
    const pdfResponse = await fetch(pdfReview.pdfUrl);

    if (!pdfResponse.ok) {
      logError(`Failed to fetch PDF from Sanity CDN: ${pdfReview.pdfUrl}`);
      return new NextResponse('Failed to fetch PDF', { status: 500 });
    }

    // Get the PDF buffer
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': pdfReview.pdfMimeType || 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfReview.pdfFilename || 'review.pdf'}"`,
        'Content-Length': String(pdfBuffer.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    logError(`Error serving PDF for slug ${slug}:`, error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
