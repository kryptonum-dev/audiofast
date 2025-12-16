#!/usr/bin/env bun
/**
 * Single Brand Migration Script (CSV-based)
 *
 * Migrates one brand at a time from the brandsall.csv export.
 * Usage:
 *   bun run migrate-brand-csv.ts --name="Bricasti"
 *   bun run migrate-brand-csv.ts --id=58
 *   bun run migrate-brand-csv.ts --name="Bricasti" --dry-run
 */

import * as https from "node:https";
import { Readable } from "node:stream";

import { createClient, type SanityClient } from "@sanity/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CSV_FILE_PATH = path.resolve(__dirname, "../../../../../brandsall.csv");

const PRIMALUNA_HERO_IMAGE_REF =
  "image-c19f5cd6588ad862e6597c9843b6d5f44b8cfe96-3494x1538-webp";

const LEGACY_ASSETS_BASE_URL = "https://audiofast.pl/assets/";

// SSL bypass agent for legacy assets
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ============================================================================
// TYPES
// ============================================================================

interface CSVRow {
  ID: string;
  Name: string;
  Slug: string;
  LogoID: string;
  LogoFilename: string | null;
  HeroDescription: string | null;
  BannerBoxID: string | null;
  BigPictureID: string | null;
  BannerImageFilename: string | null;
  TextBoxID: string | null;
  TextBoxContent: string | null;
}

interface BrandData {
  id: string;
  name: string;
  slug: string;
  logoFilename: string | null;
  heroDescription: string | null;
  bannerImageFilename: string | null;
  textBlocks: string[]; // All text box contents combined
}

interface PortableTextBlock {
  _key: string;
  _type: "block";
  children: Array<{
    _key: string;
    _type: "span";
    marks: string[];
    text: string;
  }>;
  markDefs: any[];
  style: string;
}

interface PortableTextYouTube {
  _key: string;
  _type: "ptYoutubeVideo";
  youtubeId: string;
  title?: string;
}

interface PortableTextMinimalImage {
  _key: string;
  _type: "ptMinimalImage";
  image: {
    _type: "image";
    asset: {
      _type: "reference";
      _ref: string;
    };
  };
}

interface ImageShortcode {
  fullMatch: string;
  src: string;
  id: string;
  width?: string;
  height?: string;
}

interface ParsedHtmlResult {
  blocks: PortableTextContent[];
  h1Heading: string | null; // If h1 found, use as description heading
}

type PortableTextContent =
  | PortableTextBlock
  | PortableTextYouTube
  | PortableTextMinimalImage;

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(filePath: string): CSVRow[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as CSVRow[];

  return records;
}

function groupBrandData(rows: CSVRow[]): Map<string, BrandData> {
  const brands = new Map<string, BrandData>();

  for (const row of rows) {
    const id = row.ID;

    if (!brands.has(id)) {
      brands.set(id, {
        id,
        name: row.Name,
        slug: row.Slug,
        logoFilename: row.LogoFilename || null,
        heroDescription: row.HeroDescription || null,
        bannerImageFilename: row.BannerImageFilename || null,
        textBlocks: [],
      });
    }

    const brand = brands.get(id)!;

    // Add text block if present and not already added
    if (row.TextBoxContent && row.TextBoxContent.trim()) {
      // Skip empty or divider-only content
      const content = row.TextBoxContent.trim();
      if (content !== "<hr><p>&nbsp;</p>" && content !== "<p>&nbsp;</p>") {
        // Check if this exact content is already added
        if (!brand.textBlocks.includes(content)) {
          brand.textBlocks.push(content);
        }
      }
    }

    // Update banner image if not set yet
    if (!brand.bannerImageFilename && row.BannerImageFilename) {
      brand.bannerImageFilename = row.BannerImageFilename;
    }
  }

  return brands;
}

function findBrandByName(
  brands: Map<string, BrandData>,
  name: string,
): BrandData | null {
  const normalizedName = name.toLowerCase().trim();

  for (const brand of brands.values()) {
    if (brand.name.toLowerCase().trim() === normalizedName) {
      return brand;
    }
  }

  return null;
}

function findBrandById(
  brands: Map<string, BrandData>,
  id: string,
): BrandData | null {
  return brands.get(id) || null;
}

