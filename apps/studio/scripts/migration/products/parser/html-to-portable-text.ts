/**
 * HTML to Portable Text Parser for Product Details Content
 *
 * Transforms legacy HTML content from Box records to Sanity Portable Text,
 * handling:
 * - Text blocks: paragraphs, headings (all → h3), lists
 * - Links: External URLs and SilverStripe shortcodes ([sitetree_link], [product_link])
 * - Images: Inline images and [image src="..."] shortcodes → ptMinimalImage placeholders
 * - Videos: YouTube/Vimeo iframes
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'csv-parse/sync';

import type {
  ContentBlockHorizontalLine,
  ContentBlockVimeo,
  ContentBlockYoutube,
  MarkDef,
  PortableTextBlock,
  PortableTextContent,
  PortableTextSpan,
  PtHorizontalLine,
  PtInlineImage,
  PtMinimalImage,
  PtPageBreak,
  PtReviewEmbed,
  PtVimeoVideo,
  PtYoutubeVideo,
} from '../types';

// ============================================================================
// Link Resolution CSV Configuration
// ============================================================================

const DEFAULT_PRODUCT_SLUGS_CSV_PATH =
  'csv/products/product-brand-slug-map.csv';
const DEFAULT_SITETREE_CSV_PATH = 'csv/products/sitetree-map.csv';

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
    const file = readFileSync(resolved, 'utf-8');
    return parse(file, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as T[];
  } catch (err) {
    console.warn(
      `   ⚠️  Could not read CSV ${csvPath}: ${err instanceof Error ? err.message : err}`
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
        urlSegment: row.URLSegment || '',
        className: row.ClassName || '',
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
 * Preserves original legacy URLs (e.g., https://www.audiofast.pl/audioresearch/ref160m)
 * - If it's a ProductLink, resolve via product mapping to get brand/product path
 * - Otherwise, use the URLSegment directly
 */
function resolveSiteTreeId(siteTreeId: string): string | null {
  const map = loadSiteTreeMap();
  const entry = map.get(siteTreeId);

  if (!entry) {
    console.warn(`   ⚠️  SiteTree ID ${siteTreeId} not found in mapping`);
    return null;
  }

  // If it's a ProductLink, resolve the product URL using original brand/product format
  if (entry.className === 'ProductLink' && entry.linkedProductId) {
    const productPath = getProductFullPathById(entry.linkedProductId);
    if (productPath) {
      // Return as legacy URL: https://www.audiofast.pl/{brand}/{product}
      return `https://www.audiofast.pl/${productPath}`;
    }
  }

  // For other page types, return the URL segment as legacy site URL
  if (entry.urlSegment) {
    return `https://www.audiofast.pl/${entry.urlSegment}`;
  }

  return null;
}

