/**
 * Review Transformer
 *
 * Transforms CSV review rows into Sanity review documents
 */

import type { SanityClient } from "@sanity/client";
import slugify from "slugify";

import { htmlToPortableText } from "../parser/html-to-portable-text";
import type {
  ImagePlaceholder,
  PortableTextBlock,
  PtImage,
  ReviewCsvRow,
  ReviewPortableTextContent,
  SanityReviewDocument,
} from "../types";
import { uploadCoverImage, uploadInlineImage, uploadPdfFile } from "../utils/asset-uploader";
import { cleanString, parseReviewType } from "../utils/csv-parser";
import { resolveAuthorReference } from "./author-resolver";

// Slug prefixes
const PAGE_SLUG_PREFIX = "/recenzje/";
const PDF_SLUG_PREFIX = "/recenzje/pdf/";

// ============================================================================
// Helpers
// ============================================================================

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Create Portable Text block from plain string (for title/description)
 */
function createPortableTextFromString(
  text: string,
  style: "normal" | "h2" | "h3" = "normal",
): PortableTextBlock[] {
  const clean = cleanString(text);
  if (!clean) return [];

  return [
    {
      _type: "block",
      _key: generateKey(),
      style,
      markDefs: [],
      children: [
        {
          _type: "span",
          _key: generateKey(),
          text: clean,
        },
      ],
    },
  ];
}

/**
 * Build slug for page-type reviews
 */