// ============================================================================
// HTML TO PORTABLE TEXT CONVERSION
// ============================================================================

function generateKey(): string {
  return uuidv4().slice(0, 8);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract YouTube video IDs from HTML content
 */
function extractYouTubeIds(html: string): string[] {
  const youtubeIds: string[] = [];

  // Match YouTube iframe embeds
  const iframeRegex = /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/gi;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    youtubeIds.push(match[1]);
  }

  // Match direct YouTube URLs
  const urlRegex = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/gi;
  while ((match = urlRegex.exec(html)) !== null) {
    if (!youtubeIds.includes(match[1])) {
      youtubeIds.push(match[1]);
    }
  }

  // Match youtu.be short URLs
  const shortRegex = /youtu\.be\/([a-zA-Z0-9_-]{11})/gi;
  while ((match = shortRegex.exec(html)) !== null) {
    if (!youtubeIds.includes(match[1])) {
      youtubeIds.push(match[1]);
    }
  }

  return youtubeIds;
}

/**
 * Check if content is primarily a YouTube embed (iframe only, minimal text)
 */
function isYouTubeOnlyContent(html: string): boolean {
  // Remove the iframe and see if there's meaningful text left
  const withoutIframe = html.replace(/<iframe[^>]*>.*?<\/iframe>/gi, "");
  const textContent = stripHtml(withoutIframe);

  // If text content is very short (just titles or empty), it's YouTube-only
  return textContent.length < 100 && html.includes("youtube.com/embed");
}

/**
 * Extract image shortcodes from HTML
 * Matches: [image src="/assets/..." id="..." width="..." height="..." class="..."]
 */
function extractImageShortcodes(html: string): ImageShortcode[] {
  const images: ImageShortcode[] = [];

  // Match [image ...] shortcodes
  const shortcodeRegex = /\[image\s+([^\]]+)\]/gi;
  let match;

  while ((match = shortcodeRegex.exec(html)) !== null) {
    const attrs = match[1];

    // Extract src attribute
    const srcMatch = attrs.match(/src="([^"]+)"/i);
    const idMatch = attrs.match(/id="([^"]+)"/i);
    const widthMatch = attrs.match(/width="([^"]+)"/i);
    const heightMatch = attrs.match(/height="([^"]+)"/i);

    if (srcMatch) {
      images.push({
        fullMatch: match[0],
        src: srcMatch[1],
        id: idMatch ? idMatch[1] : "",
        width: widthMatch ? widthMatch[1] : undefined,
        height: heightMatch ? heightMatch[1] : undefined,
      });
    }
  }

  return images;
}

/**
 * Parse HTML content into structured blocks with proper heading styles
 * Returns blocks and extracted h1 heading (if found)
 */
