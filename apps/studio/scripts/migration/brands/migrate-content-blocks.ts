#!/usr/bin/env bun
/**
 * Brand Content Blocks Migration Script
 *
 * Migrates content blocks from legacy SilverStripe Box table to Sanity brandContentBlocks field.
 * Updates existing brands (already migrated) with their detailed content.
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/brands/migrate-content-blocks.ts --dry-run
 *   bun run apps/studio/scripts/migration/brands/migrate-content-blocks.ts --name="Audio Research"
 *   bun run apps/studio/scripts/migration/brands/migrate-content-blocks.ts --id=73
 *   SANITY_API_TOKEN="xxx" bun run apps/studio/scripts/migration/brands/migrate-content-blocks.ts --all
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

const CSV_FILE_PATH = path.resolve(
  __dirname,
  "../../../../../brand-content-blocks.csv",
);

const LEGACY_ASSETS_BASE_URL = "https://www.audiofast.pl/assets/";

// SSL bypass agent for legacy assets
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ============================================================================
// TYPES
// ============================================================================

interface CSVRow {
  BrandID: string;
  BrandName: string;
  BoxID: string;
  BoxSort: string;
  BoxType: string;
  BoxContent: string | null;
  YoutubeLink: string | null;
}

interface BrandBoxes {
  brandId: string;
  brandName: string;
  boxes: BoxData[];
}

interface BoxData {
  boxId: string;
  sort: number;
  type: string;
  content: string | null;
  youtubeLink: string | null;
}

// Portable Text types
interface PortableTextBlock {
  _key: string;
  _type: "block";
  children: Array<{
    _key: string;
    _type: "span";
    marks: string[];
    text: string;
  }>;
  markDefs: Array<{
    _key: string;
    _type: string;
    [key: string]: any;
  }>;
  style: string;
  listItem?: string;
  level?: number;
}

interface PortableTextYouTube {
  _key: string;
  _type: "ptYoutubeVideo";
  youtubeId: string;
  title?: string;
}

interface PortableTextVimeo {
  _key: string;
  _type: "ptVimeoVideo";
  vimeoId: string;
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

interface PortableTextInlineImage {
  _key: string;
  _type: "ptInlineImage";
  image: {
    _type: "image";
    asset: {
      _type: "reference";
      _ref: string;
    };
  };
}

interface PortableTextPageBreak {
  _key: string;
  _type: "ptPageBreak";
  style: "columnBreak";
}

type PortableTextContent =
  | PortableTextBlock
  | PortableTextYouTube
  | PortableTextVimeo
  | PortableTextMinimalImage
  | PortableTextInlineImage
  | PortableTextPageBreak;

// Content block types
interface ContentBlockText {
  _type: "contentBlockText";
  _key: string;
  content: PortableTextContent[];
}

interface ContentBlockYoutube {
  _type: "contentBlockYoutube";
  _key: string;
  youtubeId: string;
  title?: string;
}

interface ContentBlockVimeo {
  _type: "contentBlockVimeo";
  _key: string;
  vimeoId: string;
  title?: string;
}

interface ContentBlockHorizontalLine {
  _type: "contentBlockHorizontalLine";
  _key: string;
  style: "horizontalLine";
}

type ContentBlock =
  | ContentBlockText
  | ContentBlockYoutube
  | ContentBlockVimeo
  | ContentBlockHorizontalLine;

interface ImageShortcode {
  fullMatch: string;
  src: string;
  id: string;
  width?: string;
  height?: string;
  title?: string;
  className?: string;
}

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

function groupBoxesByBrand(rows: CSVRow[]): Map<string, BrandBoxes> {
  const brands = new Map<string, BrandBoxes>();

  for (const row of rows) {
    const brandId = row.BrandID;

    if (!brands.has(brandId)) {
      brands.set(brandId, {
        brandId,
        brandName: row.BrandName,
        boxes: [],
      });
    }

    const brand = brands.get(brandId)!;

    // Add box data
    brand.boxes.push({
      boxId: row.BoxID,
      sort: parseInt(row.BoxSort, 10),
      type: row.BoxType,
      content: row.BoxContent || null,
      youtubeLink: row.YoutubeLink || null,
    });
  }

  // Sort boxes by sort order for each brand
  for (const brand of brands.values()) {
    brand.boxes.sort((a, b) => a.sort - b.sort);
  }

  return brands;
}

// ============================================================================
// UTILITY FUNCTIONS
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

// ============================================================================
// VIDEO EXTRACTION
// ============================================================================

function extractYouTubeId(html: string): string | null {
  // Match YouTube iframe embeds
  const iframeMatch = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (iframeMatch) return iframeMatch[1];

  // Match direct YouTube URLs
  const urlMatch = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/i);
  if (urlMatch) return urlMatch[1];

  // Match youtu.be short URLs
  const shortMatch = html.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch) return shortMatch[1];

  return null;
}

function extractVimeoId(html: string): string | null {
  const match = html.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match ? match[1] : null;
}

function extractAllVideos(
  html: string,
): Array<{ type: "youtube" | "vimeo"; id: string; fullMatch: string }> {
  const videos: Array<{
    type: "youtube" | "vimeo";
    id: string;
    fullMatch: string;
  }> = [];

  // Extract YouTube iframes
  const youtubeRegex =
    /<iframe[^>]*src="[^"]*youtube\.com\/embed\/([a-zA-Z0-9_-]{11})[^"]*"[^>]*>.*?<\/iframe>/gi;
  let match;
  while ((match = youtubeRegex.exec(html)) !== null) {
    videos.push({
      type: "youtube",
      id: match[1],
      fullMatch: match[0],
    });
  }

  // Extract Vimeo iframes
  const vimeoRegex =
    /<iframe[^>]*src="[^"]*vimeo\.com\/(?:video\/)?(\d+)[^"]*"[^>]*>.*?<\/iframe>/gi;
  while ((match = vimeoRegex.exec(html)) !== null) {
    videos.push({
      type: "vimeo",
      id: match[1],
      fullMatch: match[0],
    });
  }

  return videos;
}

// ============================================================================
// IMAGE EXTRACTION
// ============================================================================

function extractImageShortcodes(html: string): ImageShortcode[] {
  const images: ImageShortcode[] = [];

  // Match [image ...] shortcodes
  const shortcodeRegex = /\[image\s+([^\]]+)\]/gi;
  let match;

  while ((match = shortcodeRegex.exec(html)) !== null) {
    const attrs = match[1];

    // Extract attributes
    const srcMatch = attrs.match(/src="([^"]+)"/i);
    const idMatch = attrs.match(/id="([^"]+)"/i);
    const widthMatch = attrs.match(/width="([^"]+)"/i);
    const heightMatch = attrs.match(/height="([^"]+)"/i);
    const titleMatch = attrs.match(/title="([^"]+)"/i);
    const classMatch = attrs.match(/class="([^"]+)"/i);

    if (srcMatch) {
      images.push({
        fullMatch: match[0],
        src: srcMatch[1],
        id: idMatch ? idMatch[1] : "",
        width: widthMatch ? widthMatch[1] : undefined,
        height: heightMatch ? heightMatch[1] : undefined,
        title: titleMatch ? titleMatch[1] : undefined,
        className: classMatch ? classMatch[1] : undefined,
      });
    }
  }

  return images;
}

// ============================================================================
// ASSET UPLOAD
// ============================================================================

async function fetchImageInsecure(imageUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const protocol = imageUrl.startsWith("https") ? https : require("http");

    const request = protocol.get(
      imageUrl,
      { agent: imageUrl.startsWith("https") ? insecureAgent : undefined },
      (response: any) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            fetchImageInsecure(redirectUrl).then(resolve);
            return;
          }
        }

        if (response.statusCode !== 200) {
          console.error(`    ✗ Failed to fetch image: ${response.statusCode}`);
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", (error: Error) => {
          console.error(`    ✗ Response error:`, error);
          resolve(null);
        });
      },
    );

    request.on("error", (error: Error) => {
      console.error(`    ✗ Request error:`, error);
      resolve(null);
    });
  });
}

async function uploadImageToSanity(
  client: SanityClient,
  imageUrl: string,
  filename: string,
): Promise<string | null> {
  console.log(`    ↓ Downloading: ${filename}`);

  const imageBuffer = await fetchImageInsecure(imageUrl);
  if (!imageBuffer) {
    return null;
  }

  console.log(`    ↑ Uploading to Sanity...`);

  try {
    const asset = await client.assets.upload(
      "image",
      Readable.from(imageBuffer),
      {
        filename: filename,
      },
    );

    console.log(`    ✓ Uploaded: ${asset._id}`);
    return asset._id;
  } catch (error) {
    console.error(`    ✗ Upload failed:`, error);
    return null;
  }
}

// ============================================================================
// HTML TO PORTABLE TEXT CONVERSION
// ============================================================================

interface SpanChild {
  _key: string;
  _type: "span";
  marks: string[];
  text: string;
}

/**
 * Parse HTML content into Portable Text children with marks (strong, em)
 * Handles nested <strong>, <em>, <b>, <i> tags
 * Preserves spaces between normal and marked text
 */
