/**
 * HTML to Portable Text Parser for Review Content
 *
 * Transforms legacy HTML content from Box records to Sanity Portable Text,
 * handling:
 * - Text blocks: paragraphs, headings (ALL → h2), lists
 * - Links: External URLs and SilverStripe shortcodes ([sitetree_link], [product_link])
 * - Images: <img> tags → ptImage placeholders
 * - Horizontal lines: <hr> tags
 *
 * Note: Page breaks (<!-- pagebreak -->) are REMOVED, not converted
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "csv-parse/sync";

import type {
  ImagePlaceholder,
  MarkDef,
  PortableTextBlock,
  PortableTextSpan,
  PtHorizontalLine,
  ReviewPortableTextContent,
} from "../types";

// ============================================================================
// Link Resolution CSV Configuration
// ============================================================================

const DEFAULT_PRODUCT_SLUGS_CSV_PATH =
  "csv/products/product-brand-slug-map.csv";
const DEFAULT_SITETREE_CSV_PATH = "csv/products/sitetree-map.csv";

// Mapping caches (loaded lazily)
let productSlugMap: Map<string, string> | null = null;
let sitetreeMap: Map<
  string,
  { urlSegment: string; className: string; linkedProductId: string | null }
> | null = null;

type ProductSlugRow = {
  ProductID: string;
  ProductURLSegment: string;
  BrandURLSegment: string;
  FullPath: string;
  Title: string;
};

type SiteTreeRow = {
  SiteTreeID: string;
  URLSegment: string;
  ClassName: string;
  Title: string;
  ParentID: string;
  LinkedProductID: string | null;
};

/**
 * Read CSV file and parse into rows
 */
