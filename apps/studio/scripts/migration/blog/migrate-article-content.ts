#!/usr/bin/env bun
/**
 * Migration Script: Legacy article boxes/pagebuilder → Sanity Portable Text content
 *
 * This script migrates HTML content from SilverStripe boxes to Sanity Portable Text,
 * handling text blocks, image galleries/sliders, YouTube videos, and headings.
 *
 * Usage:
 *   bun run apps/studio/scripts/migration/blog/migrate-article-content.ts
 *
 * Add --dry-run to preview payloads without touching Sanity.
 * Add --article=ID to migrate only a specific article.
 * Add --limit=N to limit to first N articles.
 */

import { readFileSync } from 'node:fs';
import * as https from 'node:https';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';

import { createClient, type SanityClient } from '@sanity/client';
import { parse } from 'csv-parse/sync';

// ============================================================================
// Types
// ============================================================================

type CliOptions = {
  boxesCsvPath: string;
  imagesCsvPath: string;
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  articleId?: number;
  sanityDocId?: string; // Manual override for Sanity document ID
};

type BoxRow = {
  BoxID: string;
  BlogPageID: string;
  ArticleSlug: string;
  ArticleTitle: string;
  Sort: string;
  BoxType: string;
  BoxTitle: string | null;
  YoutubeId: string | null;
  HtmlContent: string | null;
};

type ImageRow = {
  BoxID: string;
  ImageID: string;
  ImageSort: string;
  ImageFilename: string | null;
};

type PortableTextSpan = {
  _type: 'span';
  _key: string;
  text: string;
  marks?: string[];
};

type PortableTextBlock = {
  _type: 'block';
  _key: string;
  style: 'normal' | 'h2' | 'h3';
  markDefs: MarkDef[];
  children: PortableTextSpan[];
  listItem?: 'bullet' | 'number';
  level?: number;
};

type MarkDef = {
  _type: string;
  _key: string;
  [key: string]: any;
};

type ImageSliderBlock = {
  _type: 'ptImageSlider';
  _key: string;
  images: Array<{
    _type: 'image';
    _key: string;
    asset: { _type: 'reference'; _ref: string };
  }>;
};

type YouTubeBlock = {
  _type: 'ptYoutubeVideo';
  _key: string;
  youtubeId: string;
  title?: string;
};

type PageBreakBlock = {
  _type: 'ptPageBreak';
  _key: string;
};

type ImageBlock = {
  _type: 'ptImage';
  _key: string;
  layout: 'single';
  image: {
    _type: 'image';
    asset: { _type: 'reference'; _ref: string };
  };
  autoWidth?: boolean;
};

type VimeoBlock = {
  _type: 'ptVimeoVideo';
  _key: string;
  vimeoId: string;
  title?: string;
};

// Placeholder for images that need to be uploaded later
type ImagePlaceholder = {
  _type: 'imagePlaceholder';
  _key: string;
  src: string;
  alt: string;
  autoWidth?: boolean;
};

type ContentBlock = PortableTextBlock | ImageSliderBlock | YouTubeBlock | VimeoBlock | PageBreakBlock | ImageBlock | ImagePlaceholder;

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_BOXES_CSV_PATH = '/Users/oliwiersellig/Desktop/real-articles-text.csv';
const DEFAULT_IMAGES_CSV_PATH = '/Users/oliwiersellig/Desktop/real-articles-gallery.csv';
const DEFAULT_PRODUCT_SLUGS_CSV_PATH = '/Users/oliwiersellig/Desktop/product-brand-slug-mapping.csv';
const DEFAULT_SITETREE_CSV_PATH = '/Users/oliwiersellig/Desktop/site-tree.csv';
const DEFAULT_PROJECT_ID = 'fsw3likv';
const DEFAULT_DATASET = 'production';
const LEGACY_ASSETS_BASE_URL = 'https://www.audiofast.pl/assets/';

// Product slug lookup map (loaded from CSV)
let productSlugMap: Map<string, string> | null = null;
// SiteTree slug lookup map (loaded from CSV)
let sitetreeSlugMap: Map<string, string> | null = null;

// SSL bypass for legacy server
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ============================================================================
// Helpers
// ============================================================================

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const boxesCsvArg = args.find((arg) => arg.startsWith('--boxes='));
  const imagesCsvArg = args.find((arg) => arg.startsWith('--images='));
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const articleArg = args.find((arg) => arg.startsWith('--article='));
  const sanityDocArg = args.find((arg) => arg.startsWith('--sanity-doc='));

  return {
    boxesCsvPath: boxesCsvArg ? boxesCsvArg.replace('--boxes=', '') : DEFAULT_BOXES_CSV_PATH,
    imagesCsvPath: imagesCsvArg ? imagesCsvArg.replace('--images=', '') : DEFAULT_IMAGES_CSV_PATH,
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    limit: limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : undefined,
    articleId: articleArg ? parseInt(articleArg.replace('--article=', ''), 10) : undefined,
    sanityDocId: sanityDocArg ? sanityDocArg.replace('--sanity-doc=', '') : undefined,
  };
}