function parseHtmlToChildren(html: string): SpanChild[] {
  const children: SpanChild[] = [];

  // Decode HTML entities first
  let content = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove <br> tags - replace with space
  content = content.replace(/<br\s*\/?>/gi, " ");

  // Remove span tags but keep content
  content = content.replace(/<\/?span[^>]*>/gi, "");

  // Collapse multiple spaces into one
  content = content.replace(/\s+/g, " ");

  // Pattern to match text with possible strong/em marks
  const tagPattern = /<(strong|b|em|i)>([\s\S]*?)<\/\1>/gi;

  let lastIndex = 0;
  let match;

  // Create a copy for regex matching
  const contentCopy = content;

  while ((match = tagPattern.exec(contentCopy)) !== null) {
    // Add text before this match (if any) - preserve trailing space
    if (match.index > lastIndex) {
      const textBefore = contentCopy.slice(lastIndex, match.index);
      // Strip HTML tags but preserve spaces
      const cleanText = textBefore.replace(/<[^>]*>/g, "");
      if (cleanText) {
        children.push({
          _key: generateKey(),
          _type: "span",
          marks: [],
          text: cleanText,
        });
      }
    }

    // Determine the mark type
    const tagName = match[1].toLowerCase();
    const mark = tagName === "strong" || tagName === "b" ? "strong" : "em";

    // Get inner content - strip HTML but preserve internal spaces
    const innerContent = match[2].replace(/<[^>]*>/g, "");

    if (innerContent) {
      children.push({
        _key: generateKey(),
        _type: "span",
        marks: [mark],
        text: innerContent,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match - preserve leading space
  if (lastIndex < contentCopy.length) {
    const remainingText = contentCopy.slice(lastIndex);
    const cleanText = remainingText.replace(/<[^>]*>/g, "");
    if (cleanText) {
      children.push({
        _key: generateKey(),
        _type: "span",
        marks: [],
        text: cleanText,
      });
    }
  }

  // If no children were created, create one with stripped HTML
  if (children.length === 0) {
    const plainText = content
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (plainText) {
      children.push({
        _key: generateKey(),
        _type: "span",
        marks: [],
        text: plainText,
      });
    }
  }

  // Post-process: trim only the very first and very last spans
  if (children.length > 0) {
    children[0].text = children[0].text.trimStart();
    children[children.length - 1].text =
      children[children.length - 1].text.trimEnd();

    // Remove any empty spans that resulted from trimming
    return children.filter((child) => child.text.length > 0);
  }

  return children;
}

function createTextBlock(
  text: string,
  style: string = "normal",
): PortableTextBlock {
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
 * Create a text block from HTML content, preserving strong/em marks
 */
function createTextBlockFromHtml(
  html: string,
  style: string = "normal",
): PortableTextBlock {
  const children = parseHtmlToChildren(html);

  // If no children, return empty block
  if (children.length === 0) {
    return {
      _key: generateKey(),
      _type: "block",
      children: [
        {
          _key: generateKey(),
          _type: "span",
          marks: [],
          text: "",
        },
      ],
      markDefs: [],
      style: style,
    };
  }

  return {
    _key: generateKey(),
    _type: "block",
    children: children,
    markDefs: [],
    style: style,
  };
}

/**
 * Parse HTML content into Portable Text blocks
 * Handles: headings, paragraphs, blockquotes, images, videos, page breaks
 */
async function parseHtmlToPortableText(
  html: string,
  client: SanityClient | null,
  dryRun: boolean,
): Promise<PortableTextContent[]> {
  const blocks: PortableTextContent[] = [];

  // Normalize line breaks
  let content = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Extract and store image shortcodes with their positions
  const imageShortcodes = extractImageShortcodes(content);
  const imageAssetMap = new Map<string, string>();

  // Upload images first
  for (const img of imageShortcodes) {
    if (client && !dryRun) {
      let imageUrl = img.src;

      // Strip /assets/ prefix and construct full URL
      if (imageUrl.startsWith("/assets/")) {
        imageUrl = imageUrl.replace("/assets/", "");
      }

      // Remove hash-like folders (e.g., /27d6e131a7/) that may not exist on the actual server
      // Pattern: folder name that looks like a hash (alphanumeric, 8-12 chars)
      imageUrl = imageUrl.replace(/\/[a-f0-9]{8,12}\//gi, "/");

      // Construct full URL if not already absolute
      if (!imageUrl.startsWith("http")) {
        imageUrl = `${LEGACY_ASSETS_BASE_URL}${imageUrl}`;
      }

      const filename = imageUrl.split("/").pop() || "image.jpg";
      const assetRef = await uploadImageToSanity(client, imageUrl, filename);
      if (assetRef) {
        imageAssetMap.set(img.fullMatch, assetRef);
      }
    } else if (dryRun) {
      console.log(`    📷 Would upload image: ${img.src}`);
    }
  }

  // Extract videos
  const videos = extractAllVideos(content);

  // Replace page breaks with a placeholder
  const PAGE_BREAK_PLACEHOLDER = "___PAGE_BREAK___";
  content = content.replace(/<!--\s*pagebreak\s*-->/gi, PAGE_BREAK_PLACEHOLDER);

  // Replace image shortcodes with placeholders
  const IMAGE_PLACEHOLDER_PREFIX = "___IMAGE_";
  let imageIndex = 0;
  const imagePlaceholderMap = new Map<string, ImageShortcode>();

  for (const img of imageShortcodes) {
    const placeholder = `${IMAGE_PLACEHOLDER_PREFIX}${imageIndex}___`;
    imagePlaceholderMap.set(placeholder, img);
    content = content.replace(img.fullMatch, placeholder);
    imageIndex++;
  }

  // Replace video iframes with placeholders
  const VIDEO_PLACEHOLDER_PREFIX = "___VIDEO_";
  let videoIndex = 0;
  const videoPlaceholderMap = new Map<
    string,
    { type: "youtube" | "vimeo"; id: string }
  >();

  for (const video of videos) {
    const placeholder = `${VIDEO_PLACEHOLDER_PREFIX}${videoIndex}___`;
    videoPlaceholderMap.set(placeholder, { type: video.type, id: video.id });
    content = content.replace(video.fullMatch, placeholder);
    videoIndex++;
  }

  // Split content by block-level elements and special markers
  // We'll process in order: paragraphs, headings, blockquotes, hr, page breaks
  const segmentRegex =
    /(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>|<p[^>]*>[\s\S]*?<\/p>|<blockquote[^>]*>[\s\S]*?<\/blockquote>|<hr[^>]*\/?>|___PAGE_BREAK___|___IMAGE_\d+___|___VIDEO_\d+___)/gi;

  const segments = content.split(segmentRegex).filter((s) => s && s.trim());

  for (const segment of segments) {
    const trimmed = segment.trim();

    // Handle page break
    if (trimmed === PAGE_BREAK_PLACEHOLDER) {
      blocks.push({
        _key: generateKey(),
        _type: "ptPageBreak",
        style: "columnBreak",
      });
      continue;
    }

    // Handle image placeholder
    if (trimmed.match(/^___IMAGE_\d+___$/)) {
      const img = imagePlaceholderMap.get(trimmed);
      if (img) {
        const assetRef = imageAssetMap.get(img.fullMatch);

        // Determine if it should be inline or full width
        // Small images (<= 300px width) or images with specific classes/alignments could be inline
        const width = img.width ? parseInt(img.width, 10) : 9999;
        const isSmall = width <= 300;
        const type = isSmall ? "ptInlineImage" : "ptMinimalImage";

        if (assetRef) {
          blocks.push({
            _key: generateKey(),
            _type: type,
            image: {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: assetRef,
              },
            },
          });
        } else if (dryRun) {
          // In dry-run, add a placeholder
          blocks.push({
            _key: generateKey(),
            _type: type,
            image: {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: "dry-run-image-placeholder",
              },
            },
          });
        }
      }
      continue;
    }

    // Handle video placeholder
    if (trimmed.match(/^___VIDEO_\d+___$/)) {
      const video = videoPlaceholderMap.get(trimmed);
      if (video) {
        if (video.type === "youtube") {
          blocks.push({
            _key: generateKey(),
            _type: "ptYoutubeVideo",
            youtubeId: video.id,
          });
        } else {
          blocks.push({
            _key: generateKey(),
            _type: "ptVimeoVideo",
            vimeoId: video.id,
          });
        }
      }
      continue;
    }

    // Handle HR
    if (trimmed.match(/^<hr[^>]*\/?>$/i)) {
      // Inline HR within text - we'll skip these as they're just formatting
      // The separate HR boxes handle section breaks
      continue;
    }

    // Handle headings
    const headingMatch = trimmed.match(/^<(h[1-6])[^>]*>([\s\S]*?)<\/\1>$/i);
    if (headingMatch) {
      const htmlContent = headingMatch[2];
      const block = createTextBlockFromHtml(htmlContent, "h3");
      // Only add if there's actual content
      if (block.children.some((child) => child.text.trim())) {
        blocks.push(block);
      }
      continue;
    }

    // Handle blockquotes
    const blockquoteMatch = trimmed.match(
      /^<blockquote[^>]*>([\s\S]*?)<\/blockquote>$/i,
    );
    if (blockquoteMatch) {
      const htmlContent = blockquoteMatch[1];
      const block = createTextBlockFromHtml(htmlContent, "blockquote");
      if (block.children.some((child) => child.text.trim())) {
        blocks.push(block);
      }
      continue;
    }

    // Handle paragraphs
    const paragraphMatch = trimmed.match(/^<p[^>]*>([\s\S]*?)<\/p>$/i);
    if (paragraphMatch) {
      const innerContent = paragraphMatch[1];

      // Check if paragraph contains only a page break placeholder
      if (innerContent.trim() === PAGE_BREAK_PLACEHOLDER) {
        console.log(`    📄 Detected page break (column divider)`);
        blocks.push({
          _key: generateKey(),
          _type: "ptPageBreak",
          style: "columnBreak",
        });
        continue;
      }

      // Check if paragraph contains an image placeholder (possibly with whitespace/br around it)
      const imageMatch = innerContent.match(/___IMAGE_(\d+)___/);
      if (imageMatch) {
        // Check if the rest of the content is just whitespace, &nbsp;, <br>, or <span> wrappers
        const withoutImage = innerContent
          .replace(/___IMAGE_\d+___/g, "")
          .replace(/&nbsp;/g, "")
          .replace(/<br\s*\/?>/gi, "")
          .replace(/<\/?span[^>]*>/gi, "")
          .trim();

        // If paragraph is essentially just the image, add it as a block
        if (!withoutImage) {
          const placeholder = `___IMAGE_${imageMatch[1]}___`;
          const img = imagePlaceholderMap.get(placeholder);
          if (img) {
            const assetRef = imageAssetMap.get(img.fullMatch);

            const isInline = img.className
              ? /\bleft\b/.test(img.className)
              : false;
            const type = isInline ? "ptInlineImage" : "ptMinimalImage";

            if (assetRef) {
              blocks.push({
                _key: generateKey(),
                _type: type,
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: assetRef,
                  },
                },
              });
            } else if (dryRun) {
              blocks.push({
                _key: generateKey(),
                _type: type,
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "dry-run-image-placeholder",
                  },
                },
              });
            }
          }
          continue;
        }
        // If there's meaningful text alongside the image, add both
        else {
          // First add the image
          const placeholder = `___IMAGE_${imageMatch[1]}___`;
          const img = imagePlaceholderMap.get(placeholder);
          if (img) {
            const assetRef = imageAssetMap.get(img.fullMatch);

            const isInline = img.className
              ? /\bleft\b/.test(img.className)
              : false;
            const type = isInline ? "ptInlineImage" : "ptMinimalImage";

            if (assetRef) {
              blocks.push({
                _key: generateKey(),
                _type: type,
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: assetRef,
                  },
                },
              });
            } else if (dryRun) {
              blocks.push({
                _key: generateKey(),
                _type: type,
                image: {
                  _type: "image",
                  asset: {
                    _type: "reference",
                    _ref: "dry-run-image-placeholder",
                  },
                },
              });
            }
          }
          // Then add the text if there's any meaningful content (preserve formatting)
          const textBlock = createTextBlockFromHtml(withoutImage, "normal");
          if (textBlock.children.some((child) => child.text.trim())) {
            blocks.push(textBlock);
          }
          continue;
        }
      }

      // Check if paragraph contains only a video placeholder
      if (innerContent.trim().match(/^___VIDEO_\d+___$/)) {
        const video = videoPlaceholderMap.get(innerContent.trim());
        if (video) {
          if (video.type === "youtube") {
            blocks.push({
              _key: generateKey(),
              _type: "ptYoutubeVideo",
              youtubeId: video.id,
            });
          } else {
            blocks.push({
              _key: generateKey(),
              _type: "ptVimeoVideo",
              vimeoId: video.id,
            });
          }
        }
        continue;
      }

      // Extract text, handling placeholders within - preserve formatting
      let htmlContent = innerContent;

      // Remove any remaining image/video placeholders from text
      htmlContent = htmlContent.replace(/___IMAGE_\d+___/g, "");
      htmlContent = htmlContent.replace(/___VIDEO_\d+___/g, "");

      const block = createTextBlockFromHtml(htmlContent, "normal");
      if (block.children.some((child) => child.text.trim())) {
        blocks.push(block);
      }
      continue;
    }

    // Fallback: try to extract any remaining text with formatting
    if (!trimmed.startsWith("___")) {
      const block = createTextBlockFromHtml(trimmed, "normal");
      if (block.children.some((child) => child.text.trim())) {
        blocks.push(block);
      }
    }
  }

  return blocks;
}