async function parseHtmlToBlocks(
  html: string,
  client: SanityClient | null,
  dryRun: boolean,
): Promise<ParsedHtmlResult> {
  const blocks: PortableTextContent[] = [];
  let h1Heading: string | null = null;

  // Normalize line breaks
  let content = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Extract and process image shortcodes first
  const imageShortcodes = extractImageShortcodes(content);
  const imageAssetMap = new Map<string, string>(); // shortcode → asset ref

  // Upload images and store references
  for (const img of imageShortcodes) {
    if (client && !dryRun) {
      // Convert src to full URL
      let imageUrl = img.src;
      if (imageUrl.startsWith("/assets/")) {
        imageUrl = `${LEGACY_ASSETS_BASE_URL}${imageUrl.replace("/assets/", "")}`;
      } else if (!imageUrl.startsWith("http")) {
        imageUrl = `${LEGACY_ASSETS_BASE_URL}${imageUrl}`;
      }

      const filename = imageUrl.split("/").pop() || "image.jpg";
      console.log(`    📷 Found image in text: ${filename}`);

      const assetRef = await uploadImageToSanity(client, imageUrl, filename);
      if (assetRef) {
        imageAssetMap.set(img.fullMatch, assetRef);
      }
    } else if (dryRun) {
      console.log(
        `    📷 Found image in text: ${img.src} (dry-run, not uploading)`,
      );
    }
  }

  // Replace image shortcodes with placeholders for processing
  const IMAGE_PLACEHOLDER_PREFIX = "___IMAGE_PLACEHOLDER_";
  let placeholderIndex = 0;
  const placeholderMap = new Map<string, ImageShortcode>();

  for (const img of imageShortcodes) {
    const placeholder = `${IMAGE_PLACEHOLDER_PREFIX}${placeholderIndex}___`;
    placeholderMap.set(placeholder, img);
    content = content.replace(img.fullMatch, placeholder);
    placeholderIndex++;
  }

  // Remove YouTube iframes (handled separately)
  const youtubeIds = extractYouTubeIds(content);
  content = content.replace(/<iframe[^>]*>.*?<\/iframe>/gi, "");

  // Process block-level elements with regex to preserve order
  // Match: <h1>...</h1>, <h2>...</h2>, <h3>...</h3>, <h4>...</h4>, <p>...</p>, <blockquote>...</blockquote>
  const blockRegex = /<(h1|h2|h3|h4|p|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;

  let blockMatch;

  while ((blockMatch = blockRegex.exec(content)) !== null) {
    const tag = blockMatch[1].toLowerCase();
    const innerContent = blockMatch[3];

    // Check for image placeholder in content
    const placeholderMatch = innerContent.match(
      new RegExp(`${IMAGE_PLACEHOLDER_PREFIX}(\\d+)___`),
    );

    if (placeholderMatch) {
      // This block contains an image
      const placeholder = placeholderMatch[0];
      const imgShortcode = placeholderMap.get(placeholder);

      if (imgShortcode) {
        const assetRef = imageAssetMap.get(imgShortcode.fullMatch);

        if (assetRef) {
          blocks.push({
            _key: generateKey(),
            _type: "ptMinimalImage",
            image: {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: assetRef,
              },
            },
          });
        }
      }

      // Also process any text around the image
      const textWithoutPlaceholder = innerContent.replace(
        new RegExp(`${IMAGE_PLACEHOLDER_PREFIX}\\d+___`, "g"),
        "",
      );
      const cleanText = stripHtml(textWithoutPlaceholder);
      if (cleanText.length > 0) {
        blocks.push(createTextBlock(cleanText, "normal"));
      }

      continue;
    }

    const text = stripHtml(innerContent);
    if (text.length === 0) continue;

    // Determine block style based on tag
    let style = "normal";

    if (tag === "h1") {
      // H1 becomes the description heading (only first one)
      if (!h1Heading) {
        h1Heading = text;
        console.log(`    📌 Found H1 heading: "${text.slice(0, 50)}..."`);
      }
      // Don't add h1 to blocks - it becomes the heading
      continue;
    } else if (tag === "h2") {
      // H2 with left-border class is typically the main heading
      if (blockMatch[2].includes("left-border") && !h1Heading) {
        h1Heading = text;
        console.log(
          `    📌 Found H2 heading with left-border: "${text.slice(0, 50)}..."`,
        );
        continue;
      }
      style = "h3"; // Map h2 to h3 in detailed description
    } else if (tag === "h3" || tag === "h4") {
      style = "h3"; // Map h3/h4 to h3 style
    } else if (tag === "blockquote") {
      style = "blockquote";
    }

    blocks.push(createTextBlock(text, style));
  }

  // If no blocks were created through regex, fall back to simple split
  if (blocks.length === 0) {
    const text = stripHtml(content);
    if (text.length > 0) {
      blocks.push(createTextBlock(text, "normal"));
    }
  }

  // Add YouTube videos at the end
  for (const videoId of youtubeIds) {
    blocks.push({
      _key: generateKey(),
      _type: "ptYoutubeVideo",
      youtubeId: videoId,
    });
  }

  return { blocks, h1Heading };
}

/**
 * Create a text block with the specified style
 */
function createTextBlock(text: string, style: string): PortableTextBlock {
  return {
    _key: generateKey(),
    _type: "block",
    children: [
      {
        _key: generateKey(),
        _type: "span",
        marks: [],
        text: text,
      },
    ],
    markDefs: [],
    style: style,
  };
}

/**
 * Simple HTML to Portable Text (for hero description - no image handling needed)
 */