// ============================================================================
// Helpers
// ============================================================================

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cleanString(value: string | null | undefined): string {
  if (value === undefined || value === null) return '';
  const cleaned = value.replace(/\u00a0/g, ' ').trim();
  if (!cleaned || cleaned.toLowerCase() === 'null') return '';
  return cleaned;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Link Resolution
// ============================================================================

/**
 * Resolve SilverStripe link shortcodes to actual URLs
 * - [product_link,id=X] → https://www.audiofast.pl/{brand}/{product}
 * - [sitetree_link,id=X] → resolved via sitetree mapping CSV
 * - External URLs: kept as-is
 * - Internal/relative URLs: prefixed with https://www.audiofast.pl/
 */
function resolveSilverStripeLink(url: string): string {
  if (!url) return '#';

  // Handle product_link shortcode: [product_link,id=X]
  // Uses product-brand-slug-mapping.csv for full path (e.g., "audioresearch/ref160m")
  const productMatch = url.match(/\[product_link,id=(\d+)\]/);
  if (productMatch) {
    const productId = productMatch[1];
    const fullPath = getProductFullPathById(productId);
    if (fullPath) {
      return `https://www.audiofast.pl/${fullPath}`;
    }
    console.warn(`   ⚠️  Product ID ${productId} not found in product mapping`);
    return '#';
  }

  // Handle sitetree_link shortcode: [sitetree_link,id=X]
  // Uses site-tree.csv for URL resolution
  const sitetreeMatch = url.match(/\[sitetree_link,id=(\d+)\]/);
  if (sitetreeMatch) {
    const siteTreeId = sitetreeMatch[1];
    const resolvedUrl = resolveSiteTreeId(siteTreeId);
    if (resolvedUrl) {
      return resolvedUrl;
    }
    console.warn(`   ⚠️  SiteTree ID ${siteTreeId} could not be resolved`);
    return '#';
  }

  // If URL starts with audiofast.pl (without https://), add protocol
  if (url.startsWith('audiofast.pl') || url.startsWith('www.audiofast.pl')) {
    return `https://${url}`;
  }

  // External URLs (http:// or https://) - return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Relative URLs starting with /
  if (url.startsWith('/')) {
    return `https://www.audiofast.pl${url}`;
  }

  // Other relative URLs (no leading /)
  return `https://www.audiofast.pl/${url}`;
}

// ============================================================================
// Video Extraction
// ============================================================================

/**
 * Extract YouTube ID from URL
 */
export function extractYouTubeId(url: string | null): string | null {
  if (!url) return null;
  const cleaned = cleanString(url);
  if (!cleaned) return null;

  // Already just an ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) {
    return cleaned;
  }

  // Various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/(?:embed\/|watch\?v=|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract Vimeo ID from URL
 */
export function extractVimeoId(url: string | null): string | null {
  if (!url) return null;
  const cleaned = cleanString(url);
  if (!cleaned) return null;

  // Match Vimeo URL formats
  const vimeoMatch = cleaned.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return vimeoMatch ? vimeoMatch[1] : null;
}

// ============================================================================
// Placeholder Types
// ============================================================================

export interface ImagePlaceholder {
  _type: 'imagePlaceholder';
  _key: string;
  src: string;
  alt: string;
  float?: 'left' | 'right'; // For inline images with text wrap
  width?: number; // Original width from shortcode
  height?: number; // Original height from shortcode
}

export interface ReviewEmbedPlaceholder {
  _type: 'ptReviewEmbed';
  _key: string;
  legacyReviewId: string; // Will be resolved to Sanity reference in transformer
}

// ============================================================================
// HTML Parsing
// ============================================================================

type BlockMatch = {
  index: number;
  type: string;
  content: string;
  fullMatch: string;
  imageData?: {
    src: string;
    alt: string;
    float?: 'left' | 'right';
    width?: number;
    height?: number;
  };
  videoId?: string;
};

/**
 * Parse inline HTML content into Portable Text spans with proper marks
 * Handles: links, strong/bold, em/italic, and line breaks
 */
function parseInlineContent(html: string): {
  children: PortableTextSpan[];
  markDefs: MarkDef[];
  hasLineBreaks: boolean;
} {
  const markDefs: MarkDef[] = [];

  // Remove images from the content (handled separately)
  let content = html.replace(/<img[^>]*>/gi, '');

  // Remove SilverStripe image shortcodes (handled separately)
  content = content.replace(/\[image\s+[^\]]+\]/gi, '');

  // Remove [recenzja id=X] shortcodes (handled as separate ptReviewEmbed blocks)
  content = content.replace(/\[recenzja\s+id=\d+\]/gi, '');

  // Handle "first-big-letter" pattern: <span class="first-big-letter...">X</span><strong>rest</strong>
  // Merge them into a single <strong> tag so the whole word is bold
  content = content.replace(
    /<span[^>]*class="[^"]*first-big-letter[^"]*"[^>]*>([^<]*)<\/span>\s*<strong([^>]*)>/gi,
    '<strong$2>$1'
  );

  // Also handle when first-big-letter is followed by text without strong (just extract the letter)
  content = content.replace(
    /<span[^>]*class="[^"]*first-big-letter[^"]*"[^>]*>([^<]*)<\/span>/gi,
    '$1'
  );

  // Check if content has line breaks
  const hasLineBreaks = /<br\s*\/?>/i.test(content);

  // Replace <br> tags with a special marker
  content = content.replace(/<br\s*\/?>/gi, '|||BR|||');

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
    const resolvedUrl = resolveSilverStripeLink(url);
    const placeholder = `|||LINK${linkIndex}|||`;
    // Strip HTML from link text but preserve strong/em placeholders
    const cleanText = text
      .replace(/<strong[^>]*>/gi, '|||STRONG_START|||')
      .replace(/<\/strong>/gi, '|||STRONG_END|||')
      .replace(/<b[^>]*>/gi, '|||STRONG_START|||')
      .replace(/<\/b>/gi, '|||STRONG_END|||')
      .replace(/<em[^>]*>/gi, '|||EM_START|||')
      .replace(/<\/em>/gi, '|||EM_END|||')
      .replace(/<i[^>]*>/gi, '|||EM_START|||')
      .replace(/<\/i>/gi, '|||EM_END|||')
      .replace(/<[^>]+>/g, '');
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
      _type: 'customLink',
      _key: link.key,
      customLink: {
        type: 'external',
        openInNewTab: true,
        external: link.url,
      },
    });
  }

  // Replace strong/bold tags with markers
  content = content.replace(/<strong[^>]*>/gi, '|||STRONG_START|||');
  content = content.replace(/<\/strong>/gi, '|||STRONG_END|||');
  content = content.replace(/<b[^>]*>/gi, '|||STRONG_START|||');
  content = content.replace(/<\/b>/gi, '|||STRONG_END|||');

  // Replace em/italic tags with markers
  content = content.replace(/<em[^>]*>/gi, '|||EM_START|||');
  content = content.replace(/<\/em>/gi, '|||EM_END|||');
  content = content.replace(/<i[^>]*>/gi, '|||EM_START|||');
  content = content.replace(/<\/i>/gi, '|||EM_END|||');

  // Strip remaining HTML tags (like span)
  content = content.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  content = content
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Parse the content into spans with marks
  const children: PortableTextSpan[] = [];
  let currentText = '';
  let inStrong = false;
  let inEm = false;
  let currentLinkKey: string | null = null;

  // Tokenize content using regex to properly split
  const tokenRegex =
    /(\|\|\|(?:STRONG_START|STRONG_END|EM_START|EM_END|BR|LINK\d+)\|\|\|)/g;
  const parts = content.split(tokenRegex);

  const flushSpan = () => {
    if (currentText) {
      const marks: string[] = [];
      if (inStrong) marks.push('strong');
      if (inEm) marks.push('em');
      if (currentLinkKey) marks.push(currentLinkKey);

      children.push({
        _type: 'span',
        _key: generateKey(),
        text: currentText,
        marks: marks.length > 0 ? marks : [],
      });
      currentText = '';
    }
  };

  for (const part of parts) {
    if (!part) continue;

    if (part === '|||STRONG_START|||') {
      flushSpan();
      inStrong = true;
    } else if (part === '|||STRONG_END|||') {
      flushSpan();
      inStrong = false;
    } else if (part === '|||EM_START|||') {
      flushSpan();
      inEm = true;
    } else if (part === '|||EM_END|||') {
      flushSpan();
      inEm = false;
    } else if (part === '|||BR|||') {
      flushSpan();
      // Add a newline character as a separate span
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: '\n',
        marks: [],
      });
    } else if (part.match(/^\|\|\|LINK(\d+)\|\|\|$/)) {
      flushSpan();
      const linkIdx = parseInt(part.match(/LINK(\d+)/)![1], 10);
      const linkInfo = links[linkIdx];
      if (linkInfo) {
        // Parse link text for any internal formatting markers
        const linkParts = linkInfo.text.split(
          /(\|\|\|(?:STRONG_START|STRONG_END|EM_START|EM_END)\|\|\|)/
        );
        let linkInStrong = inStrong;
        let linkInEm = inEm;

        for (const linkPart of linkParts) {
          if (!linkPart) continue;

          if (linkPart === '|||STRONG_START|||') {
            linkInStrong = true;
          } else if (linkPart === '|||STRONG_END|||') {
            linkInStrong = false;
          } else if (linkPart === '|||EM_START|||') {
            linkInEm = true;
          } else if (linkPart === '|||EM_END|||') {
            linkInEm = false;
          } else if (linkPart.trim()) {
            const linkMarks: string[] = [linkInfo.key];
            if (linkInStrong) linkMarks.push('strong');
            if (linkInEm) linkMarks.push('em');

            children.push({
              _type: 'span',
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
      _type: 'span',
      _key: generateKey(),
      text: '',
      marks: [],
    });
  }

  return { children, markDefs, hasLineBreaks };
}

/**
 * Create a text block with h3 style (product details only support h3)
 */
function createTextBlock(
  text: string,
  style: 'normal' | 'h3' = 'normal'
): PortableTextBlock {
  return {
    _type: 'block',
    _key: generateKey(),
    style,
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: generateKey(),
        text: text.trim(),
      },
    ],
  };
}