// ============================================================================
// BOX TO CONTENT BLOCK CONVERSION
// ============================================================================

async function convertBoxToContentBlock(
  box: BoxData,
  client: SanityClient | null,
  dryRun: boolean,
): Promise<ContentBlock | ContentBlock[] | null> {
  switch (box.type.toLowerCase()) {
    case "text": {
      if (!box.content) return null;

      const portableText = await parseHtmlToPortableText(
        box.content,
        client,
        dryRun,
      );

      if (portableText.length === 0) return null;

      return {
        _type: "contentBlockText",
        _key: `text-${box.boxId}`,
        content: portableText,
      };
    }

    case "hr": {
      return {
        _type: "contentBlockHorizontalLine",
        _key: `hr-${box.boxId}`,
        style: "horizontalLine",
      };
    }

    case "bigimg": {
      // Skip - this is the banner image, handled separately
      console.log(`    ⏭️  Skipping bigimg box (banner image)`);
      return null;
    }

    case "video":
    case "youtube": {
      // YouTube video box - get ID from YoutubeLink field
      if (box.youtubeLink) {
        // Extract YouTube ID from various URL formats
        let youtubeId = box.youtubeLink;

        // Handle full URLs
        const idMatch = box.youtubeLink.match(
          /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
        );
        if (idMatch) {
          youtubeId = idMatch[1];
        }
        // If it's already just an ID (11 characters)
        else if (box.youtubeLink.match(/^[a-zA-Z0-9_-]{11}$/)) {
          youtubeId = box.youtubeLink;
        }

        console.log(`    🎬 YouTube video: ${youtubeId}`);

        return {
          _type: "contentBlockYoutube",
          _key: `yt-${box.boxId}`,
          youtubeId: youtubeId,
        };
      }

      console.log(
        `    ⚠️  Video box ${box.boxId} has no YouTube link - skipping`,
      );
      return null;
    }

    default: {
      console.log(`    ⚠️  Unknown box type: ${box.type}`);
      return null;
    }
  }
}