function readCsvRows<T>(csvPath: string): T[] {
  try {
    const resolved = resolve(process.cwd(), csvPath);
    const file = readFileSync(resolved, "utf-8");
    return parse(file, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as T[];
  } catch (err) {
    console.warn(
      `   ⚠️  Could not read CSV ${csvPath}: ${err instanceof Error ? err.message : err}`,
    );
    return [];
  }
}

/**
 * Load product slug mappings from CSV
 * Maps ProductID → FullPath (e.g., "audioresearch/ref160m")
 */
function loadProductSlugMap(): Map<string, string> {
  if (productSlugMap) return productSlugMap;

  const rows = readCsvRows<ProductSlugRow>(DEFAULT_PRODUCT_SLUGS_CSV_PATH);
  productSlugMap = new Map<string, string>();

  for (const row of rows) {
    const productId = row.ProductID;
    const fullPath = row.FullPath;
    if (productId && fullPath) {
      productSlugMap.set(productId, fullPath);
    }
  }

  if (productSlugMap.size > 0) {
    console.log(`   📂 Loaded ${productSlugMap.size} product slug mappings`);
  }
  return productSlugMap;
}

/**
 * Load sitetree mappings from CSV
 * Maps SiteTreeID → { urlSegment, className, linkedProductId }
 */
function loadSiteTreeMap(): Map<
  string,
  { urlSegment: string; className: string; linkedProductId: string | null }
> {
  if (sitetreeMap) return sitetreeMap;

  const rows = readCsvRows<SiteTreeRow>(DEFAULT_SITETREE_CSV_PATH);
  sitetreeMap = new Map();

  for (const row of rows) {
    const siteTreeId = row.SiteTreeID;
    if (siteTreeId) {
      sitetreeMap.set(siteTreeId, {
        urlSegment: row.URLSegment || "",
        className: row.ClassName || "",
        linkedProductId: row.LinkedProductID || null,
      });
    }
  }

  if (sitetreeMap.size > 0) {
    console.log(`   📂 Loaded ${sitetreeMap.size} sitetree mappings`);
  }
  return sitetreeMap;
}

/**
 * Get product full path by ID (e.g., "audioresearch/ref160m")
 */
function getProductFullPathById(productId: string): string | null {
  const slugMap = loadProductSlugMap();
  return slugMap.get(productId) || null;
}

/**
 * Resolve a SiteTree ID to a URL
 * - If it's a ProductLink, resolve via product mapping to get brand/product path
 * - Otherwise, use the URLSegment directly
 */
function resolveSiteTreeId(siteTreeId: string): string | null {
  const map = loadSiteTreeMap();
  const entry = map.get(siteTreeId);

  if (!entry) {
    // Silent fail for missing entries - don't spam logs
    return null;
  }

  // If it's a ProductLink, resolve the product URL using original brand/product format
  if (entry.className === "ProductLink" && entry.linkedProductId) {
    const productPath = getProductFullPathById(entry.linkedProductId);
    if (productPath) {
      return `https://www.audiofast.pl/${productPath}`;
    }
  }

  // For other page types, return the URL segment as legacy site URL
  if (entry.urlSegment) {
    return `https://www.audiofast.pl/${entry.urlSegment}`;
  }

  return null;
}

/**
 * Resolve SilverStripe link shortcodes to actual URLs
 * - [product_link,id=X] → https://www.audiofast.pl/{brand}/{product}
 * - [sitetree_link,id=X] → resolved via sitetree mapping CSV
 * - External URLs: kept as-is
 * - Internal/relative URLs: prefixed with https://www.audiofast.pl/
 */
function resolveSilverStripeLink(url: string): string {
  if (!url) return "#";

  // Handle product_link shortcode: [product_link,id=X]
  const productMatch = url.match(/\[product_link,id=(\d+)\]/);
  if (productMatch) {
    const productId = productMatch[1];
    const fullPath = getProductFullPathById(productId);
    if (fullPath) {
      return `https://www.audiofast.pl/${fullPath}`;
    }
    return "#";
  }

  // Handle sitetree_link shortcode: [sitetree_link,id=X]
  const sitetreeMatch = url.match(/\[sitetree_link,id=(\d+)\]/);
  if (sitetreeMatch) {
    const siteTreeId = sitetreeMatch[1];
    const resolvedUrl = resolveSiteTreeId(siteTreeId);
    if (resolvedUrl) {
      return resolvedUrl;
    }
    return "#";
  }

  // If URL starts with audiofast.pl (without https://), add protocol
  if (url.startsWith("audiofast.pl") || url.startsWith("www.audiofast.pl")) {
    return `https://${url}`;
  }

  // External URLs (http:// or https://) - return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Relative URLs starting with /
  if (url.startsWith("/")) {
    return `https://www.audiofast.pl${url}`;
  }

  // Other relative URLs (no leading /)
  return `https://www.audiofast.pl/${url}`;
}

// ============================================================================
// Helpers
// ============================================================================

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cleanString(value: string | null | undefined): string {
  if (value === undefined || value === null) return "";
  const cleaned = value.replace(/\u00a0/g, " ").trim();
  if (!cleaned || cleaned.toLowerCase() === "null") return "";
  return cleaned;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// Inline Content Parsing
// ============================================================================

/**
 * Parse inline HTML content into Portable Text spans with proper marks
 * Handles: links, strong/bold, em/italic, and line breaks
 */
function parseInlineContent(html: string): {
  children: PortableTextSpan[];
  markDefs: MarkDef[];
} {
  const markDefs: MarkDef[] = [];

  // Remove images from the content (handled separately)
  let content = html.replace(/<img[^>]*>/gi, "");

  // Handle "first-big-letter" pattern: <span class="first-big-letter...">X</span><strong>rest</strong>
  content = content.replace(
    /<span[^>]*class="[^"]*first-big-letter[^"]*"[^>]*>([^<]*)<\/span>\s*<strong([^>]*)>/gi,
    "<strong$2>$1",
  );

  // Also handle when first-big-letter is followed by text without strong
  content = content.replace(
    /<span[^>]*class="[^"]*first-big-letter[^"]*"[^>]*>([^<]*)<\/span>/gi,
    "$1",
  );

  // Replace <br> tags with a special marker
  content = content.replace(/<br\s*\/?>/gi, "|||BR|||");

  // Extract and process links first (replace with placeholders)
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links: Array<{
    url: string;
    text: string;
    key: string;
    placeholder: string;
  }> = [];
  let linkIndex = 0;

  content = content.replace(linkRegex, (_match, url, text) => {
    const key = `link-${generateKey()}`;
    // Resolve URL using SilverStripe link resolver
    const resolvedUrl = resolveSilverStripeLink(url);

    const placeholder = `|||LINK${linkIndex}|||`;
    // Strip HTML from link text but preserve strong/em placeholders
    const cleanText = text
      .replace(/<strong[^>]*>/gi, "|||STRONG_START|||")
      .replace(/<\/strong>/gi, "|||STRONG_END|||")
      .replace(/<b[^>]*>/gi, "|||STRONG_START|||")
      .replace(/<\/b>/gi, "|||STRONG_END|||")
      .replace(/<em[^>]*>/gi, "|||EM_START|||")
      .replace(/<\/em>/gi, "|||EM_END|||")
      .replace(/<i[^>]*>/gi, "|||EM_START|||")
      .replace(/<\/i>/gi, "|||EM_END|||")
      .replace(/<[^>]+>/g, "");
    links.push({
      url: resolvedUrl,
      text: cleanText,
      key,
      placeholder,
    });
    linkIndex++;
    return placeholder;
  });

  // Create mark definitions for links
  for (const link of links) {
    markDefs.push({
      _type: "customLink",
      _key: link.key,
      customLink: {
        type: "external",
        openInNewTab: true,
        external: link.url,
      },
    });
  }

  // Replace strong/bold tags with markers
  content = content.replace(/<strong[^>]*>/gi, "|||STRONG_START|||");
  content = content.replace(/<\/strong>/gi, "|||STRONG_END|||");
  content = content.replace(/<b[^>]*>/gi, "|||STRONG_START|||");
  content = content.replace(/<\/b>/gi, "|||STRONG_END|||");

  // Replace em/italic tags with markers
  content = content.replace(/<em[^>]*>/gi, "|||EM_START|||");
  content = content.replace(/<\/em>/gi, "|||EM_END|||");
  content = content.replace(/<i[^>]*>/gi, "|||EM_START|||");
  content = content.replace(/<\/i>/gi, "|||EM_END|||");

  // Strip remaining HTML tags (like span)
  content = content.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  content = content
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Parse the content into spans with marks
  const children: PortableTextSpan[] = [];
  let currentText = "";
  let inStrong = false;
  let inEm = false;

  // Tokenize content
  const tokenRegex =
    /(\|\|\|(?:STRONG_START|STRONG_END|EM_START|EM_END|BR|LINK\d+)\|\|\|)/g;
  const parts = content.split(tokenRegex);

  const flushSpan = () => {
    if (currentText) {
      const marks: string[] = [];
      if (inStrong) marks.push("strong");
      if (inEm) marks.push("em");

      children.push({
        _type: "span",
        _key: generateKey(),
        text: currentText,
        marks: marks.length > 0 ? marks : [],
      });
      currentText = "";
    }
  };

  for (const part of parts) {
    if (!part) continue;

    if (part === "|||STRONG_START|||") {
      flushSpan();
      inStrong = true;
    } else if (part === "|||STRONG_END|||") {
      flushSpan();
      inStrong = false;
    } else if (part === "|||EM_START|||") {
      flushSpan();
      inEm = true;
    } else if (part === "|||EM_END|||") {
      flushSpan();
      inEm = false;
    } else if (part === "|||BR|||") {
      flushSpan();
      // Add a newline character as a separate span
      children.push({
        _type: "span",
        _key: generateKey(),
        text: "\n",
        marks: [],
      });
    } else if (part.match(/^\|\|\|LINK(\d+)\|\|\|$/)) {
      flushSpan();
      const linkIdx = parseInt(part.match(/LINK(\d+)/)![1], 10);
      const linkInfo = links[linkIdx];
      if (linkInfo) {
        // Parse link text for any internal formatting markers
        const linkParts = linkInfo.text.split(
          /(\|\|\|(?:STRONG_START|STRONG_END|EM_START|EM_END)\|\|\|)/,
        );
        let linkInStrong = inStrong;
        let linkInEm = inEm;

        for (const linkPart of linkParts) {
          if (!linkPart) continue;

          if (linkPart === "|||STRONG_START|||") {
            linkInStrong = true;
          } else if (linkPart === "|||STRONG_END|||") {
            linkInStrong = false;
          } else if (linkPart === "|||EM_START|||") {
            linkInEm = true;
          } else if (linkPart === "|||EM_END|||") {
            linkInEm = false;
          } else if (linkPart.trim()) {
            const linkMarks: string[] = [linkInfo.key];
            if (linkInStrong) linkMarks.push("strong");
            if (linkInEm) linkMarks.push("em");

            children.push({
              _type: "span",
              _key: generateKey(),
              text: linkPart,
              marks: linkMarks,
            });
          }
        }
      }
    } else {
      currentText += part;
    }
  }

  // Flush any remaining text
  flushSpan();

  // If no children were created, add empty span
  if (children.length === 0) {
    children.push({
      _type: "span",
      _key: generateKey(),
      text: "",
      marks: [],
    });
  }

  return { children, markDefs };
}

/**
 * Create a text block
 */
function createTextBlock(
  text: string,
  style: "normal" | "h2" = "normal",
): PortableTextBlock {
  return {
    _type: "block",
    _key: generateKey(),
    style,
    markDefs: [],
    children: [
      {
        _type: "span",
        _key: generateKey(),
        text: text.trim(),
      },
    ],
  };
}

/**
 * Create a horizontal line block
 */
function createHorizontalLine(): PtHorizontalLine {
  return {
    _type: "ptHorizontalLine",
    _key: generateKey(),
    style: "horizontalLine",
  };
}

// ============================================================================
// Block Matching Types
// ============================================================================

type BlockMatch = {
  index: number;
  type: string;
  content: string;
  fullMatch: string;
  imageData?: {
    src: string;
    alt: string;
  };
};

// ============================================================================
// Main HTML to Portable Text Conversion
// ============================================================================

/**
 * Convert HTML string to Portable Text content blocks for reviews
 * Returns array of PortableTextContent items
 *
 * Key differences from product parser:
 * - Pagebreaks (<!-- pagebreak -->) are REMOVED, not converted
 * - Supports h2 style (reviews allow h2)
 * - Returns ImagePlaceholder for deferred upload
 */
export function htmlToPortableText(
  html: string | null,
): (ReviewPortableTextContent | ImagePlaceholder)[] {
  if (!html) return [];

  const blocks: (ReviewPortableTextContent | ImagePlaceholder)[] = [];
  let content = html;

  // Normalize whitespace first
  content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // REMOVE pagebreak comments (don't convert, just strip)
  content = content.replace(/<!--\s*pagebreak\s*-->/gi, "");

  // Also remove <p><!-- pagebreak --></p> pattern
  content = content.replace(/<p[^>]*>\s*<!--\s*pagebreak\s*-->\s*<\/p>/gi, "");

  // Remove other HTML comments
  content = content.replace(/<!--[\s\S]*?-->/g, "");

  // Extract <img> tags for processing
  const imgMatches: BlockMatch[] = [];
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(content)) !== null) {
    const altMatch = imgMatch[0].match(/alt=["']([^"']*)["']/i);
    imgMatches.push({
      index: imgMatch.index,
      type: "img",
      content: imgMatch[1],
      fullMatch: imgMatch[0],
      imageData: {
        src: imgMatch[1],
        alt: altMatch ? altMatch[1] : "",
      },
    });
  }

  // Find all block elements
  const allMatches: BlockMatch[] = [];

  // Find headings (h1-h6)
  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: match[1].toLowerCase(),
      content: match[2],
      fullMatch: match[0],
    });
  }

  // Find paragraphs
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = pRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: "p",
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Find unordered lists
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  while ((match = ulRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: "ul",
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Find ordered lists
  const olRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  while ((match = olRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: "ol",
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Find horizontal lines (<hr> tags)
  const hrRegex = /<hr\s*\/?>/gi;
  while ((match = hrRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: "hr",
      content: "",
      fullMatch: match[0],
    });
  }

  // Add images to allMatches
  allMatches.push(...imgMatches);

  // Sort by index to process in document order
  allMatches.sort((a, b) => a.index - b.index);

  // Process each match
  for (const m of allMatches) {
    const tagName = m.type;
    const innerContent = m.content;

    // Handle <hr> tags
    if (tagName === "hr") {
      blocks.push(createHorizontalLine());
      continue;
    }

    // Handle <img> tags → ImagePlaceholder
    if (tagName === "img" && m.imageData) {
      let imgSrc = m.imageData.src;
      // Make sure the src is a full URL
      if (!imgSrc.startsWith("http")) {
        if (imgSrc.startsWith("assets/") || imgSrc.startsWith("/assets/")) {
          imgSrc = imgSrc.startsWith("/")
            ? `https://www.audiofast.pl${imgSrc}`
            : `https://www.audiofast.pl/${imgSrc}`;
        } else if (imgSrc.startsWith("/")) {
          imgSrc = `https://www.audiofast.pl${imgSrc}`;
        }
      }

      blocks.push({
        _type: "imagePlaceholder",
        _key: generateKey(),
        src: imgSrc,
        alt: m.imageData.alt,
      } as ImagePlaceholder);
      continue;
    }

    // Handle headings - ALL headings → h2
    if (tagName.startsWith("h")) {
      const textContent = stripHtmlTags(innerContent).trim();
      if (textContent) {
        blocks.push(createTextBlock(textContent, "h2"));
      }
      continue;
    }

    // Handle unordered lists
    if (tagName === "ul") {
      const listItems = innerContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      for (const li of listItems) {
        const itemContent = li.replace(/<\/?li[^>]*>/gi, "");
        const { children, markDefs } = parseInlineContent(itemContent);
        if (children.length > 0 && children.some((c) => c.text.trim())) {
          const block: PortableTextBlock = {
            _type: "block",
            _key: generateKey(),
            style: "normal",
            markDefs,
            children,
            listItem: "bullet",
            level: 1,
          };
          blocks.push(block);
        }
      }
      continue;
    }

    // Handle ordered lists
    if (tagName === "ol") {
      const listItems = innerContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      for (const li of listItems) {
        const itemContent = li.replace(/<\/?li[^>]*>/gi, "");
        const { children, markDefs } = parseInlineContent(itemContent);
        if (children.length > 0 && children.some((c) => c.text.trim())) {
          const block: PortableTextBlock = {
            _type: "block",
            _key: generateKey(),
            style: "normal",
            markDefs,
            children,
            listItem: "number",
            level: 1,
          };
          blocks.push(block);
        }
      }
      continue;
    }

    // Handle paragraphs
    if (tagName === "p") {
      // Check if paragraph only contains whitespace or &nbsp;
      const textContent = stripHtmlTags(innerContent).trim();
      if (
        !textContent ||
        textContent === "&nbsp;" ||
        textContent === "\u00a0"
      ) {
        continue;
      }

      const { children, markDefs } = parseInlineContent(innerContent);
      if (children.length > 0 && children.some((c) => c.text.trim())) {
        blocks.push({
          _type: "block",
          _key: generateKey(),
          style: "normal",
          markDefs,
          children,
        });
      }
    }
  }

  return blocks;
}

/**
 * Strip HTML and get plain text (for descriptions)
 */
export function htmlToPlainText(html: string | null): string {
  if (!html) return "";

  return html
    .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
    .replace(/<br\s*\/?>/gi, "\n") // Replace <br> with newlines
    .replace(/<\/p>/gi, "\n\n") // Replace </p> with double newlines
    .replace(/<[^>]+>/g, "") // Strip all HTML tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
