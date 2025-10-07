import type { PortableTextBlock } from 'next-sanity';
import slugify from 'slugify';

import type { PortableTextValue } from './types';

export const isRelativeUrl = (url: string) =>
  url.startsWith('/') || url.startsWith('#') || url.startsWith('?');

export const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return isRelativeUrl(url);
  }
};

export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

export const getTitleCase = (name: string) => {
  const titleTemp = name.replace(/([A-Z])/g, ' $1');
  return titleTemp.charAt(0).toUpperCase() + titleTemp.slice(1);
};

type Response<T> = [T, undefined] | [undefined, string];

export async function handleErrors<T>(
  promise: Promise<T>
): Promise<Response<T>> {
  try {
    const data = await promise;
    return [data, undefined];
  } catch (err) {
    return [
      undefined,
      err instanceof Error ? err.message : JSON.stringify(err),
    ];
  }
}

export function convertToSlug(
  text?: string,
  { fallback }: { fallback?: string } = { fallback: 'top-level' }
) {
  if (!text) return fallback;
  return slugify(text.trim(), {
    lower: true,
    remove: /[^a-zA-Z0-9 ]/g,
  });
}

export function parseChildrenToSlug(children: PortableTextBlock['children']) {
  if (!children) return '';
  return convertToSlug(children.map((child) => child.text).join(''));
}

/**
 * Fetches raw SVG text from a public URL. Returns undefined on failure.
 * Intended for client-side usage to inline trusted SVGs from the Sanity CDN.
 */
export async function imageToInlineSvg(url: string) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    if (contentType !== 'image/svg+xml') return null;
    const svgContent = await response.text();
    return svgContent;
  } catch (error) {
    throw new Error(`Error fetching SVG: ${error}`);
  }
}

/**
 * Converts PortableText content to plain text string
 * Handles: normal text, headings (h1-h6), strong, italic, and custom links
 * @param portableText - PortableText block array
 * @returns Plain text string with formatting removed
 */
export function portableTextToPlainString(
  portableText: PortableTextBlock[]
): string {
  if (!Array.isArray(portableText) || portableText.length === 0) {
    return '';
  }

  return portableText
    .map((block) => {
      // Handle different block types
      if (block._type === 'block') {
        // Extract text from children
        const blockText = (block.children || [])
          .map((child: PortableTextBlock['children'][number]) => {
            // Extract plain text, ignoring all marks (strong, italic, links, etc.)
            return child.text || '';
          })
          .join('');

        return blockText.trim();
      }

      // Handle other block types if needed in the future
      return '';
    })
    .filter(Boolean) // Remove empty strings
    .join(' ') // Join blocks with spaces
    .trim(); // Remove leading/trailing whitespace
}

type PortableTextChild = {
  _type: string;
  text?: string;
  marks?: string[];
  _key: string;
};

type PortableTextMarkDef = {
  _type: string;
  _key: string;
  customLink?: {
    type?: 'external' | 'internal' | null;
    openInNewTab?: boolean | null;
    external?: string | null;
    href?: string | '#' | null;
    internalSlug?: string | null;
  } | null;
};

type PortableTextBlockWithDetails = {
  _type: string;
  _key: string;
  children?: PortableTextChild[];
  style?: string;
  listItem?: 'bullet' | 'number';
  markDefs?: PortableTextMarkDef[] | null;
  level?: number;
};

/**
 * Escapes HTML special characters to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Converts PortableText content to HTML string
 * Handles: normal text, headings (h1-h6), lists (bullet, numbered), strong, italic, and custom links
 * @param portableText - PortableText block array or value
 * @returns HTML string with proper semantic markup
 *
 * @example
 * const html = portableTextToHtml(myPortableTextContent);
 * // Returns: "<p>Hello <strong>world</strong>!</p>"
 */
