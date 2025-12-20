/**
 * Product Transformer
 *
 * Transforms product source data (from CSV) into Sanity product documents.
 * Handles:
 * - Main product fields (name, slug, subtitle, etc.)
 * - Image processing (main image, gallery)
 * - Content transformation (HTML → Portable Text)
 * - Reference resolution (brand, categories, reviews)
 */

import type { SanityClient } from "@sanity/client";

import {
  createHorizontalLine,
  createInlineImageBlock,
  createMinimalImageBlock,
  createVimeoBlock,
  createYoutubeBlock,
  extractVimeoId,
  extractYouTubeId,
  htmlToPortableText,
  type ImagePlaceholder,
  type ReviewEmbedPlaceholder,
} from "../parser/html-to-portable-text";
import { parseTechnicalData } from "../parser/technical-data-parser";
import type {
  ContentBlockText,
  DetailsContentBlock,
  ImageCache,
  PortableTextBlock,
  PortableTextContent,
  ProductBoxRow,
  ProductGalleryRow,
  ProductSourceData,
  PtReviewEmbed,
  SanityImageRef,
  SanityProduct,
  SanityReference,
} from "../types";
import {
  getLegacyAssetUrl,
  processAndUploadImage,
  processImageDryRun,
} from "../utils/image-optimizer";
import {
  loadLegacyReviewIdMappings,
  resolveBrandReference,
  resolveCategoryReferences,
  resolveReviewByLegacyId,
  resolveReviewReferences,
} from "./reference-resolver";

// ============================================================================
// Helpers
// ============================================================================

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ============================================================================
// Main Image Transformation
// ============================================================================

async function transformMainImage(
  mainImageFilename: string | null,
  client: SanityClient | null,
  imageCache: ImageCache,
  dryRun: boolean,
): Promise<SanityImageRef | undefined> {
  if (!mainImageFilename) {
    return undefined;
  }

  const imageUrl = getLegacyAssetUrl(mainImageFilename);

  if (dryRun) {
    const result = processImageDryRun(imageUrl);
    return {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: result.assetId,
      },
    };
  }

  if (!client) return undefined;

  const result = await processAndUploadImage(imageUrl, client, imageCache, {
    imageType: "preview",
  });

  if (!result) return undefined;

  return {
    _type: "image",
    asset: {
      _type: "reference",
      _ref: result.assetId,
    },
  };
}

// ============================================================================
// Gallery Image Transformation
// ============================================================================

async function transformGalleryImages(
  galleryRows: ProductGalleryRow[],
  client: SanityClient | null,
  imageCache: ImageCache,
  dryRun: boolean,
): Promise<SanityImageRef[]> {
  if (galleryRows.length === 0) {
    return [];
  }

  const galleryImages: SanityImageRef[] = [];

  for (const row of galleryRows) {
    if (!row.ImageFilename) continue;

    const imageUrl = getLegacyAssetUrl(row.ImageFilename);

    if (dryRun) {
      const result = processImageDryRun(imageUrl);
      galleryImages.push({
        _type: "image",
        _key: generateKey(),
        asset: {
          _type: "reference",
          _ref: result.assetId,
        },
      });
      continue;
    }

    if (!client) continue;

    const result = await processAndUploadImage(imageUrl, client, imageCache, {
      imageType: "gallery",
    });

    if (result) {
      galleryImages.push({
        _type: "image",
        _key: generateKey(),
        asset: {
          _type: "reference",
          _ref: result.assetId,
        },
      });
    }
  }

  return galleryImages;
}

// ============================================================================
// Content Box Transformation
// ============================================================================

/**
 * Create a contentBlockText wrapper for portable text content
 */
function createContentBlockText(
  content: PortableTextContent[],
): ContentBlockText {
  return {
    _type: "contentBlockText",
    _key: generateKey(),
    content,
  };
}

