import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { logError, logWarn } from "@/src/global/logger";
import { sanityFetch } from "@/src/global/sanity/fetch";
import { queryPdfReviewBySlug } from "@/src/global/sanity/query";
import type { QueryPdfReviewBySlugResult } from "@/src/global/sanity/sanity.types";

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, props: RouteParams) {
  const { slug: slugParam } = await props.params;

  // Construct the full slug as stored in Sanity (e.g., "/recenzje/pdf/test-produktu/")
  const fullSlug = `/recenzje/pdf/${slugParam.toLowerCase()}/`;

  try {
    // Fetch PDF review data from Sanity using the full slug
    const pdfReview = await sanityFetch<QueryPdfReviewBySlugResult>({
      query: queryPdfReviewBySlug,
      params: { slug: fullSlug },
      tags: ["review"],
    });

    if (!pdfReview || !pdfReview.pdfUrl) {
      logWarn(`PDF review not found for slug: ${fullSlug}`);
      return new NextResponse("PDF not found", { status: 404 });
    }

    // Fetch the PDF from Sanity CDN
    const pdfResponse = await fetch(pdfReview.pdfUrl);

    if (!pdfResponse.ok) {
      logError(`Failed to fetch PDF from Sanity CDN: ${pdfReview.pdfUrl}`);
      return new NextResponse("Failed to fetch PDF", { status: 500 });
    }

    // Get the PDF buffer
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Prepare filename for Content-Disposition header
    // HTTP headers only support ASCII, so we need RFC 5987 encoding for UTF-8 filenames
    const originalFileName = pdfReview.pdfFilename || "review.pdf";
    // Create ASCII-safe fallback by removing non-ASCII characters
    const asciiFileName = originalFileName.replace(/[^\x20-\x7E]/g, "_");
    // RFC 5987 encoded version for UTF-8 support
    const encodedFileName = encodeURIComponent(originalFileName);

    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": pdfReview.pdfMimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        // SEO: Tell search engines not to index this PDF URL
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    logError(`Error serving PDF for slug ${fullSlug}:`, error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
