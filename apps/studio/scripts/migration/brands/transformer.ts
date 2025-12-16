/**
 * Brand Migration Transformer
 * Transforms SQL brand data into Sanity brand documents
 * Handles HTML to Portable Text conversion and logo upload
 */

import * as https from "node:https";
import { Readable } from "node:stream";

import { createClient, type SanityClient } from "@sanity/client";
import { v4 as uuidv4 } from "uuid";

import type {
  Brand,
  BrandSourceData,
  PortableTextBlock,
  PortableTextYouTubeBlock,
} from "./types";

// Custom HTTPS agent that bypasses SSL verification for legacy assets
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// PrimaLuna hero image reference - used as default for all brands
const PRIMALUNA_HERO_IMAGE_REF =
  "image-c19f5cd6588ad862e6597c9843b6d5f44b8cfe96-3494x1538-webp";

// Legacy assets base URL
const LEGACY_ASSETS_BASE_URL = "https://audiofast.pl/assets/";

/**
 * Generate a unique key for Portable Text blocks
 */
function generateKey(): string {
  return uuidv4().replace(/-/g, "").substring(0, 12);
}

/**
 * Strip HTML tags and convert to plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace &nbsp;
    .replace(/&amp;/g, "&") // Replace &amp;
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Convert plain text to a simple Portable Text block
 */
function textToPortableText(text: string): PortableTextBlock[] {
  if (!text) return [];

  return [
    {
      _key: generateKey(),
      _type: "block",
      children: [
        {
          _key: generateKey(),
          _type: "span",
          marks: [],
          text: text.trim(),
        },
      ],
      markDefs: [],
      style: "normal",
    },
  ];
}

/**
 * Create a YouTube video block for Portable Text
 */
function createYouTubeBlock(videoId: string): PortableTextYouTubeBlock {
  return {
    _key: generateKey(),
    _type: "ptYoutubeVideo",
    youtubeId: videoId,
  };
}

/**
 * Convert HTML to Portable Text blocks
 * Simplified version - converts paragraphs to blocks
 */
function htmlToPortableText(html: string | null): PortableTextBlock[] {
  if (!html) return [];

  // Extract paragraphs
  const paragraphs: string[] = [];
  // Use a workaround for dotAll flag - replace newlines with a placeholder
  const normalizedHtml = html.replace(/\n/g, "___NEWLINE___");
  const pRegex = /<p[^>]*>(.*?)<\/p>/g;
  let match;

  while ((match = pRegex.exec(normalizedHtml)) !== null) {
    const content = stripHtml(match[1].replace(/___NEWLINE___/g, "\n"));
    if (content) {
      paragraphs.push(content);
    }
  }

  // If no paragraphs found, treat whole content as one block
  if (paragraphs.length === 0) {
    const content = stripHtml(normalizedHtml.replace(/___NEWLINE___/g, "\n"));
    if (content) {
      paragraphs.push(content);
    }
  }

  return paragraphs.map((text) => ({
    _key: generateKey(),
    _type: "block" as const,
    children: [
      {
        _key: generateKey(),
        _type: "span" as const,
        marks: [],
        text,
      },
    ],
    markDefs: [],
    style: "normal",
  }));
}

/**
 * Generate SEO description for a brand (110-140 characters)
 */
function generateSeoDescription(
  brandName: string,
  motto: string | null,
  description: string | null,
): string {
  // Try to use motto first, then description
  const sourceText = motto || (description ? stripHtml(description) : "");

  if (sourceText) {
    // Truncate to 140 chars while keeping whole words
    if (sourceText.length <= 140) {
      // Pad if too short
      if (sourceText.length < 110) {
        return `${sourceText} Sprawdź ofertę ${brandName} w Audiofast.`.substring(
          0,
          140,
        );
      }
      return sourceText;
    }

    // Truncate at word boundary
    let truncated = sourceText.substring(0, 137);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 100) {
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated + "...";
  }

  // Default description
  return `Odkryj produkty marki ${brandName} w ofercie Audiofast. Sprzęt audio klasy high-end dla wymagających audiofilów.`;
}