function htmlToPortableText(html: string | null): PortableTextContent[] {
  if (!html) return [];

  const blocks: PortableTextContent[] = [];

  // Check for YouTube embeds first
  const youtubeIds = extractYouTubeIds(html);

  // If this is primarily YouTube content, just return the video blocks
  if (isYouTubeOnlyContent(html) && youtubeIds.length > 0) {
    for (const videoId of youtubeIds) {
      blocks.push({
        _key: generateKey(),
        _type: "ptYoutubeVideo",
        youtubeId: videoId,
      });
    }
    return blocks;
  }

  // Remove iframe tags for text processing
  const htmlWithoutIframes = html.replace(/<iframe[^>]*>.*?<\/iframe>/gi, "");

  // Extract headings and paragraphs
  const normalized = htmlWithoutIframes
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Split by common block elements
  const parts = normalized.split(/<\/?(?:p|h[1-6]|div|blockquote)[^>]*>/gi);

  for (const part of parts) {
    const text = stripHtml(part);
    if (text.length > 0) {
      blocks.push(createTextBlock(text, "normal"));
    }
  }

  // If no text blocks were created, create one from the whole text
  if (blocks.length === 0 && !youtubeIds.length) {
    const text = stripHtml(htmlWithoutIframes);
    if (text.length > 0) {
      blocks.push(createTextBlock(text, "normal"));
    }
  }

  // Add YouTube videos at the end (if there was also text content)
  if (youtubeIds.length > 0 && !isYouTubeOnlyContent(html)) {
    for (const videoId of youtubeIds) {
      blocks.push({
        _key: generateKey(),
        _type: "ptYoutubeVideo",
        youtubeId: videoId,
      });
    }
  }

  return blocks;
}

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

// ============================================================================
// SEO GENERATION
// ============================================================================

function generateSeoDescription(
  brandName: string,
  heroDescription: string | null,
): string {
  // Try to extract meaningful text from hero description
  if (heroDescription) {
    const plainText = stripHtml(heroDescription);

    // Take first sentence or first 140 chars
    const firstSentence = plainText.split(/[.!?]/)[0];
    if (
      firstSentence &&
      firstSentence.length >= 80 &&
      firstSentence.length <= 140
    ) {
      return firstSentence.trim() + ".";
    }

    // If first sentence is too short or too long, truncate appropriately
    if (plainText.length >= 110) {
      const truncated = plainText.slice(0, 137).trim();
      return truncated + "...";
    }
  }

  // Fallback generic description
  return `${brandName} - poznaj wysokiej klasy sprzęt audio w ofercie Audiofast. Produkty premium dla wymagających audiofilów.`;
}

// ============================================================================
// ASSET UPLOAD
// ============================================================================

async function fetchImageInsecure(imageUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const request = https.get(
      imageUrl,
      { agent: insecureAgent },
      (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            fetchImageInsecure(redirectUrl).then(resolve);
            return;
          }
        }

        if (response.statusCode !== 200) {
          console.error(`  ✗ Failed to fetch image: ${response.statusCode}`);
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", (error) => {
          console.error(`  ✗ Response error:`, error);
          resolve(null);
        });
      },
    );

    request.on("error", (error) => {
      console.error(`  ✗ Request error:`, error);
      resolve(null);
    });
  });
}

async function uploadImageToSanity(
  client: SanityClient,
  imageUrl: string,
  filename: string,
): Promise<string | null> {
  console.log(`  ↓ Downloading: ${filename}`);

  const imageBuffer = await fetchImageInsecure(imageUrl);
  if (!imageBuffer) {
    return null;
  }

  console.log(`  ↑ Uploading to Sanity...`);

  try {
    const asset = await client.assets.upload(
      "image",
      Readable.from(imageBuffer),
      {
        filename: filename,
      },
    );

    console.log(`  ✓ Uploaded: ${asset._id}`);
    return asset._id;
  } catch (error) {
    console.error(`  ✗ Upload failed:`, error);
    return null;
  }
}

// ============================================================================
// SANITY CLIENT
// ============================================================================

function createMigrationClient(): SanityClient {
  const token = process.env.SANITY_API_TOKEN;

  if (!token) {
    throw new Error("SANITY_API_TOKEN environment variable is required");
  }

  return createClient({
    projectId: "fsw3likv",
    dataset: "production",
    apiVersion: "2024-01-01",
    token,
    useCdn: false,
  });
}