function buildPageSlug(slug: string | null, fallbackTitle: string): string | null {
  let slugSource = cleanString(slug);

  if (!slugSource) {
    const fallback = cleanString(fallbackTitle);
    if (!fallback) return null;
    slugSource = slugify(fallback, { lower: true, strict: true, trim: true });
  }

  // Remove any existing prefix
  slugSource = slugSource
    .replace(/^\/recenzje\/pdf\//, "")
    .replace(/^\/recenzje\//, "")
    .replace(/^\/pl\//, "")
    .replace(/^\//, "")
    .replace(/\/$/, "");

  // Build full slug with prefix
  const fullSlug = `${PAGE_SLUG_PREFIX}${slugSource}/`;
  return fullSlug.toLowerCase();
}

/**
 * Build slug for PDF-type reviews
 */
function buildPdfSlug(slug: string | null, fallbackTitle: string): string | null {
  let slugSource = cleanString(slug);

  if (!slugSource) {
    const fallback = cleanString(fallbackTitle);
    if (!fallback) return null;
    slugSource = slugify(fallback, { lower: true, strict: true, trim: true });
  }

  // Remove any existing prefix
  slugSource = slugSource
    .replace(/^\/recenzje\/pdf\//, "")
    .replace(/^\/recenzje\//, "")
    .replace(/^\/pl\//, "")
    .replace(/^\//, "")
    .replace(/\/$/, "");

  // Build full slug with prefix
  const fullSlug = `${PDF_SLUG_PREFIX}${slugSource}/`;
  return fullSlug.toLowerCase();
}

/**
 * Truncate text for SEO description
 */
function truncateText(value: string, max = 130): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform a CSV row into a Sanity review document
 */
export async function transformReview(
  row: ReviewCsvRow,
  client: SanityClient | null,
  dryRun: boolean,
  verbose: boolean = false,
): Promise<SanityReviewDocument | null> {
  const id = parseInt(row.ID, 10);
  if (!id || isNaN(id)) {
    console.warn(`   ⚠️  Skipping row without numeric ID: ${row.ID}`);
    return null;
  }

  const sanityId = `review-${id}`;
  const destinationType = parseReviewType(row.ReviewType);

  // Get title
  const titleSource =
    cleanString(row.PageTitle) || cleanString(row.MenuTitle) || `Review ${id}`;
  const titleBlocks = createPortableTextFromString(titleSource);

  if (titleBlocks.length === 0) {
    console.warn(`   ⚠️  Review ${id} has no title, skipping`);
    return null;
  }

  // Resolve author (optional - skip if "Unknown" or not found)
  const authorName = cleanString(row.AuthorName);
  const authorRef = authorName && authorName.toLowerCase() !== "unknown"
    ? resolveAuthorReference(row.AuthorName)
    : null;

  if (!authorRef && authorName && authorName.toLowerCase() !== "unknown") {
    console.warn(`   ⚠️  Review ${id} has unrecognized author "${row.AuthorName}", will migrate without author`);
  }

  // Upload cover image
  const coverAssetId = await uploadCoverImage(
    client,
    row.CoverFilename,
    dryRun,
  );

  if (!coverAssetId) {
    console.warn(`   ⚠️  Review ${id} has no cover image, skipping`);
    return null;
  }

  // Parse date
  const articleDate = cleanString(row.ArticleDate);
  const parsedDate = articleDate ? new Date(articleDate) : null;

  // Build base document
  const document: SanityReviewDocument = {
    _id: sanityId,
    _type: "review",
    ...(authorRef && { author: authorRef }),
    destinationType,
    publishedDate:
      parsedDate && !Number.isNaN(parsedDate.valueOf())
        ? parsedDate.toISOString()
        : undefined,
    title: titleBlocks,
    image: {
      _type: "image",
      asset: { _type: "reference", _ref: coverAssetId },
    },
  };

  // Handle type-specific fields
  if (destinationType === "page") {
    // Build slug
    const slug = buildPageSlug(row.Slug, titleSource);
    if (!slug) {
      console.warn(`   ⚠️  Review ${id} missing slug, skipping`);
      return null;
    }
    document.slug = { _type: "slug", current: slug };

    // Parse content
    const rawContent = htmlToPortableText(row.BoxContent);

    if (rawContent.length === 0) {
      console.warn(`   ⚠️  Review ${id} is a page but has empty content, skipping`);
      return null;
    }

    // Process image placeholders → upload and convert to ptImage
    const finalContent: ReviewPortableTextContent[] = [];
    for (const block of rawContent) {
      if (block._type === "imagePlaceholder") {
        const placeholder = block as ImagePlaceholder;
        const assetId = await uploadInlineImage(client, placeholder.src, dryRun);

        if (assetId) {
          const ptImage: PtImage = {
            _type: "ptImage",
            _key: generateKey(),
            layout: "single",
            image: {
              _type: "image",
              asset: { _type: "reference", _ref: assetId },
            },
          };
          finalContent.push(ptImage);
        } else if (verbose) {
          console.warn(`   ⚠️  Failed to upload inline image: ${placeholder.src}`);
        }
      } else {
        finalContent.push(block as ReviewPortableTextContent);
      }
    }

    document.content = finalContent;

    // Set page-specific defaults
    document.overrideGallery = false;
    document.pageBuilder = [];

    // Build description from ArticlePage.LeadingText (row.Description), NOT BoxContent
    // Parse as Portable Text to preserve formatting (italic, bold, links)
    const rawDescription = cleanString(row.Description);
    if (rawDescription) {
      const descriptionBlocks = htmlToPortableText(rawDescription);
      if (descriptionBlocks.length > 0) {
        document.description = descriptionBlocks;
      }
    }

    // SEO fields
    document.seo = {
      title: titleSource,
      description: undefined, // Leave empty so it uses page description
      noIndex: false,
      hideFromList: false,
    };
  } else if (destinationType === "pdf") {
    // Build PDF slug
    const pdfSlug = buildPdfSlug(row.Slug, titleSource);
    if (!pdfSlug) {
      console.warn(`   ⚠️  Review ${id} missing PDF slug, skipping`);
      return null;
    }
    document.pdfSlug = { _type: "slug", current: pdfSlug };

    // Upload PDF file
    const pdfAssetId = await uploadPdfFile(client, row.PDFFilename, dryRun);
    if (!pdfAssetId) {
      console.warn(`   ⚠️  Review ${id} PDF file missing, skipping`);
      return null;
    }
    document.pdfFile = {
      _type: "file",
      asset: { _type: "reference", _ref: pdfAssetId },
    };

    // Build description from Description field - parse as Portable Text to preserve formatting
    const rawDescription = cleanString(row.Description);
    if (rawDescription) {
      const descriptionBlocks = htmlToPortableText(rawDescription);
      if (descriptionBlocks.length > 0) {
        document.description = descriptionBlocks;
      }
    }
  } else if (destinationType === "external") {
    // External link
    const externalUrl = cleanString(row.ExternalLink);
    if (!externalUrl) {
      console.warn(`   ⚠️  Review ${id} external link missing, skipping`);
      return null;
    }
    document.externalUrl = externalUrl;

    // Build description from Description field - parse as Portable Text to preserve formatting
    const rawDescription = cleanString(row.Description);
    if (rawDescription) {
      const descriptionBlocks = htmlToPortableText(rawDescription);
      if (descriptionBlocks.length > 0) {
        document.description = descriptionBlocks;
      }
    }
  }

  return document;
}

/**
 * Validate a review document before migration
 */
export function validateReviewDocument(
  doc: SanityReviewDocument,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!doc._id) {
    errors.push("Missing _id");
  }

  // Author is now optional - no validation needed

  if (!doc.title || doc.title.length === 0) {
    errors.push("Missing title");
  }

  if (!doc.image?.asset?._ref) {
    errors.push("Missing cover image");
  }

  if (doc.destinationType === "page") {
    if (!doc.slug?.current) {
      errors.push("Page type requires slug");
    }
    if (!doc.content || doc.content.length === 0) {
      errors.push("Page type requires content");
    }
  }

  if (doc.destinationType === "pdf") {
    if (!doc.pdfSlug?.current) {
      errors.push("PDF type requires pdfSlug");
    }
    if (!doc.pdfFile?.asset?._ref) {
      errors.push("PDF type requires pdfFile");
    }
  }

  if (doc.destinationType === "external") {
    if (!doc.externalUrl) {
      errors.push("External type requires externalUrl");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
