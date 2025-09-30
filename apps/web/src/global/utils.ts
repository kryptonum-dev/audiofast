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