async function transformContentBoxes(
  boxes: ProductBoxRow[],
  client: SanityClient | null,
  imageCache: ImageCache,
  dryRun: boolean,
): Promise<DetailsContentBlock[]> {
  const contentBlocks: DetailsContentBlock[] = [];

  for (const box of boxes) {
    const boxType = box.BoxType?.toLowerCase();

    switch (boxType) {
      case "text": {
        // Parse HTML content to Portable Text
        if (box.BoxContent) {
          const parsed = htmlToPortableText(box.BoxContent);
          const portableTextContent: PortableTextContent[] = [];

          // Process parsed content and handle placeholders (images, review embeds)
          for (const block of parsed) {
            if (block._type === "imagePlaceholder") {
              const placeholder = block as ImagePlaceholder;

              // Determine image type based on whether it's inline (floating)
              const isInlineImage = !!placeholder.float;
              const imageType = isInlineImage ? "inline" : "content";

              if (dryRun) {
                const result = processImageDryRun(placeholder.src);
                // Check if image should be inline (floating) or regular block
                if (placeholder.float) {
                  const widthStr = placeholder.width
                    ? ` w=${placeholder.width}px`
                    : "";
                  console.log(
                    `   🖼️  Inline image (float: ${placeholder.float}${widthStr}): ${placeholder.src.split("/").pop()}`,
                  );
                  portableTextContent.push(
                    createInlineImageBlock(
                      result.assetId,
                      placeholder.float,
                      placeholder.alt,
                      placeholder.width,
                    ),
                  );
                } else {
                  portableTextContent.push(
                    createMinimalImageBlock(result.assetId),
                  );
                }
              } else if (client) {
                const result = await processAndUploadImage(
                  placeholder.src,
                  client,
                  imageCache,
                  { imageType },
                );
                if (result) {
                  // Check if image should be inline (floating) or regular block
                  if (placeholder.float) {
                    const widthStr = placeholder.width
                      ? ` w=${placeholder.width}px`
                      : "";
                    console.log(
                      `   🖼️  Inline image (float: ${placeholder.float}${widthStr}): ${result.filename}`,
                    );
                    portableTextContent.push(
                      createInlineImageBlock(
                        result.assetId,
                        placeholder.float,
                        placeholder.alt,
                        placeholder.width,
                      ),
                    );
                  } else {
                    portableTextContent.push(
                      createMinimalImageBlock(result.assetId),
                    );
                  }
                }
              }
            } else if (
              block._type === "ptReviewEmbed" &&
              "legacyReviewId" in block
            ) {
              // Resolve legacy review ID to Sanity reference
              const placeholder = block as unknown as ReviewEmbedPlaceholder;
              const reviewRef = resolveReviewByLegacyId(
                placeholder.legacyReviewId,
              );

              if (reviewRef) {
                console.log(
                  `   📰 Resolved review embed: legacy ID ${placeholder.legacyReviewId} → ${reviewRef._ref}`,
                );
                portableTextContent.push({
                  _type: "ptReviewEmbed",
                  _key: placeholder._key,
                  review: reviewRef,
                } as PtReviewEmbed);
              } else {
                console.warn(
                  `   ⚠️  Could not resolve review embed: legacy ID ${placeholder.legacyReviewId}`,
                );
              }
            } else {
              portableTextContent.push(block as PortableTextContent);
            }
          }

          // Wrap all text content in a contentBlockText block
          if (portableTextContent.length > 0) {
            contentBlocks.push(createContentBlockText(portableTextContent));
          }
        }
        break;
      }

      case "hr": {
        contentBlocks.push(createHorizontalLine());
        break;
      }

      case "video": {
        if (box.YoutubeId) {
          // YoutubeId is now directly provided in the CSV
          contentBlocks.push(createYoutubeBlock(box.YoutubeId));
        }
        break;
      }

      default:
        // Skip unknown box types
        if (boxType) {
          console.warn(`   ⚠️  Unknown box type: ${boxType}`);
        }
    }
  }

  return contentBlocks;
}