// ============================================================================
// Main HTML to Portable Text Conversion
// ============================================================================

/**
 * Convert HTML string to Portable Text content blocks
 * Returns PortableTextContent items for use inside contentBlockText
 * All headings (h1-h6) are normalized to h3 per product schema
 */
export function htmlToPortableText(
  html: string | null
): (PortableTextContent | ImagePlaceholder)[] {
  if (!html) return [];

  const blocks: (PortableTextContent | ImagePlaceholder)[] = [];
  let content = html;

  // Normalize whitespace first
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract pagebreak comments BEFORE removing other comments
  // These will be converted to ptPageBreak blocks
  const pagebreakMatches: BlockMatch[] = [];
  const pagebreakRegex = /<!--\s*pagebreak\s*-->/gi;
  let pbMatch;
  while ((pbMatch = pagebreakRegex.exec(content)) !== null) {
    pagebreakMatches.push({
      index: pbMatch.index,
      type: 'pagebreak',
      content: '',
      fullMatch: pbMatch[0],
    });
  }

  // Remove other HTML comments (but pagebreaks are already captured)
  content = content.replace(/<!--(?!\s*pagebreak)[\s\S]*?-->/g, '');

  // Extract SilverStripe image shortcodes: [image src="..." title="..." class="..." width="..." height="..." ...]
  const ssImageMatches: BlockMatch[] = [];
  const ssImageRegex = /\[image\s+([^\]]+)\]/gi;
  let ssMatch;
  while ((ssMatch = ssImageRegex.exec(content)) !== null) {
    const attrs = ssMatch[1];
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const titleMatch = attrs.match(/title=["']([^"']+)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']+)["']/i);
    const classMatch = attrs.match(/class=["']([^"']+)["']/i);
    const widthMatch = attrs.match(/width=["']?(\d+)["']?/i);
    const heightMatch = attrs.match(/height=["']?(\d+)["']?/i);

    if (srcMatch) {
      let imgSrc = srcMatch[1];
      // Make sure the src is a full URL
      if (!imgSrc.startsWith('http')) {
        if (imgSrc.startsWith('assets/') || imgSrc.startsWith('/assets/')) {
          imgSrc = imgSrc.startsWith('/')
            ? `https://www.audiofast.pl${imgSrc}`
            : `https://www.audiofast.pl/${imgSrc}`;
        } else if (imgSrc.startsWith('/')) {
          imgSrc = `https://www.audiofast.pl${imgSrc}`;
        }
      }

      // Check for float class (strict match: only "left" or "right", not "leftAlone", etc.)
      let floatValue: 'left' | 'right' | undefined;
      if (classMatch) {
        const classes = classMatch[1].split(/\s+/);
        if (classes.includes('left')) {
          floatValue = 'left';
        } else if (classes.includes('right')) {
          floatValue = 'right';
        }
      }

      // Parse width and height
      const width = widthMatch ? parseInt(widthMatch[1], 10) : undefined;
      const height = heightMatch ? parseInt(heightMatch[1], 10) : undefined;

      ssImageMatches.push({
        index: ssMatch.index,
        type: 'ssImage',
        content: imgSrc,
        fullMatch: ssMatch[0],
        imageData: {
          src: imgSrc,
          alt: titleMatch ? titleMatch[1] : altMatch ? altMatch[1] : '',
          float: floatValue,
          width,
          height,
        },
      });
    }
  }

  // Extract YouTube iframes
  const youtubeIframeRegex =
    /<iframe[^>]*src=["'](?:https?:)?\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi;
  const youtubeMatches: BlockMatch[] = [];
  let ytMatch;
  while ((ytMatch = youtubeIframeRegex.exec(content)) !== null) {
    youtubeMatches.push({
      index: ytMatch.index,
      type: 'youtubeIframe',
      content: ytMatch[1],
      fullMatch: ytMatch[0],
      videoId: ytMatch[1],
    });
  }

  // Extract Vimeo iframes
  const vimeoIframeRegex =
    /<iframe[^>]*src=["'](?:https?:)?\/\/(?:player\.)?vimeo\.com\/video\/(\d+)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi;
  const vimeoMatches: BlockMatch[] = [];
  let vimeoMatch;
  while ((vimeoMatch = vimeoIframeRegex.exec(content)) !== null) {
    vimeoMatches.push({
      index: vimeoMatch.index,
      type: 'vimeoIframe',
      content: vimeoMatch[1],
      fullMatch: vimeoMatch[0],
      videoId: vimeoMatch[1],
    });
  }

  // Extract [recenzja id=X] shortcodes for inline review embeds
  const reviewMatches: BlockMatch[] = [];
  const reviewRegex = /\[recenzja\s+id=(\d+)\]/gi;
  let reviewMatch;
  while ((reviewMatch = reviewRegex.exec(content)) !== null) {
    reviewMatches.push({
      index: reviewMatch.index,
      type: 'reviewEmbed',
      content: reviewMatch[1], // Legacy review ID
      fullMatch: reviewMatch[0],
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
      type: 'p',
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Find unordered lists
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  while ((match = ulRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: 'ul',
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Find ordered lists
  const olRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  while ((match = olRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: 'ol',
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Find horizontal lines (<hr> tags)
  const hrRegex = /<hr\s*\/?>/gi;
  while ((match = hrRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: 'hr',
      content: '',
      fullMatch: match[0],
    });
  }

  // Add SS images, YouTube, Vimeo, pagebreaks, and reviews to allMatches
  allMatches.push(
    ...ssImageMatches,
    ...youtubeMatches,
    ...vimeoMatches,
    ...pagebreakMatches,
    ...reviewMatches
  );

  // Sort by index to process in document order
  allMatches.sort((a, b) => a.index - b.index);

  // Process each match
  for (const m of allMatches) {
    const tagName = m.type;
    const innerContent = m.content;

    // Handle pagebreak comments → ptPageBreak
    if (tagName === 'pagebreak') {
      blocks.push(createPageBreak());
      continue;
    }

    // Handle <hr> tags → ptHorizontalLine (inline horizontal line)
    if (tagName === 'hr') {
      blocks.push(createInlineHorizontalLine());
      continue;
    }

    // Handle YouTube iframes (inline video inside text content)
    if (tagName === 'youtubeIframe' && m.videoId) {
      blocks.push({
        _type: 'ptYoutubeVideo',
        _key: generateKey(),
        youtubeId: m.videoId,
      } as PtYoutubeVideo);
      continue;
    }

    // Handle Vimeo iframes (inline video inside text content)
    if (tagName === 'vimeoIframe' && m.videoId) {
      blocks.push({
        _type: 'ptVimeoVideo',
        _key: generateKey(),
        vimeoId: m.videoId,
      } as PtVimeoVideo);
      continue;
    }

    // Handle [recenzja id=X] shortcodes → ptReviewEmbed
    // Note: The actual reference resolution happens in the transformer
    // Here we just store the legacy ID as a placeholder
    if (tagName === 'reviewEmbed' && m.content) {
      blocks.push({
        _type: 'ptReviewEmbed',
        _key: generateKey(),
        legacyReviewId: m.content, // Will be resolved to Sanity reference in transformer
      } as unknown as PtReviewEmbed);
      continue;
    }

    // Handle SilverStripe image shortcodes
    if (tagName === 'ssImage' && m.imageData) {
      const placeholder: ImagePlaceholder = {
        _type: 'imagePlaceholder',
        _key: generateKey(),
        src: m.imageData.src,
        alt: m.imageData.alt,
      };
      // Add float for inline images with left/right class
      if (m.imageData.float) {
        placeholder.float = m.imageData.float;
      }
      // Add dimensions if specified
      if (m.imageData.width) {
        placeholder.width = m.imageData.width;
      }
      if (m.imageData.height) {
        placeholder.height = m.imageData.height;
      }
      blocks.push(placeholder);
      continue;
    }

    // Handle headings - ALL converted to h3 per product schema
    if (tagName.startsWith('h')) {
      // Check if heading contains an image shortcode or <img> tag
      const imageShortcodeMatch = innerContent.match(/\[image\s+[^\]]+\]/i);
      const imgTagMatch = innerContent.match(/<img[^>]+>/i);

      // Extract image if present
      if (imageShortcodeMatch || imgTagMatch) {
        // Try to extract image data
        let imageData: { src: string; alt: string } | null = null;

        if (imageShortcodeMatch) {
          const srcMatch =
            imageShortcodeMatch[0].match(/src=["']([^"']+)["']/i);
          const altMatch =
            imageShortcodeMatch[0].match(/alt=["']([^"']+)["']/i);
          if (srcMatch) {
            let imgSrc = srcMatch[1];
            // Resolve relative URLs to full URLs
            if (!imgSrc.startsWith('http')) {
              if (
                imgSrc.startsWith('assets/') ||
                imgSrc.startsWith('/assets/')
              ) {
                imgSrc = imgSrc.startsWith('/')
                  ? `https://www.audiofast.pl${imgSrc}`
                  : `https://www.audiofast.pl/${imgSrc}`;
              } else if (imgSrc.startsWith('/')) {
                imgSrc = `https://www.audiofast.pl${imgSrc}`;
              }
            }
            imageData = {
              src: imgSrc,
              alt: altMatch?.[1] || '',
            };
          }
        } else if (imgTagMatch) {
          const srcMatch = imgTagMatch[0].match(/src=["']([^"']+)["']/i);
          const altMatch = imgTagMatch[0].match(/alt=["']([^"']+)["']/i);
          if (srcMatch) {
            let imgSrc = srcMatch[1];
            // Resolve relative URLs to full URLs
            if (!imgSrc.startsWith('http')) {
              if (
                imgSrc.startsWith('assets/') ||
                imgSrc.startsWith('/assets/')
              ) {
                imgSrc = imgSrc.startsWith('/')
                  ? `https://www.audiofast.pl${imgSrc}`
                  : `https://www.audiofast.pl/${imgSrc}`;
              } else if (imgSrc.startsWith('/')) {
                imgSrc = `https://www.audiofast.pl${imgSrc}`;
              }
            }
            imageData = {
              src: imgSrc,
              alt: altMatch?.[1] || '',
            };
          }
        }

        // Get text content without the image reference
        let textContent = innerContent
          .replace(/\[image\s+[^\]]+\]/gi, '') // Remove image shortcodes
          .replace(/<img[^>]*>/gi, ''); // Remove img tags
        textContent = stripHtmlTags(textContent).trim();

        // Add heading block if there's meaningful text
        if (textContent && textContent.length > 1) {
          blocks.push(createTextBlock(textContent, 'h3'));
        }

        // Add image placeholder if we found an image
        if (imageData) {
          blocks.push({
            _type: 'imagePlaceholder',
            _key: generateKey(),
            src: imageData.src,
            alt: imageData.alt,
          } as ImagePlaceholder);
        }
      } else {
        // No image in heading - just process text
        const textContent = stripHtmlTags(innerContent).trim();
        if (textContent) {
          blocks.push(createTextBlock(textContent, 'h3'));
        }
      }
      continue;
    }

    // Handle unordered lists
    if (tagName === 'ul') {
      const listItems = innerContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      for (const li of listItems) {
        const itemContent = li.replace(/<\/?li[^>]*>/gi, '');
        const { children, markDefs } = parseInlineContent(itemContent);
        if (children.length > 0 && children.some((c) => c.text.trim())) {
          const block: PortableTextBlock = {
            _type: 'block',
            _key: generateKey(),
            style: 'normal',
            markDefs,
            children,
            listItem: 'bullet',
            level: 1,
          };
          blocks.push(block);
        }
      }
      continue;
    }

    // Handle ordered lists
    if (tagName === 'ol') {
      const listItems = innerContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      for (const li of listItems) {
        const itemContent = li.replace(/<\/?li[^>]*>/gi, '');
        const { children, markDefs } = parseInlineContent(itemContent);
        if (children.length > 0 && children.some((c) => c.text.trim())) {
          const block: PortableTextBlock = {
            _type: 'block',
            _key: generateKey(),
            style: 'normal',
            markDefs,
            children,
            listItem: 'number',
            level: 1,
          };
          blocks.push(block);
        }
      }
      continue;
    }

    // Handle paragraphs
    if (tagName === 'p') {
      // Extract ALL <img> tags from paragraph
      // Note: [image ...] shortcodes are already handled at the top level extraction
      const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

      const imgTags: Array<{ src: string; alt: string; fullMatch: string }> =
        [];

      // Find all <img> tags
      let imgTagMatch;
      while ((imgTagMatch = imgTagRegex.exec(innerContent)) !== null) {
        const altMatch = imgTagMatch[0].match(/alt=["']([^"']*)["']/i);
        imgTags.push({
          src: imgTagMatch[1],
          alt: altMatch ? altMatch[1] : '',
          fullMatch: imgTagMatch[0],
        });
      }

      // Check if paragraph contains [image ...] shortcodes (handle separately)
      const hasShortcodes = /\[image\s+[^\]]+\]/i.test(innerContent);

      // If paragraph contains <img> tags, extract them as separate blocks
      if (imgTags.length > 0) {
        let contentToProcess = innerContent;

        for (const img of imgTags) {
          // Get text before this image
          const imgIndex = contentToProcess.indexOf(img.fullMatch);
          if (imgIndex > 0) {
            const textBefore = contentToProcess.substring(0, imgIndex);
            // Remove any shortcodes from text (they're handled elsewhere)
            const textBeforeClean = textBefore.replace(
              /\[image\s+[^\]]+\]/gi,
              ''
            );
            const cleanTextBefore = stripHtmlTags(textBeforeClean).trim();
            if (
              cleanTextBefore &&
              cleanTextBefore !== '&nbsp;' &&
              cleanTextBefore !== '\u00a0' &&
              cleanTextBefore.length > 1
            ) {
              const { children, markDefs } =
                parseInlineContent(textBeforeClean);
              if (children.length > 0 && children.some((c) => c.text.trim())) {
                blocks.push({
                  _type: 'block',
                  _key: generateKey(),
                  style: 'normal',
                  markDefs,
                  children,
                });
              }
            }
          }

          // Add the image as a separate block
          let imgSrc = img.src;
          if (!imgSrc.startsWith('http')) {
            if (imgSrc.startsWith('assets/') || imgSrc.startsWith('/assets/')) {
              imgSrc = imgSrc.startsWith('/')
                ? `https://www.audiofast.pl${imgSrc}`
                : `https://www.audiofast.pl/${imgSrc}`;
            } else if (imgSrc.startsWith('/')) {
              imgSrc = `https://www.audiofast.pl${imgSrc}`;
            }
          }

          blocks.push({
            _type: 'imagePlaceholder',
            _key: generateKey(),
            src: imgSrc,
            alt: img.alt,
          } as ImagePlaceholder);

          // Update content to process (everything after this image)
          contentToProcess = contentToProcess.substring(
            imgIndex + img.fullMatch.length
          );
        }

        // Add any remaining text after the last image
        // Remove any shortcodes from remaining text (they're handled elsewhere)
        const remainingClean = contentToProcess.replace(
          /\[image\s+[^\]]+\]/gi,
          ''
        );
        const remainingText = stripHtmlTags(remainingClean).trim();
        if (
          remainingText &&
          remainingText !== '&nbsp;' &&
          remainingText !== '\u00a0' &&
          remainingText.length > 1
        ) {
          const { children, markDefs } = parseInlineContent(remainingClean);
          if (children.length > 0 && children.some((c) => c.text.trim())) {
            blocks.push({
              _type: 'block',
              _key: generateKey(),
              style: 'normal',
              markDefs,
              children,
            });
          }
        }

        continue;
      }

      // If paragraph ONLY contains shortcodes (no text, no <img> tags), skip it
      // The shortcodes are handled at the top level
      if (hasShortcodes) {
        const textWithoutShortcodes = innerContent.replace(
          /\[image\s+[^\]]+\]/gi,
          ''
        );
        const cleanText = stripHtmlTags(textWithoutShortcodes).trim();
        if (!cleanText || cleanText === '&nbsp;' || cleanText === '\u00a0') {
          continue; // Skip - shortcode-only paragraph, handled elsewhere
        }

        // Has both shortcodes and text - output just the text part
        const { children, markDefs } = parseInlineContent(
          textWithoutShortcodes
        );
        if (children.length > 0 && children.some((c) => c.text.trim())) {
          blocks.push({
            _type: 'block',
            _key: generateKey(),
            style: 'normal',
            markDefs,
            children,
          });
        }
        continue;
      }

      // Regular paragraph (no images, no shortcodes)
      const textContent = stripHtmlTags(innerContent).trim();
      if (
        !textContent ||
        textContent === '&nbsp;' ||
        textContent === '\u00a0'
      ) {
        continue;
      }

      const { children, markDefs } = parseInlineContent(innerContent);
      if (children.length > 0 && children.some((c) => c.text.trim())) {
        blocks.push({
          _type: 'block',
          _key: generateKey(),
          style: 'normal',
          markDefs,
          children,
        });
      }
    }
  }

  return blocks;
}

/**
 * Create a horizontal line block
 */
export function createHorizontalLine(): ContentBlockHorizontalLine {
  return {
    _type: 'contentBlockHorizontalLine',
    _key: generateKey(),
  };
}

/**
 * Create a YouTube video block
 */
export function createYoutubeBlock(videoId: string): ContentBlockYoutube {
  return {
    _type: 'contentBlockYoutube',
    _key: generateKey(),
    youtubeId: videoId,
  };
}

/**
 * Create a Vimeo video block
 */
export function createVimeoBlock(videoId: string): ContentBlockVimeo {
  return {
    _type: 'contentBlockVimeo',
    _key: generateKey(),
    vimeoId: videoId,
  };
}

/**
 * Create a minimal image block (used after image upload)
 */
export function createMinimalImageBlock(assetRef: string): PtMinimalImage {
  return {
    _type: 'ptMinimalImage',
    _key: generateKey(),
    image: {
      _type: 'image',
      asset: {
        _type: 'reference',
        _ref: assetRef,
      },
    },
  };
}

/**
 * Create an inline image block with float (text wraps around it)
 */
export function createInlineImageBlock(
  assetRef: string,
  float: 'left' | 'right',
  alt?: string,
  width?: number
): PtInlineImage {
  const block: PtInlineImage = {
    _type: 'ptInlineImage',
    _key: generateKey(),
    image: {
      _type: 'image',
      asset: {
        _type: 'reference',
        _ref: assetRef,
      },
    },
    float,
  };
  if (alt) block.alt = alt;
  if (width && width > 0) block.width = width;
  return block;
}

/**
 * Create a page break block (column divider)
 * Indicates content split into two columns - left before, right after
 */
export function createPageBreak(): PtPageBreak {
  return {
    _type: 'ptPageBreak',
    _key: generateKey(),
    style: 'columnBreak',
  };
}

/**
 * Create an inline horizontal line block (within text content)
 * Visual separator within portable text
 */
export function createInlineHorizontalLine(): PtHorizontalLine {
  return {
    _type: 'ptHorizontalLine',
    _key: generateKey(),
    style: 'horizontalLine',
  };
}