/**
 * Generate SEO title for a brand
 */
function generateSeoTitle(brandName: string): string {
  const baseTitle = `${brandName} - Autoryzowany dystrybutor | Audiofast`;
  if (baseTitle.length <= 70) {
    return baseTitle;
  }
  return `${brandName} | Audiofast`;
}

/**
 * Fetch image with SSL verification disabled for legacy domains
 */
async function fetchImageInsecure(imageUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const url = new URL(imageUrl);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: "GET",
      agent: insecureAgent,
      headers: {
        "User-Agent": "Sanity-Migration-Script/1.0",
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.error(
          `Failed to fetch image: ${imageUrl} - Status: ${res.statusCode}`,
        );
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", (err) => {
        console.error(`Error reading response for ${imageUrl}:`, err);
        resolve(null);
      });
    });

    req.on("error", (err) => {
      console.error(`Error fetching image from ${imageUrl}:`, err);
      resolve(null);
    });

    req.end();
  });
}

/**
 * Upload image from URL to Sanity CDN
 */
async function uploadImageFromUrl(
  client: SanityClient,
  imageUrl: string,
  filename: string,
): Promise<string | null> {
  try {
    // Use custom insecure fetch for audiofast.pl
    const imageBuffer = await fetchImageInsecure(imageUrl);

    if (!imageBuffer || imageBuffer.length === 0) {
      console.error(`Failed to fetch image data from: ${imageUrl}`);
      return null;
    }

    // Create a readable stream from the buffer
    const readable = new Readable();
    readable.push(imageBuffer);
    readable.push(null);

    const asset = await client.assets.upload("image", readable, {
      filename,
      source: {
        id: imageUrl,
        name: "WordPress/SilverStripe",
        url: imageUrl,
      },
    });

    return asset._id;
  } catch (error) {
    console.error(`Error uploading image from ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Check if a logo already exists in Sanity by source URL
 */
async function findExistingLogo(
  client: SanityClient,
  sourceUrl: string,
): Promise<string | null> {
  try {
    const result = await client.fetch<{ _id: string } | null>(
      `*[_type == "sanity.imageAsset" && source.url == $url][0]{_id}`,
      { url: sourceUrl },
    );
    return result?._id || null;
  } catch (error) {
    console.error(`Error checking for existing logo:`, error);
    return null;
  }
}

/**
 * Transform a BrandSourceData into a Sanity Brand document
 */
export async function transformBrandToSanity(
  source: BrandSourceData,
  client: SanityClient,
  existingLogos: Map<string, string>,
): Promise<Brand | null> {
  const brandId = `brand-${source.id}`;

  // Prepare hero description from ProducerPage description (the short paragraph)
  // If no description, fall back to motto
  const heroDescription = source.description
    ? htmlToPortableText(source.description)
    : source.motto
      ? textToPortableText(source.motto)
      : textToPortableText(
          `Odkryj produkty marki ${source.name} w ofercie Audiofast.`,
        );

  // Prepare brand description heading from Box content if available
  // Otherwise default to "O {brandName}"
  const brandDescriptionHeading = source.boxContent?.descriptionTitle
    ? textToPortableText(source.boxContent.descriptionTitle)
    : textToPortableText(`O ${source.name}`);

  // Prepare detailed description from Box content if available
  // Append YouTube video block if available
  let brandDescriptionContent: (
    | PortableTextBlock
    | PortableTextYouTubeBlock
  )[] = [];

  if (source.boxContent?.descriptionContent) {
    brandDescriptionContent = htmlToPortableText(
      source.boxContent.descriptionContent,
    );
  } else if (source.description) {
    // Fallback to ProducerPage description
    brandDescriptionContent = htmlToPortableText(source.description);
  } else {
    brandDescriptionContent = textToPortableText(
      `${source.name} to renomowana marka oferująca sprzęt audio najwyższej klasy.`,
    );
  }

  // Append YouTube video if available from Box content
  if (source.boxContent?.youtubeVideoId) {
    brandDescriptionContent.push(
      createYouTubeBlock(source.boxContent.youtubeVideoId),
    );
    console.log(`  Adding YouTube video: ${source.boxContent.youtubeVideoId}`);
  }

  // Prepare SEO
  const seoTitle = generateSeoTitle(source.name);
  const seoDescription = generateSeoDescription(
    source.name,
    source.motto,
    source.boxContent?.descriptionContent || source.description,
  );

  // Upload or find logo
  let logoRef: string | null = null;

  if (source.logoFilename) {
    const logoUrl = `${LEGACY_ASSETS_BASE_URL}${source.logoFilename}`;

    // Check cache first
    if (existingLogos.has(logoUrl)) {
      logoRef = existingLogos.get(logoUrl)!;
      console.log(`  Using cached logo for ${source.name}`);
    } else {
      // Check if already uploaded
      logoRef = await findExistingLogo(client, logoUrl);

      if (logoRef) {
        console.log(`  Found existing logo in Sanity for ${source.name}`);
        existingLogos.set(logoUrl, logoRef);
      } else {
        // Upload new logo
        console.log(`  Uploading logo for ${source.name}...`);
        logoRef = await uploadImageFromUrl(
          client,
          logoUrl,
          source.logoFilename.split("/").pop() || "logo.png",
        );

        if (logoRef) {
          existingLogos.set(logoUrl, logoRef);
          console.log(`  Logo uploaded successfully for ${source.name}`);
        } else {
          console.warn(`  Failed to upload logo for ${source.name}`);
        }
      }
    }
  }

  // Upload banner image from Box content if available
  let bannerImageRef: string | null = null;
  if (source.boxContent?.bannerImageFilename) {
    const bannerUrl = `${LEGACY_ASSETS_BASE_URL}${source.boxContent.bannerImageFilename}`;

    // Check cache first
    if (existingLogos.has(bannerUrl)) {
      bannerImageRef = existingLogos.get(bannerUrl)!;
      console.log(`  Using cached banner image for ${source.name}`);
    } else {
      // Check if already uploaded
      bannerImageRef = await findExistingLogo(client, bannerUrl);

      if (bannerImageRef) {
        console.log(
          `  Found existing banner image in Sanity for ${source.name}`,
        );
        existingLogos.set(bannerUrl, bannerImageRef);
      } else {
        // Upload new banner image
        console.log(`  Uploading banner image for ${source.name}...`);
        bannerImageRef = await uploadImageFromUrl(
          client,
          bannerUrl,
          source.boxContent.bannerImageFilename.split("/").pop() ||
            "banner.jpg",
        );

        if (bannerImageRef) {
          existingLogos.set(bannerUrl, bannerImageRef);
          console.log(
            `  Banner image uploaded successfully for ${source.name}`,
          );
        } else {
          console.warn(`  Failed to upload banner image for ${source.name}`);
        }
      }
    }
  }

  const brand: Brand = {
    _id: brandId,
    _type: "brand",
    name: source.name,
    slug: {
      _type: "slug",
      current: `/marki/${source.slug}/`,
    },
    description: heroDescription,
    heroImage: {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: PRIMALUNA_HERO_IMAGE_REF,
      },
    },
    brandDescriptionHeading: brandDescriptionHeading,
    brandDescription: brandDescriptionContent,
    seo: {
      title: seoTitle,
      description: seoDescription,
    },
    doNotIndex: false,
    hideFromList: false,
  };

  // Add logo if available
  if (logoRef) {
    brand.logo = {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: logoRef,
      },
    };
  }

  // Add banner image if available
  if (bannerImageRef) {
    brand.bannerImage = {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: bannerImageRef,
      },
    };
  }

  return brand;
}

/**
 * Create Sanity client for brand migration
 */
export function createMigrationClient(): SanityClient {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;
  const token = process.env.SANITY_API_TOKEN;

  if (!projectId || !dataset || !token) {
    throw new Error(
      "Missing required environment variables: SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_TOKEN",
    );
  }

  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: "2024-01-01",
    useCdn: false,
  });
}