// ============================================================================
// Main Transformer
// ============================================================================

export interface TransformOptions {
  dryRun: boolean;
  client: SanityClient | null;
  imageCache: ImageCache;
  verbose?: boolean;
}

/**
 * Transform a product from source data to Sanity document
 */
export async function transformProduct(
  source: ProductSourceData,
  options: TransformOptions,
): Promise<SanityProduct> {
  const { dryRun, client, imageCache, verbose } = options;

  if (verbose) {
    console.log(`\n   🔄 Transforming: ${source.name}`);
  }

  // 1. Basic fields
  const product: SanityProduct = {
    _id: `product-${source.id}`,
    _type: "product",
    name: source.name,
    slug: {
      _type: "slug",
      current: `/produkty/${source.slug.toLowerCase()}/`,
    },
    isArchived: source.isArchived,
    isCPO: false, // Always false for migrated products
    doNotIndex: false,
    hideFromList: source.isHidden,
  };

  // 2. Optional subtitle
  if (source.subtitle) {
    product.subtitle = source.subtitle;
  }

  // 3. Main preview image
  if (verbose) console.log("   📷 Processing main image...");
  const previewImage = await transformMainImage(
    source.mainImageFilename,
    client,
    imageCache,
    dryRun,
  );
  if (previewImage) {
    product.previewImage = previewImage;
  } else if (source.mainImageFilename) {
    // Image filename exists but failed to process - warn about it
    console.warn(
      `   ⚠️  MISSING PREVIEW IMAGE for [${source.id}] ${source.name}`,
    );
    console.warn(`      Source: ${source.mainImageFilename}`);
  }

  // 4. Gallery images
  if (source.galleryImages.length > 0) {
    if (verbose)
      console.log(
        `   🖼️  Processing ${source.galleryImages.length} gallery images...`,
      );
    const galleryImages = await transformGalleryImages(
      source.galleryImages,
      client,
      imageCache,
      dryRun,
    );
    if (galleryImages.length > 0) {
      product.imageGallery = galleryImages;
    }
  }

  // 4b. Article data (shortDescription and publicationImage)
  if (source.articleData) {
    if (verbose) console.log("   📰 Processing article data...");

    // Parse ShortDescription HTML to Portable Text
    if (source.articleData.ShortDescription) {
      const descriptionBlocks = htmlToPortableText(
        source.articleData.ShortDescription,
      );
      // Extract only PortableTextBlock items (not images, videos, etc.)
      const textBlocks = descriptionBlocks.filter(
        (block): block is PortableTextBlock => block._type === "block",
      );
      if (textBlocks.length > 0) {
        product.shortDescription = textBlocks;
        if (verbose) console.log(`   ✓ Short description: ${textBlocks.length} blocks`);
      }
    }

    // Upload PublicationImage
    if (source.articleData.PublicationImageFilename) {
      const publicationImage = await transformMainImage(
        source.articleData.PublicationImageFilename,
        client,
        imageCache,
        dryRun,
      );
      if (publicationImage) {
        product.publicationImage = publicationImage;
        if (verbose) console.log("   ✓ Publication image uploaded");
      }
    }
  }

  // 5. Brand reference
  const brandRef = resolveBrandReference(source.brandSlug);
  if (brandRef) {
    product.brand = brandRef;
  }

  // 6. Category references
  if (source.categorySlugsByProduct.length > 0) {
    const categoryRefs = resolveCategoryReferences(
      source.categorySlugsByProduct,
    );
    if (categoryRefs.length > 0) {
      product.categories = categoryRefs;
    }
  }

  // 7. Custom filter values (empty for migration)
  product.customFilterValues = [];

  // 8. Details content
  if (source.contentBoxes.length > 0) {
    if (verbose)
      console.log(
        `   📝 Processing ${source.contentBoxes.length} content boxes...`,
      );
    const detailsContent = await transformContentBoxes(
      source.contentBoxes,
      client,
      imageCache,
      dryRun,
    );
    if (detailsContent.length > 0) {
      product.details = {
        content: detailsContent,
      };
    }
  }

  // 9. Technical data
  if (source.technicalDataRows.length > 0) {
    if (verbose)
      console.log(
        `   📊 Processing ${source.technicalDataRows.length} technical data tabs...`,
      );
    const technicalData = parseTechnicalData(source.technicalDataRows);
    if (
      technicalData &&
      technicalData.groups &&
      technicalData.groups.length > 0
    ) {
      product.technicalData = technicalData;
      if (verbose) {
        const totalRows = technicalData.groups.reduce(
          (sum, g) => sum + g.rows.length,
          0,
        );
        console.log(
          `   ✓ Technical data: ${technicalData.groups.length} groups, ${totalRows} rows`,
        );
        if (technicalData.variants && technicalData.variants.length > 0) {
          console.log(`   ✓ Variants: ${technicalData.variants.join(", ")}`);
        }
      }
    }
  }

  // 10. Review references (supports page, PDF, and external review types)
  if (source.reviewRows.length > 0) {
    const reviewRefs: SanityReference[] = [];

    for (const row of source.reviewRows) {
      // Try to resolve by slug first (page-type reviews) - silent mode since we have ID fallback
      const refsBySlug = resolveReviewReferences([row.ReviewSlug], {
        silent: true,
      });

      if (refsBySlug.length > 0) {
        reviewRefs.push(refsBySlug[0]);
      } else {
        // Fallback to legacy ID lookup (PDF/external reviews)
        const refByLegacyId = resolveReviewByLegacyId(row.ReviewID);
        if (refByLegacyId) {
          reviewRefs.push({
            ...refByLegacyId,
            _key: generateKey(),
          });
        } else {
          console.warn(
            `   ⚠️  Review not found: ID=${row.ReviewID}, slug=${row.ReviewSlug}`,
          );
        }
      }
    }

    if (reviewRefs.length > 0) {
      product.reviews = reviewRefs;
    }
  }

  // 11. Page builder (empty for migration)
  product.pageBuilder = [];

  // 12. SEO (title only, description empty)
  product.seo = {
    title: source.name,
    description: "", // Intentionally empty per migration plan
  };

  return product;
}