// ============================================================================
// BRAND TRANSFORMATION
// ============================================================================

interface SanityBrandDoc {
  _id: string;
  _type: "brand";
  name: string;
  slug: { _type: "slug"; current: string };
  description: PortableTextContent[];
  heroImage: { _type: "image"; asset: { _type: "reference"; _ref: string } };
  brandDescriptionHeading: PortableTextBlock[];
  brandDescription: PortableTextContent[];
  seo: { title: string; description: string };
  doNotIndex: boolean;
  hideFromList: boolean;
  logo?: { _type: "image"; asset: { _type: "reference"; _ref: string } };
  bannerImage?: { _type: "image"; asset: { _type: "reference"; _ref: string } };
}

async function transformBrandToSanity(
  brand: BrandData,
  client: SanityClient,
  dryRun: boolean,
  skipDescription: boolean = false,
): Promise<SanityBrandDoc> {
  console.log(`\n🔄 Transforming: ${brand.name}`);

  // 1. Slug
  const slug = `/marki/${brand.slug}/`;
  console.log(`  Slug: ${slug}`);

  // 2. Hero Description (from HeroDescription field)
  const heroDescription = htmlToPortableText(brand.heroDescription);
  console.log(`  Hero Description: ${heroDescription.length} blocks`);

  // 3. Logo upload
  let logoRef: string | null = null;
  if (brand.logoFilename && !dryRun) {
    const logoUrl = `${LEGACY_ASSETS_BASE_URL}${brand.logoFilename}`;
    const filename = brand.logoFilename.split("/").pop() || "logo.png";
    logoRef = await uploadImageToSanity(client, logoUrl, filename);
  } else if (brand.logoFilename) {
    console.log(`  Logo: ${brand.logoFilename} (dry-run, not uploading)`);
  }

  // 4. Banner Image upload
  let bannerImageRef: string | null = null;
  if (brand.bannerImageFilename && !dryRun) {
    const bannerUrl = `${LEGACY_ASSETS_BASE_URL}${brand.bannerImageFilename}`;
    const filename = brand.bannerImageFilename.split("/").pop() || "banner.jpg";
    bannerImageRef = await uploadImageToSanity(client, bannerUrl, filename);
  } else if (brand.bannerImageFilename) {
    console.log(
      `  Banner: ${brand.bannerImageFilename} (dry-run, not uploading)`,
    );
  }

  // 5. Detailed Description (all text blocks combined)
  let brandDescription: PortableTextContent[] = [];
  let brandDescriptionHeading: PortableTextBlock[] = [];

  if (skipDescription) {
    // Skip detailed description - use simple defaults
    brandDescriptionHeading = textToPortableText(`O ${brand.name}`);
    brandDescription = textToPortableText(
      `${brand.name} to renomowana marka oferująca sprzęt audio najwyższej klasy.`,
    );
    console.log(`  ⏭️  Skipped detailed description (using defaults)`);
  } else if (brand.textBlocks.length > 0) {
    console.log(`  Processing ${brand.textBlocks.length} text blocks...`);

    // Combine all text blocks for processing
    const allContent = brand.textBlocks.join("\n");

    // Parse HTML with proper heading and image handling
    const parseResult = await parseHtmlToBlocks(allContent, client, dryRun);
    brandDescription = parseResult.blocks;

    // Use extracted H1 heading if found, otherwise try left-border heading, otherwise default
    if (parseResult.h1Heading) {
      brandDescriptionHeading = textToPortableText(parseResult.h1Heading);
      console.log(
        `  Description Heading (from H1): "${parseResult.h1Heading.slice(0, 50)}..."`,
      );
    } else {
      // Try to extract heading with left-border class from first block
      const firstBlock = brand.textBlocks[0];
      const headingMatch = firstBlock.match(
        /<h[1-4][^>]*class="[^"]*left-border[^"]*"[^>]*>([^<]+)<\/h[1-4]>/i,
      );
      if (headingMatch) {
        brandDescriptionHeading = textToPortableText(
          stripHtml(headingMatch[1]),
        );
        console.log(
          `  Description Heading (from left-border): "${stripHtml(headingMatch[1]).slice(0, 50)}..."`,
        );
      } else {
        // Default heading
        brandDescriptionHeading = textToPortableText(`O ${brand.name}`);
        console.log(`  Description Heading (default): "O ${brand.name}"`);
      }
    }

    // Count content types
    const youtubeCount = brandDescription.filter(
      (b) => b._type === "ptYoutubeVideo",
    ).length;
    const textBlockCount = brandDescription.filter(
      (b) => b._type === "block",
    ).length;
    const imageCount = brandDescription.filter(
      (b) => b._type === "ptMinimalImage",
    ).length;
    const h3Count = brandDescription.filter(
      (b) => b._type === "block" && (b as PortableTextBlock).style === "h3",
    ).length;

    console.log(
      `  Detailed Description: ${textBlockCount} text blocks (${h3Count} h3 headings), ${imageCount} images, ${youtubeCount} YouTube videos`,
    );
  } else {
    // Default if no text blocks
    brandDescriptionHeading = textToPortableText(`O ${brand.name}`);
    brandDescription = textToPortableText(
      `${brand.name} to renomowana marka oferująca sprzęt audio najwyższej klasy.`,
    );
    console.log(`  Using default description (no text boxes found)`);
  }

  // 6. SEO
  const seoTitle = brand.name;
  const seoDescription = generateSeoDescription(
    brand.name,
    brand.heroDescription,
  );
  console.log(`  SEO Title: ${seoTitle}`);
  console.log(`  SEO Description: ${seoDescription.length} chars`);

  // Build the document
  const brandDoc: SanityBrandDoc = {
    _id: `brand-${brand.id}`,
    _type: "brand",
    name: brand.name,
    slug: {
      _type: "slug",
      current: slug,
    },
    description:
      heroDescription.length > 0
        ? heroDescription
        : textToPortableText(
            `Odkryj produkty marki ${brand.name} w ofercie Audiofast.`,
          ),
    heroImage: {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: PRIMALUNA_HERO_IMAGE_REF,
      },
    },
    brandDescriptionHeading: brandDescriptionHeading,
    brandDescription: brandDescription,
    seo: {
      title: seoTitle,
      description: seoDescription,
    },
    doNotIndex: false,
    hideFromList: false,
  };

  // Add logo if uploaded
  if (logoRef) {
    brandDoc.logo = {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: logoRef,
      },
    };
  }

  // Add banner image if uploaded
  if (bannerImageRef) {
    brandDoc.bannerImage = {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: bannerImageRef,
      },
    };
  }

  return brandDoc;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let brandName: string | null = null;
  let brandId: string | null = null;
  let dryRun = false;
  let skipDescription = false;
  let migrateAll = false;
  const excludeIds: string[] = [];

  for (const arg of args) {
    if (arg.startsWith("--name=")) {
      brandName = arg.replace("--name=", "").replace(/"/g, "");
    } else if (arg.startsWith("--id=")) {
      brandId = arg.replace("--id=", "");
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--skip-description") {
      skipDescription = true;
    } else if (arg === "--all") {
      migrateAll = true;
    } else if (arg.startsWith("--exclude=")) {
      // Comma-separated list of IDs to exclude
      const ids = arg.replace("--exclude=", "").split(",");
      excludeIds.push(...ids);
    }
  }

  if (!brandName && !brandId && !migrateAll) {
    console.error(
      'Usage: bun run migrate-brand-csv.ts --name="BrandName" [--dry-run] [--skip-description]',
    );
    console.error(
      "       bun run migrate-brand-csv.ts --id=58 [--dry-run] [--skip-description]",
    );
    console.error(
      "       bun run migrate-brand-csv.ts --all [--exclude=id1,id2,...] [--dry-run] [--skip-description]",
    );
    process.exit(1);
  }

  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║           BRAND MIGRATION (CSV-based)                         ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (skipDescription) {
    console.log(`⚠️  Skipping detailed description (brandDescription)`);
  }

  // Check CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`\n✗ CSV file not found: ${CSV_FILE_PATH}`);
    console.error("  Please place brandsall.csv in the project root.");
    process.exit(1);
  }

  // Parse CSV
  console.log(`\n📄 Reading CSV: ${CSV_FILE_PATH}`);
  const rows = parseCSV(CSV_FILE_PATH);
  console.log(`  Found ${rows.length} rows`);

  // Group by brand
  const brands = groupBrandData(rows);
  console.log(`  Grouped into ${brands.size} unique brands`);

  // Create Sanity client
  let client: SanityClient | null = null;
  if (!dryRun) {
    try {
      client = createMigrationClient();
      console.log("\n✓ Sanity client initialized");
    } catch (error) {
      console.error("\n✗ Failed to create Sanity client:", error);
      process.exit(1);
    }
  }

  // Collect brands to migrate
  let brandsToMigrate: BrandData[] = [];

  if (migrateAll) {
    // Migrate all brands except excluded ones
    for (const brand of brands.values()) {
      if (!excludeIds.includes(brand.id)) {
        brandsToMigrate.push(brand);
      }
    }
    console.log(
      `\n📋 Will migrate ${brandsToMigrate.length} brands (${excludeIds.length} excluded)`,
    );
  } else if (brandName) {
    const brand = findBrandByName(brands, brandName);
    if (!brand) {
      console.error(`\n✗ Brand not found: "${brandName}"`);
      console.log("\nAvailable brands:");
      for (const b of brands.values()) {
        console.log(`  - ${b.name} (ID: ${b.id})`);
      }
      process.exit(1);
    }
    brandsToMigrate = [brand];
  } else if (brandId) {
    const brand = findBrandById(brands, brandId);
    if (!brand) {
      console.error(`\n✗ Brand ID not found: ${brandId}`);
      process.exit(1);
    }
    brandsToMigrate = [brand];
  }

  if (brandsToMigrate.length === 0) {
    console.error("\n✗ No brands to migrate");
    process.exit(1);
  }

  // Migration results tracking
  const results = {
    success: [] as string[],
    failed: [] as string[],
  };

  // Process each brand
  for (let i = 0; i < brandsToMigrate.length; i++) {
    const brand = brandsToMigrate[i];

    console.log(
      "\n═══════════════════════════════════════════════════════════════════",
    );
    console.log(
      `🏷️  [${i + 1}/${brandsToMigrate.length}] Brand: ${brand.name} (ID: ${brand.id})`,
    );
    console.log(
      "═══════════════════════════════════════════════════════════════════",
    );
    console.log(`  Slug: ${brand.slug}`);
    console.log(`  Logo: ${brand.logoFilename || "None"}`);
    console.log(`  Banner: ${brand.bannerImageFilename || "None"}`);
    console.log(`  Hero Description: ${brand.heroDescription ? "Yes" : "No"}`);
    console.log(`  Text Blocks: ${brand.textBlocks.length}`);

    try {
      // Transform and upload
      const brandDoc = await transformBrandToSanity(
        brand,
        client!,
        dryRun,
        skipDescription,
      );

      // Create or update in Sanity
      if (!dryRun && client) {
        console.log("\n📤 Uploading to Sanity...");
        await client.createOrReplace(brandDoc);
        console.log(`\n✅ SUCCESS: ${brand.name} migrated!`);
        console.log(`   Document ID: ${brandDoc._id}`);
        results.success.push(brand.name);
      } else {
        console.log("\n📋 DRY RUN - Would create document:");
        console.log(`   ID: ${brandDoc._id}`);
        console.log(`   Name: ${brandDoc.name}`);
        console.log(`   Slug: ${brandDoc.slug.current}`);
        results.success.push(brand.name);
      }
    } catch (error) {
      console.error(`\n✗ Failed to migrate ${brand.name}:`, error);
      results.failed.push(brand.name);
    }
  }

  // Print summary
  console.log(
    "\n════════════════════════════════════════════════════════════════════",
  );
  console.log("📊 MIGRATION SUMMARY");
  console.log(
    "════════════════════════════════════════════════════════════════════",
  );
  console.log(`✅ Successful: ${results.success.length}`);
  if (results.success.length > 0) {
    results.success.forEach((name) => console.log(`   - ${name}`));
  }
  console.log(`❌ Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach((name) => console.log(`   - ${name}`));
  }
  console.log("\nMigration complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