// ============================================================================
// BRAND UPDATE
// ============================================================================

async function updateBrandWithContentBlocks(
  brand: BrandBoxes,
  client: SanityClient,
  dryRun: boolean,
): Promise<boolean> {
  console.log(`\n🔄 Processing: ${brand.brandName} (ID: ${brand.brandId})`);
  console.log(`   Boxes to process: ${brand.boxes.length}`);

  const contentBlocks: ContentBlock[] = [];

  for (const box of brand.boxes) {
    console.log(
      `   📦 Box ${box.boxId} (type: ${box.type}, sort: ${box.sort})`,
    );

    const result = await convertBoxToContentBlock(box, client, dryRun);

    if (result) {
      if (Array.isArray(result)) {
        contentBlocks.push(...result);
      } else {
        contentBlocks.push(result);
      }
    }
  }

  console.log(`   ✓ Generated ${contentBlocks.length} content blocks`);

  if (dryRun) {
    console.log(`\n   📋 DRY RUN - Would update brand with:`);
    console.log(`      Content blocks: ${contentBlocks.length}`);
    contentBlocks.forEach((block, index) => {
      console.log(`        ${index + 1}. ${block._type}`);
    });
    return true;
  }

  // Find the existing brand document (supports partial name match for cases like "Dan D'Agostino" → "Dan D'Agostino Master Audio Systems")
  const existingBrand = await client.fetch(
    `*[_type == "brand" && (
      _id == $brandId || 
      _id == "brand-${brand.brandId}" ||
      name == $brandName ||
      name match $brandNamePattern
    )][0]._id`,
    {
      brandNamePattern: `${brand.brandName}*`,
      brandId: `brand-${brand.brandId}`,
      brandName: brand.brandName,
    },
  );

  if (!existingBrand) {
    console.error(`   ✗ Brand not found in Sanity: ${brand.brandName}`);
    return false;
  }

  console.log(`   📤 Updating brand: ${existingBrand}`);

  try {
    await client
      .patch(existingBrand)
      .set({ brandContentBlocks: contentBlocks })
      .commit();

    console.log(`   ✅ Successfully updated ${brand.brandName}`);
    return true;
  } catch (error) {
    console.error(`   ✗ Failed to update brand:`, error);
    return false;
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
// MAIN
// ============================================================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let brandName: string | null = null;
  let brandId: string | null = null;
  let dryRun = false;
  let migrateAll = false;

  for (const arg of args) {
    if (arg.startsWith("--name=")) {
      brandName = arg.replace("--name=", "").replace(/"/g, "");
    } else if (arg.startsWith("--id=")) {
      brandId = arg.replace("--id=", "");
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--all") {
      migrateAll = true;
    }
  }

  // Parse CSV file path
  let csvPath = CSV_FILE_PATH;
  const csvArg = args.find((arg) => arg.startsWith("--csv="));
  if (csvArg) {
    csvPath = path.resolve(process.cwd(), csvArg.replace("--csv=", ""));
  }

  if (!brandName && !brandId && !migrateAll) {
    console.error(
      'Usage: bun run migrate-content-blocks.ts --name="BrandName" [--dry-run] [--csv=path/to/file.csv]',
    );
    console.error(
      "       bun run migrate-content-blocks.ts --id=73 [--dry-run]",
    );
    console.error("       bun run migrate-content-blocks.ts --all [--dry-run]");
    process.exit(1);
  }

  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║           BRAND CONTENT BLOCKS MIGRATION                       ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);

  // Check CSV file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`\n✗ CSV file not found: ${csvPath}`);
    console.error(
      "  Please provide a valid CSV file path with --csv=path/to/file.csv",
    );
    process.exit(1);
  }

  // Parse CSV
  console.log(`\n📄 Reading CSV: ${csvPath}`);
  const rows = parseCSV(csvPath);
  console.log(`  Found ${rows.length} rows`);

  // Group by brand
  const brands = groupBoxesByBrand(rows);
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

  // Collect brands to process
  let brandsToProcess: BrandBoxes[] = [];

  if (migrateAll) {
    brandsToProcess = Array.from(brands.values());
    console.log(`\n📋 Will process ${brandsToProcess.length} brands`);
  } else if (brandName) {
    const normalizedName = brandName.toLowerCase().trim();
    const brand = Array.from(brands.values()).find(
      (b) => b.brandName.toLowerCase().trim() === normalizedName,
    );

    if (!brand) {
      console.error(`\n✗ Brand not found: "${brandName}"`);
      console.log("\nAvailable brands:");
      for (const b of brands.values()) {
        console.log(`  - ${b.brandName} (ID: ${b.brandId})`);
      }
      process.exit(1);
    }
    brandsToProcess = [brand];
  } else if (brandId) {
    const brand = brands.get(brandId);
    if (!brand) {
      console.error(`\n✗ Brand ID not found: ${brandId}`);
      process.exit(1);
    }
    brandsToProcess = [brand];
  }

  // Process each brand
  const results = {
    success: [] as string[],
    failed: [] as string[],
  };

  for (let i = 0; i < brandsToProcess.length; i++) {
    const brand = brandsToProcess[i];

    console.log(
      "\n═══════════════════════════════════════════════════════════════════",
    );
    console.log(
      `🏷️  [${i + 1}/${brandsToProcess.length}] ${brand.brandName} (ID: ${brand.brandId})`,
    );
    console.log(
      "═══════════════════════════════════════════════════════════════════",
    );

    try {
      const success = await updateBrandWithContentBlocks(
        brand,
        client!,
        dryRun,
      );

      if (success) {
        results.success.push(brand.brandName);
      } else {
        results.failed.push(brand.brandName);
      }
    } catch (error) {
      console.error(`\n✗ Error processing ${brand.brandName}:`, error);
      results.failed.push(brand.brandName);
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
  if (results.success.length > 0 && results.success.length <= 20) {
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