/**
 * Validate a transformed product
 */
export function validateProduct(product: SanityProduct): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!product.name) {
    errors.push("Missing required field: name");
  }
  if (!product.slug?.current) {
    errors.push("Missing required field: slug");
  }

  // Recommended fields
  if (!product.previewImage) {
    warnings.push("No preview image set");
  }
  if (!product.brand) {
    warnings.push("No brand reference");
  }
  if (!product.categories || product.categories.length === 0) {
    warnings.push("No category references");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get a summary of the transformed product
 */
export function getProductSummary(product: SanityProduct): string {
  const techDataGroups = product.technicalData?.groups?.length || 0;
  const techDataRows =
    product.technicalData?.groups?.reduce((sum, g) => sum + g.rows.length, 0) ||
    0;
  const techDataVariants = product.technicalData?.variants?.length || 0;

  const parts = [
    `ID: ${product._id}`,
    `Name: ${product.name}`,
    `Slug: ${product.slug.current}`,
    `Preview: ${product.previewImage ? "✓" : "✗"}`,
    `Gallery: ${product.imageGallery?.length || 0}`,
    `ShortDesc: ${product.shortDescription ? "✓" : "✗"}`,
    `PubImg: ${product.publicationImage ? "✓" : "✗"}`,
    `Brand: ${product.brand ? "✓" : "✗"}`,
    `Categories: ${product.categories?.length || 0}`,
    `Content blocks: ${product.details?.content?.length || 0}`,
    `Tech data: ${techDataGroups}g/${techDataRows}r${techDataVariants > 0 ? `/${techDataVariants}v` : ""}`,
    `Reviews: ${product.reviews?.length || 0}`,
  ];
  return parts.join(" | ");
}