function readCsvRows<T>(csvPath: string): T[] {
  const resolved = resolve(process.cwd(), csvPath);
  const file = readFileSync(resolved, 'utf-8');
  return parse(file, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as T[];
}

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cleanString(value?: string | null): string {
  if (value === undefined || value === null) return '';
  const cleaned = value.replace(/\u00a0/g, ' ').trim();
  if (!cleaned || cleaned.toLowerCase() === 'null') return '';
  return cleaned;
}

type ProductSlugRow = {
  ProductID: string;
  ProductURLSegment: string;
  BrandURLSegment: string;
  FullPath: string;
  Title: string;
};

/**
 * Load product slug mappings from CSV
 * Maps ProductID → FullPath (e.g., "dcs/vivaldi-dac")
 */
function loadProductSlugMap(): Map<string, string> {
  if (productSlugMap) return productSlugMap;

  try {
    const rows = readCsvRows<ProductSlugRow>(DEFAULT_PRODUCT_SLUGS_CSV_PATH);
    productSlugMap = new Map<string, string>();

    for (const row of rows) {
      const productId = row.ProductID;
      // Use FullPath which includes brand (e.g., "dcs/vivaldi-dac")
      const fullPath = row.FullPath;
      if (productId && fullPath) {
        productSlugMap.set(productId, fullPath);
      }
    }

    console.log(`   📂 Loaded ${productSlugMap.size} product slug mappings`);
    return productSlugMap;
  } catch (err) {
    console.warn(`   ⚠️  Could not load product slugs CSV: ${err instanceof Error ? err.message : err}`);
    productSlugMap = new Map<string, string>();
    return productSlugMap;
  }
}

/**
 * Get product full path by ID (e.g., "dcs/vivaldi-dac")
 */
function getProductFullPathById(productId: string): string | null {
  const slugMap = loadProductSlugMap();
  return slugMap.get(productId) || null;
}

type SiteTreeRow = {
  SiteTreeID: string;
  URLSegment: string;
  ClassName: string;
  Title: string;
};

/**
 * Load sitetree slug mappings from CSV
 */
function loadSiteTreeMap(): Map<string, string> {
  if (sitetreeSlugMap) return sitetreeSlugMap;

  try {
    const rows = readCsvRows<SiteTreeRow>(DEFAULT_SITETREE_CSV_PATH);
    sitetreeSlugMap = new Map<string, string>();

    for (const row of rows) {
      const siteTreeId = row.SiteTreeID;
      const urlSegment = row.URLSegment;
      if (siteTreeId && urlSegment) {
        sitetreeSlugMap.set(siteTreeId, urlSegment);
      }
    }

    console.log(`   📂 Loaded ${sitetreeSlugMap.size} sitetree slug mappings`);
    return sitetreeSlugMap;
  } catch (err) {
    console.warn(`   ⚠️  Could not load sitetree slugs CSV: ${err instanceof Error ? err.message : err}`);
    sitetreeSlugMap = new Map<string, string>();
    return sitetreeSlugMap;
  }
}

/**
 * Get sitetree URL by ID
 */
function getSiteTreeUrlById(siteTreeId: string): string | null {
  const slugMap = loadSiteTreeMap();
  const urlSegment = slugMap.get(siteTreeId);
  if (urlSegment) {
    return `https://www.audiofast.pl/${urlSegment}`;
  }
  return null;
}

// ============================================================================
// HTML to Portable Text Conversion
// ============================================================================

/**
 * Resolve SilverStripe link shortcodes to actual URLs
 * - Product links: [product_link,id=X] → https://www.audiofast.pl/{brand}/{product}
 * - SiteTree links: [sitetree_link,id=X] → https://www.audiofast.pl/{urlSegment}
 * - External URLs: kept as-is
 * - Internal/relative URLs: prefixed with https://www.audiofast.pl/
 */
function resolveSilverStripeLink(url: string): string {
  if (!url) return '#';

  // Handle product_link shortcode: [product_link,id=X]
  // Uses product-brand-slug-mapping.csv for full path (e.g., "dcs/vivaldi-dac")
  const productMatch = url.match(/\[product_link,id=(\d+)\]/);
  if (productMatch) {
    const id = productMatch[1];
    const fullPath = getProductFullPathById(id);
    if (fullPath) {
      return `https://www.audiofast.pl/${fullPath}`;
    }
    console.warn(`   ⚠️  Product ID ${id} not found in product mapping`);
    return '#';
  }

  // Handle sitetree_link shortcode: [sitetree_link,id=X]
  // Uses site-tree.csv for URL segment
  const sitetreeMatch = url.match(/\[sitetree_link,id=(\d+)\]/);
  if (sitetreeMatch) {
    const id = sitetreeMatch[1];
    const slugMap = loadSiteTreeMap();
    const urlSegment = slugMap.get(id);
    if (urlSegment) {
      return `https://www.audiofast.pl/${urlSegment}`;
    }
    console.warn(`   ⚠️  SiteTree ID ${id} not found in sitetree mapping`);
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

/**
 * Extract YouTube ID from various URL formats
 */
function extractYouTubeId(input: string | null): string | null {
  if (!input) return null;
  const cleaned = cleanString(input);
  if (!cleaned) return null;

  // Already just an ID (11 characters, alphanumeric + _ and -)
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
 * Parse inline images from HTML content and extract src
 */
function extractImagesFromHtml(html: string): Array<{ src: string; alt: string; className: string }> {
  const images: Array<{ src: string; alt: string; className: string }> = [];
  const imgRegex = /<img[^>]+>/gi;
  const matches = html.match(imgRegex) || [];

  for (const imgTag of matches) {
    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const classMatch = imgTag.match(/class=["']([^"']*)["']/i);

    if (srcMatch) {
      images.push({
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : '',
        className: classMatch ? classMatch[1] : '',
      });
    }
  }

  return images;
}

/**
 * Convert HTML string to Portable Text blocks
 * Properly handles: headings, paragraphs, images, lists (ul/ol), and links
 */
function htmlToPortableText(html: string | null): ContentBlock[] {
  if (!html) return [];

  const blocks: ContentBlock[] = [];
  let content = html;

  // Remove pagebreaks and HTML comments
  content = content.replace(/<!--\s*pagebreak\s*-->/gi, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Normalize whitespace
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Handle SilverStripe image shortcodes: [image src="..." class="left" ...]
  // These need to be converted to image placeholders
  // Images with class "left" or "right" (not leftAlone/rightAlone) get autoWidth: true
  const ssImageRegex = /\[image\s+([^\]]+)\]/gi;
  const ssImageMatches: Array<{ index: number; src: string; alt: string; autoWidth: boolean }> = [];
  let ssMatch;
  while ((ssMatch = ssImageRegex.exec(content)) !== null) {
    const attrs = ssMatch[1];
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const titleMatch = attrs.match(/title=["']([^"']+)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']+)["']/i);
    const classMatch = attrs.match(/class=["']([^"']+)["']/i);

    if (srcMatch) {
      let imgSrc = srcMatch[1];
      // Make sure the src is a full URL
      if (!imgSrc.startsWith('http')) {
        if (imgSrc.startsWith('assets/') || imgSrc.startsWith('/assets/')) {
          imgSrc = imgSrc.startsWith('/') ? `https://www.audiofast.pl${imgSrc}` : `https://www.audiofast.pl/${imgSrc}`;
        } else if (imgSrc.startsWith('/')) {
          imgSrc = `https://www.audiofast.pl${imgSrc}`;
        }
      }

      // Check if class is exactly "left" or "right" (not leftAlone/rightAlone)
      const className = classMatch ? classMatch[1] : '';
      const hasLeftOrRight = /\bleft\b|\bright\b/i.test(className) && !/leftAlone|rightAlone/i.test(className);

      ssImageMatches.push({
        index: ssMatch.index,
        src: imgSrc,
        alt: titleMatch ? titleMatch[1] : altMatch ? altMatch[1] : '',
        autoWidth: hasLeftOrRight,
      });
    }
  }

  // Handle YouTube iframes embedded in HTML
  const youtubeIframeRegex = /<iframe[^>]*src=["'](?:https?:)?\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi;
  const youtubeMatches: Array<{ index: number; videoId: string }> = [];
  let ytMatch;
  while ((ytMatch = youtubeIframeRegex.exec(content)) !== null) {
    youtubeMatches.push({
      index: ytMatch.index,
      videoId: ytMatch[1],
    });
  }

  // Handle Vimeo iframes embedded in HTML
  const vimeoIframeRegex = /<iframe[^>]*src=["'](?:https?:)?\/\/(?:player\.)?vimeo\.com\/video\/(\d+)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi;
  const vimeoMatches: Array<{ index: number; videoId: string }> = [];
  let vimeoMatch;
  while ((vimeoMatch = vimeoIframeRegex.exec(content)) !== null) {
    vimeoMatches.push({
      index: vimeoMatch.index,
      videoId: vimeoMatch[1],
    });
  }

  // Process each block element type separately in order of appearance
  // We'll use a position tracking approach to maintain order

  type BlockMatch = { index: number; type: string; content: string; fullMatch: string };
  const allMatches: BlockMatch[] = [];

  // Find all headings (h1-h6)
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

  // Find all paragraphs
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = pRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: 'p',
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Find all unordered lists
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  while ((match = ulRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: 'ul',
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Find all ordered lists
  const olRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  while ((match = olRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      type: 'ol',
      content: match[1],
      fullMatch: match[0],
    });
  }

  // Add SilverStripe image shortcodes to matches
  for (const ssImg of ssImageMatches) {
    allMatches.push({
      index: ssImg.index,
      type: 'ssImage',
      content: ssImg.src,
      fullMatch: `[image src="${ssImg.src}" alt="${ssImg.alt}"]`,
    });
  }

  // Add YouTube iframes to matches
  for (const ytVid of youtubeMatches) {
    allMatches.push({
      index: ytVid.index,
      type: 'youtubeIframe',
      content: ytVid.videoId,
      fullMatch: `<iframe youtube="${ytVid.videoId}">`,
    });
  }

  // Add Vimeo iframes to matches
  for (const vimeoVid of vimeoMatches) {
    allMatches.push({
      index: vimeoVid.index,
      type: 'vimeoIframe',
      content: vimeoVid.videoId,
      fullMatch: `<iframe vimeo="${vimeoVid.videoId}">`,
    });
  }

  // Sort by index to process in document order
  allMatches.sort((a, b) => a.index - b.index);

  // Calculate heading shift: find minimum heading level and shift so it becomes h2
  // This normalizes heading hierarchy for articles that only use h3/h4/etc.
  const headingMatches = allMatches.filter((m) => m.type.startsWith('h'));
  let headingShift = 0;
  if (headingMatches.length > 0) {
    const headingLevels = headingMatches.map((m) => parseInt(m.type[1], 10));
    const minLevel = Math.min(...headingLevels);
    // Shift so minimum level becomes 2 (h2)
    // e.g., if min is h4 (4), shift = 4 - 2 = 2, so h4 becomes h2
    headingShift = minLevel - 2;
    if (headingShift < 0) headingShift = 0; // Don't shift h1 down
  }

  // Process each match
  for (const m of allMatches) {
    const tagName = m.type;
    const innerContent = m.content;

    // Handle YouTube iframes
    if (tagName === 'youtubeIframe') {
      blocks.push({
        _type: 'ptYoutubeVideo',
        _key: generateKey(),
        youtubeId: innerContent,
      });
      continue;
    }

    // Handle Vimeo iframes
    if (tagName === 'vimeoIframe') {
      blocks.push({
        _type: 'ptVimeoVideo',
        _key: generateKey(),
        vimeoId: innerContent,
      });
      continue;
    }

    // Handle SilverStripe image shortcodes
    if (tagName === 'ssImage') {
      const ssImgData = ssImageMatches.find((img) => img.index === m.index);
      if (ssImgData) {
        blocks.push({
          _type: 'imagePlaceholder',
          _key: generateKey(),
          src: ssImgData.src,
          alt: ssImgData.alt,
          autoWidth: ssImgData.autoWidth,
        } as ImagePlaceholder);
      }
      continue;
    }

    // Handle headings with normalized hierarchy
    if (tagName.startsWith('h')) {
      const originalLevel = parseInt(tagName[1], 10);
      const textContent = stripHtmlTags(innerContent).trim();
      if (textContent) {
        // Apply shift to normalize heading hierarchy
        // e.g., if article only has h4, shift=2, so h4 becomes h2
        const shiftedLevel = originalLevel - headingShift;
        // Cap between h2 (min for content) and h3 (max depth we support)
        const style = shiftedLevel <= 2 ? 'h2' : 'h3';
        blocks.push(createTextBlock(textContent, style));
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
      // Check if paragraph contains an image
      const imgMatch = innerContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
      if (imgMatch) {
        // Extract image src
        let imgSrc = imgMatch[1];

        // Try to also get alt text
        const altMatch = innerContent.match(/alt=["']([^"']*)["']/i);
        const imgAlt = altMatch ? altMatch[1] : '';

        // Make sure the src is a full URL
        if (!imgSrc.startsWith('http')) {
          if (imgSrc.startsWith('assets/')) {
            imgSrc = `https://www.audiofast.pl/${imgSrc}`;
          } else if (imgSrc.startsWith('/')) {
            imgSrc = `https://www.audiofast.pl${imgSrc}`;
          }
        }

        // Add image placeholder (will be converted to ptImage later)
        blocks.push({
          _type: 'imagePlaceholder',
          _key: generateKey(),
          src: imgSrc,
          alt: imgAlt,
        } as ImagePlaceholder);

        // Also process any text that might be around the image
        const textWithoutImage = innerContent.replace(/<img[^>]*>/gi, '');
        const textContent = stripHtmlTags(textWithoutImage).trim();
        if (textContent && textContent !== '&nbsp;' && textContent !== '\u00a0' && textContent.length > 1) {
          const { children, markDefs } = parseInlineContent(textWithoutImage);
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

      // Regular paragraph without image
      const textContent = stripHtmlTags(innerContent).trim();
      // Skip empty paragraphs or paragraphs with only &nbsp;
      if (!textContent || textContent === '&nbsp;' || textContent === '\u00a0') {
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
 * Parse inline HTML content (strong, em, links) into Portable Text spans
 */
function parseInlineContent(html: string): { children: PortableTextSpan[]; markDefs: MarkDef[] } {
  const children: PortableTextSpan[] = [];
  const markDefs: MarkDef[] = [];

  // Remove images from the content (they're handled separately)
  let content = html.replace(/<img[^>]*>/gi, '');

  // Remove SilverStripe image shortcodes (they're handled separately)
  content = content.replace(/\[image\s+[^\]]+\]/gi, '');

  // Replace <br> tags with spaces
  content = content.replace(/<br\s*\/?>/gi, ' ');

  // Strip strong/em tags but keep content
  content = content.replace(/<\/?(?:strong|b|em|i|span)[^>]*>/gi, '');

  // Handle links - extract and replace with placeholders
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links: Array<{ url: string; text: string; key: string; placeholder: string }> = [];
  let linkIndex = 0;

  content = content.replace(linkRegex, (match, url, text) => {
    const key = `link-${generateKey()}`;
    const resolvedUrl = resolveSilverStripeLink(url);
    const placeholder = `|||LINK${linkIndex}|||`;
    links.push({ url: resolvedUrl, text: stripHtmlTags(text), key, placeholder });
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

  // Strip remaining HTML tags
  content = content.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  content = content
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Now split by link placeholders and create spans
  if (links.length === 0) {
    // No links, just add the text as a single span
    const text = content.trim();
    if (text) {
      children.push({
        _type: 'span',
        _key: generateKey(),
        text,
      });
    }
  } else {
    // Split content by link placeholders
    const parts = content.split(/(\|\|\|LINK\d+\|\|\|)/);
    
    for (const part of parts) {
      if (!part) continue;
      
      // Check if this part is a link placeholder
      const linkMatch = part.match(/\|\|\|LINK(\d+)\|\|\|/);
      if (linkMatch) {
        const linkIdx = parseInt(linkMatch[1], 10);
        const linkInfo = links[linkIdx];
        if (linkInfo) {
          children.push({
            _type: 'span',
            _key: generateKey(),
            text: linkInfo.text,
            marks: [linkInfo.key],
          });
        }
      } else {
        // Regular text
        const text = part;
        if (text) {
          children.push({
            _type: 'span',
            _key: generateKey(),
            text,
          });
        }
      }
    }
  }

  // If no children were created, add an empty span
  if (children.length === 0) {
    children.push({
      _type: 'span',
      _key: generateKey(),
      text: '',
    });
  }

  return { children, markDefs };
}

/**
 * Split text by strong/em marks
 */
function splitByMarks(html: string): Array<{ text: string; marks: string[] }> {
  const result: Array<{ text: string; marks: string[] }> = [];

  // Very simplified mark detection
  // In production, you'd want a proper tokenizer

  let remaining = html;
  const strongRegex = /<(strong|b)>([\s\S]*?)<\/\1>/gi;
  const emRegex = /<(em|i)>([\s\S]*?)<\/\1>/gi;

  // For simplicity, we'll strip marks and just return plain text
  // A full implementation would track mark positions
  remaining = remaining.replace(strongRegex, (match, tag, content) => {
    return content; // Just keep content for now
  });
  remaining = remaining.replace(emRegex, (match, tag, content) => {
    return content;
  });

  // Strip any remaining HTML tags
  remaining = remaining.replace(/<[^>]+>/g, '');

  result.push({ text: remaining, marks: [] });
  return result;
}

/**
 * Strip all HTML tags from a string
 */
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

/**
 * Create a simple text block
 */
function createTextBlock(text: string, style: 'normal' | 'h2' | 'h3'): PortableTextBlock {
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
// Asset Upload
// ============================================================================

async function uploadImageFromUrl(
  client: SanityClient,
  imageUrl: string,
  filename: string,
  cache: Map<string, string>
): Promise<string | null> {
  const cacheKey = `image:${imageUrl}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  console.log(`   📤 Uploading image: ${filename}`);

  try {
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const request = https.get(imageUrl, { agent: insecureAgent }, (response: any) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect - handle relative URLs
          let redirectUrl = response.headers.location;
          if (redirectUrl.startsWith('/')) {
            // Relative URL - make it absolute
            const urlObj = new URL(imageUrl);
            redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
          }
          https.get(redirectUrl, { agent: insecureAgent }, (redirectResponse: any) => {
            if (redirectResponse.statusCode !== 200) {
              reject(new Error(`HTTP ${redirectResponse.statusCode}`));
              return;
            }
            const chunks: Buffer[] = [];
            redirectResponse.on('data', (chunk: Buffer) => chunks.push(chunk));
            redirectResponse.on('end', () => resolve(Buffer.concat(chunks)));
            redirectResponse.on('error', reject);
          }).on('error', reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });
      request.on('error', reject);
    });

    const stream = Readable.from(buffer);
    const asset = await client.assets.upload('image', stream, { filename });

    cache.set(cacheKey, asset._id);
    console.log(`   ✓ Uploaded: ${asset._id}`);
    return asset._id;
  } catch (err) {
    console.error(`   ✗ Failed to upload ${filename}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================================================
// Box Processing
// ============================================================================

interface ArticleBoxes {
  articlePageId: number;
  articleSlug: string;
  articleTitle: string;
  boxes: BoxRow[];
  imagesByBoxId: Map<string, ImageRow[]>;
}

function groupBoxesByArticle(boxRows: BoxRow[], imageRows: ImageRow[]): Map<number, ArticleBoxes> {
  const articleMap = new Map<number, ArticleBoxes>();

  // Create image lookup by BoxID
  const imagesByBoxId = new Map<string, ImageRow[]>();
  for (const img of imageRows) {
    const boxId = img.BoxID;
    if (!imagesByBoxId.has(boxId)) {
      imagesByBoxId.set(boxId, []);
    }
    imagesByBoxId.get(boxId)!.push(img);
  }

  // Group boxes by article
  for (const box of boxRows) {
    const articleId = parseInt(box.BlogPageID, 10);
    if (!articleId) continue;

    if (!articleMap.has(articleId)) {
      articleMap.set(articleId, {
        articlePageId: articleId,
        articleSlug: box.ArticleSlug,
        articleTitle: box.ArticleTitle,
        boxes: [],
        imagesByBoxId,
      });
    }

    articleMap.get(articleId)!.boxes.push(box);
  }

  // Sort boxes by Sort for each article
  for (const article of articleMap.values()) {
    article.boxes.sort((a, b) => parseInt(a.Sort, 10) - parseInt(b.Sort, 10));
  }

  return articleMap;
}

async function processBox(
  box: BoxRow,
  imagesByBoxId: Map<string, ImageRow[]>,
  client: SanityClient | null,
  assetCache: Map<string, string>,
  dryRun: boolean
): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  const boxType = cleanString(box.BoxType).toLowerCase();

  // Add heading if BoxTitle exists
  const boxTitle = cleanString(box.BoxTitle);
  if (boxTitle) {
    blocks.push(createTextBlock(boxTitle, 'h2'));
  }

  switch (boxType) {
    case 'text': {
      const htmlContent = cleanString(box.HtmlContent);
      if (htmlContent) {
        const textBlocks = htmlToPortableText(htmlContent);

        // Process image placeholders - upload and convert to ptImage
        for (const block of textBlocks) {
          if (block._type === 'imagePlaceholder') {
            const placeholder = block as ImagePlaceholder;
            if (dryRun) {
              const imgBlock: ImageBlock = {
                _type: 'ptImage',
                _key: generateKey(),
                layout: 'single',
                image: {
                  _type: 'image',
                  asset: { _type: 'reference', _ref: `image-dryrun-${generateKey()}` },
                },
              };
              if (placeholder.autoWidth) {
                imgBlock.autoWidth = true;
              }
              blocks.push(imgBlock);
            } else if (client) {
              const filename = placeholder.src.split('/').pop() || 'image.jpg';
              const assetId = await uploadImageFromUrl(client, placeholder.src, filename, assetCache);
              if (assetId) {
                const imgBlock: ImageBlock = {
                  _type: 'ptImage',
                  _key: generateKey(),
                  layout: 'single',
                  image: {
                    _type: 'image',
                    asset: { _type: 'reference', _ref: assetId },
                  },
                };
                if (placeholder.autoWidth) {
                  imgBlock.autoWidth = true;
                }
                blocks.push(imgBlock);
              }
            }
          } else if (block._type === 'ptYoutubeVideo' || block._type === 'ptVimeoVideo') {
            // Pass through YouTube and Vimeo blocks
            blocks.push(block);
          } else {
            blocks.push(block);
          }
        }
      }
      break;
    }

    case 'video': {
      const youtubeId = extractYouTubeId(box.YoutubeId);
      if (youtubeId) {
        blocks.push({
          _type: 'ptYoutubeVideo',
          _key: generateKey(),
          youtubeId,
        });
      }
      break;
    }

    case 'gallery':
    case 'slider': {
      const images = imagesByBoxId.get(box.BoxID) || [];
      if (images.length >= 4) {
        // Sort images by ImageSort
        images.sort((a, b) => parseInt(a.ImageSort, 10) - parseInt(b.ImageSort, 10));

        const imageRefs: Array<{ _type: 'image'; _key: string; asset: { _type: 'reference'; _ref: string } }> = [];

        for (const img of images) {
          const filename = cleanString(img.ImageFilename);
          if (!filename) continue;

          const imageUrl = `${LEGACY_ASSETS_BASE_URL}${filename}`;

          if (dryRun) {
            imageRefs.push({
              _type: 'image',
              _key: generateKey(),
              asset: { _type: 'reference', _ref: `image-dryrun-${generateKey()}` },
            });
          } else if (client) {
            const assetId = await uploadImageFromUrl(client, imageUrl, filename.split('/').pop() || filename, assetCache);
            if (assetId) {
              imageRefs.push({
                _type: 'image',
                _key: generateKey(),
                asset: { _type: 'reference', _ref: assetId },
              });
            }
          }
        }

        if (imageRefs.length >= 4) {
          blocks.push({
            _type: 'ptImageSlider',
            _key: generateKey(),
            images: imageRefs,
          });
        } else {
          console.log(`   ⚠️  Gallery/slider has less than 4 images after upload, skipping (BoxID: ${box.BoxID})`);
        }
      } else {
        console.log(`   ⚠️  Gallery/slider has less than 4 images in CSV, skipping (BoxID: ${box.BoxID}, count: ${images.length})`);
      }
      break;
    }

    case 'hr': {
      // Skip horizontal rules / page breaks - don't render them
      break;
    }

    case 'tabs': {
      // Tabs are complex - for now, skip or convert to text if content exists
      const htmlContent = cleanString(box.HtmlContent);
      if (htmlContent) {
        const textBlocks = htmlToPortableText(htmlContent);

        // Process image placeholders and video blocks
        for (const block of textBlocks) {
          if (block._type === 'imagePlaceholder') {
            const placeholder = block as ImagePlaceholder;
            if (dryRun) {
              const imgBlock: ImageBlock = {
                _type: 'ptImage',
                _key: generateKey(),
                layout: 'single',
                image: {
                  _type: 'image',
                  asset: { _type: 'reference', _ref: `image-dryrun-${generateKey()}` },
                },
              };
              if (placeholder.autoWidth) {
                imgBlock.autoWidth = true;
              }
              blocks.push(imgBlock);
            } else if (client) {
              const filename = placeholder.src.split('/').pop() || 'image.jpg';
              const assetId = await uploadImageFromUrl(client, placeholder.src, filename, assetCache);
              if (assetId) {
                const imgBlock: ImageBlock = {
                  _type: 'ptImage',
                  _key: generateKey(),
                  layout: 'single',
                  image: {
                    _type: 'image',
                    asset: { _type: 'reference', _ref: assetId },
                  },
                };
                if (placeholder.autoWidth) {
                  imgBlock.autoWidth = true;
                }
                blocks.push(imgBlock);
              }
            }
          } else if (block._type === 'ptYoutubeVideo' || block._type === 'ptVimeoVideo') {
            // Pass through YouTube and Vimeo blocks
            blocks.push(block);
          } else {
            blocks.push(block);
          }
        }
      }
      break;
    }

    default:
      console.log(`   ⚠️  Unknown box type: ${boxType} (BoxID: ${box.BoxID})`);
  }

  return blocks;
}

// ============================================================================
// Migration
// ============================================================================

async function migrateArticleContent(options: CliOptions): Promise<void> {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║            AUDIOFAST DATA MIGRATION                           ║');
  console.log('║            Article Content (Boxes → Portable Text)            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Boxes CSV: ${options.boxesCsvPath}`);
  console.log(`Images CSV: ${options.imagesCsvPath}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  if (options.articleId) console.log(`Article ID: ${options.articleId}`);
  if (options.limit) console.log(`Limit: ${options.limit}`);
  console.log('');

  // Read CSV files
  console.log('📖 Reading CSV files...');
  const boxRows = readCsvRows<BoxRow>(options.boxesCsvPath);
  const imageRows = readCsvRows<ImageRow>(options.imagesCsvPath);
  console.log(`   Found ${boxRows.length} boxes and ${imageRows.length} gallery images`);

  // Group boxes by article
  const articleMap = groupBoxesByArticle(boxRows, imageRows);
  console.log(`   Found ${articleMap.size} articles with boxes`);

  // Create Sanity client
  const client = options.dryRun
    ? null
    : createClient({
        projectId: process.env.SANITY_PROJECT_ID || DEFAULT_PROJECT_ID,
        dataset: process.env.SANITY_DATASET || DEFAULT_DATASET,
        apiVersion: '2024-01-01',
        token: process.env.SANITY_API_TOKEN,
        useCdn: false,
      });

  if (!options.dryRun && !process.env.SANITY_API_TOKEN) {
    throw new Error('SANITY_API_TOKEN env var is required for live migration.');
  }

  const assetCache = new Map<string, string>();
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  // Filter articles if specific ID requested
  let articlesToProcess = Array.from(articleMap.values());
  if (options.articleId) {
    articlesToProcess = articlesToProcess.filter((a) => a.articlePageId === options.articleId);
  }
  if (options.limit) {
    articlesToProcess = articlesToProcess.slice(0, options.limit);
  }

  console.log(`\n🚀 Processing ${articlesToProcess.length} articles...\n`);

  for (const article of articlesToProcess) {
    processedCount++;
    console.log(`\n[${processedCount}/${articlesToProcess.length}] 📝 Article: ${article.articleTitle}`);
    console.log(`   Slug: ${article.articleSlug}`);
    console.log(`   Boxes: ${article.boxes.length}`);

    try {
      // Process all boxes for this article
      const contentBlocks: ContentBlock[] = [];

      for (const box of article.boxes) {
        const boxBlocks = await processBox(box, article.imagesByBoxId, client, assetCache, options.dryRun);
        contentBlocks.push(...boxBlocks);
      }

      console.log(`   Generated ${contentBlocks.length} content blocks`);

      if (contentBlocks.length === 0) {
        console.log(`   ⚠️  No content blocks generated, skipping update`);
        continue;
      }

      // Find the Sanity document - either by manual override or by slug
      let targetDocId: string | null = null;

      if (options.sanityDocId && options.articleId === article.articlePageId) {
        // Manual override for specific article
        targetDocId = options.sanityDocId;
        console.log(`   Using manual Sanity doc ID: ${targetDocId}`);
      }

      if (options.dryRun) {
        const expectedSlug = `/blog/${article.articleSlug}/`;
        console.log(`   🧪 DRY RUN - Would update document with slug: ${expectedSlug}`);
        if (options.verbose) {
          console.log(`   Content preview (first 3 blocks):`);
          console.log(JSON.stringify(contentBlocks.slice(0, 3), null, 2));
        }
      } else {
        if (!targetDocId) {
          // Find the document by slug
          const expectedSlug = `/blog/${article.articleSlug}/`;
          const existingDoc = await client!.fetch<{ _id: string } | null>(
            `*[_type == "blog-article" && slug.current == $slug][0]{_id}`,
            { slug: expectedSlug }
          );

          if (!existingDoc) {
            console.log(`   ⚠️  Document not found in Sanity for slug: ${expectedSlug}, skipping`);
            continue;
          }
          targetDocId = existingDoc._id;
        }

        // Update the document (both published and draft versions)
        console.log(`   📤 Updating Sanity document: ${targetDocId}`);

        await client!.patch(targetDocId).set({ content: contentBlocks }).commit();

        // Also update the draft version if it exists
        const draftId = targetDocId.startsWith('drafts.') ? targetDocId : `drafts.${targetDocId}`;
        try {
          await client!.patch(draftId).set({ content: contentBlocks }).commit();
          console.log(`   ✓ Updated both published and draft versions`);
        } catch {
          console.log(`   ✓ Updated published version (no draft exists)`);
        }
      }

      successCount++;
    } catch (err) {
      errorCount++;
      console.error(`   ❌ Error processing article:`, err instanceof Error ? err.message : err);
    }
  }

  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                        MIGRATION SUMMARY                       ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Total articles processed: ${processedCount}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Images uploaded: ${assetCache.size}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  if (options.dryRun) {
    console.log('✅ Dry run complete. No changes were made to Sanity.');
  } else {
    console.log('✅ Migration complete.');
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs();
  await migrateArticleContent(options);
}

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