export function portableTextToHtml(
  portableText: PortableTextValue | PortableTextBlockWithDetails[]
): string {
  if (!portableText) return '';

  const blocks = Array.isArray(portableText) ? portableText : [portableText];

  if (blocks.length === 0) return '';

  // Group blocks by list items
  const processedBlocks: string[] = [];
  type ListGroup = {
    type: 'bullet' | 'number';
    items: string[];
  };
  let currentList: ListGroup | null = null;

  const processChild = (
    child: PortableTextChild,
    markDefs: PortableTextMarkDef[] = []
  ): string => {
    let text = escapeHtml(child.text || '');

    if (!child.marks || child.marks.length === 0) {
      return text;
    }

    // Apply marks in order
    child.marks.forEach((mark) => {
      if (mark === 'strong') {
        text = `<strong>${text}</strong>`;
      } else if (mark === 'em') {
        text = `<em>${text}</em>`;
      } else if (mark === 'code') {
        text = `<code>${text}</code>`;
      } else {
        // Check if it's a custom mark (like customLink)
        const markDef = markDefs.find((def) => def._key === mark);
        if (markDef && markDef._type === 'customLink') {
          const linkData = markDef.customLink;
          const href = linkData?.href || '#';
          const isExternal =
            linkData?.type === 'external' ||
            linkData?.openInNewTab ||
            href.startsWith('http') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:');

          if (isExternal) {
            text = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
          } else {
            text = `<a href="${escapeHtml(href)}">${text}</a>`;
          }
        }
      }
    });

    return text;
  };

  const processBlock = (block: PortableTextBlockWithDetails): string => {
    if (block._type !== 'block') return '';

    const children = block.children || [];
    const content = children
      .map((child) => processChild(child, block.markDefs || []))
      .join('');

    // Handle list items
    if (block.listItem) {
      return `<li>${content}</li>`;
    }

    // Handle different block styles
    const style = block.style || 'normal';

    switch (style) {
      case 'h1':
        return `<h1>${content}</h1>`;
      case 'h2':
        return `<h2>${content}</h2>`;
      case 'h3':
        return `<h3>${content}</h3>`;
      case 'h4':
        return `<h4>${content}</h4>`;
      case 'h5':
        return `<h5>${content}</h5>`;
      case 'h6':
        return `<h6>${content}</h6>`;
      case 'blockquote':
        return `<blockquote>${content}</blockquote>`;
      case 'normal':
      default:
        return `<p>${content}</p>`;
    }
  };

  blocks.forEach((block) => {
    const typedBlock = block as PortableTextBlockWithDetails;

    if (typedBlock.listItem) {
      // Start a new list or add to existing
      if (!currentList || currentList.type !== typedBlock.listItem) {
        // Close previous list if exists
        if (currentList) {
          const listTag = currentList.type === 'bullet' ? 'ul' : 'ol';
          processedBlocks.push(
            `<${listTag}>${currentList.items.join('')}</${listTag}>`
          );
        }
        // Start new list
        currentList = {
          type: typedBlock.listItem,
          items: [processBlock(typedBlock)],
        };
      } else {
        // Add to current list
        currentList.items.push(processBlock(typedBlock));
      }
    } else {
      // Not a list item - close any open list first
      if (currentList) {
        const listTag = currentList.type === 'bullet' ? 'ul' : 'ol';
        processedBlocks.push(
          `<${listTag}>${currentList.items.join('')}</${listTag}>`
        );
        currentList = null;
      }
      // Process regular block
      processedBlocks.push(processBlock(typedBlock));
    }
  });

  // Close any remaining open list
  if (currentList !== null) {
    const listTag = (currentList as ListGroup).type === 'bullet' ? 'ul' : 'ol';
    processedBlocks.push(
      `<${listTag}>${(currentList as ListGroup).items.join('')}</${listTag}>`
    );
  }

  return processedBlocks.join('');
}

export default async function svgToInlineString(
  url: string
): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');

    if (
      !contentType?.includes('image/svg+xml') &&
      !contentType?.includes('svg')
    ) {
      console.error('URL does not point to an SVG file');
      return null;
    }

    const svgContent = await response.text();
    return svgContent;
  } catch (error) {
    console.error(`Error fetching SVG: ${error}`);
    return null;
  }
}
