/**
 * Document thumbnails: which image field represents a document of a given
 * type, and how to turn a Sanity image asset id into a CDN thumbnail URL
 * (plus the original file URL of uploads for the CSV).
 * One field table drives both the GROQ projection (live documents) and the
 * plain-JS lookup (last revisions of deleted documents).
 */

/**
 * Image fields per document type, tried in order. A path is a top-level
 * field, optionally followed by `[0]` for the first item of an image array.
 * Paths with a `->` dereference only work in GROQ; the JS lookup skips them.
 */
export const IMAGE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  product: ['previewImage', 'imageGallery[0]'],
  cpoProduct: [
    'previewImage',
    'imageGallery[0]',
    'internalProduct->previewImage',
  ],
  brand: ['logo', 'heroImage', 'bannerImage'],
  'blog-article': ['image'],
  review: ['image', 'imageGallery[0]'],
  award: ['logo'],
  teamMember: ['image'],
  youtubeVideo: ['image'],
  socialMedia: ['icon'],
  productCategorySub: ['heroImage'],
  blog: ['heroImage'],
  products: ['heroImage'],
  notFound: ['backgroundImage'],
};

const PATH_RE = /^([A-Za-z_][A-Za-z0-9_]*)(\[0\])?$/;

function groqPath(path: string): string {
  return `${path}.asset._ref`;
}

/**
 * GROQ expression for the representative image asset id of a document:
 * the per-type fields from `IMAGE_FIELDS`, then the first image found in
 * the page builder (a block's own `image`, a hero carousel slide, a
 * gallery section). Null when nothing matches.
 */
export const IMAGE_REF_GROQ = `coalesce(
    select(
${Object.entries(IMAGE_FIELDS)
  .map(
    ([type, paths]) =>
      `      _type == ${JSON.stringify(type)} => coalesce(${paths.map(groqPath).join(', ')})`,
  )
  .join(',\n')}
    ),
    pageBuilder[defined(image.asset._ref)][0].image.asset._ref,
    pageBuilder[_type == "heroCarousel"][0].slides[defined(image.asset._ref)][0].image.asset._ref,
    pageBuilder[_type == "gallerySection"][0].images[0].asset._ref
  )`;

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** `image.asset._ref` of an image value, if it is a string. */
function assetRef(value: unknown): string | null {
  if (!isObj(value) || !isObj(value.asset)) return null;
  const ref = value.asset._ref;
  return typeof ref === 'string' && ref !== '' ? ref : null;
}

function readPath(doc: Obj, path: string): unknown {
  const match = PATH_RE.exec(path);
  if (!match?.[1]) return undefined;
  const value = doc[match[1]];
  if (!match[2]) return value;
  return Array.isArray(value) ? value[0] : undefined;
}

function firstBuilderImage(doc: Obj): string | null {
  const blocks = Array.isArray(doc.pageBuilder) ? doc.pageBuilder : [];
  for (const block of blocks) {
    const own = isObj(block) ? assetRef(block.image) : null;
    if (own) return own;
  }
  for (const block of blocks) {
    if (!isObj(block)) continue;
    if (block._type === 'heroCarousel' && Array.isArray(block.slides)) {
      for (const slide of block.slides) {
        const ref = isObj(slide) ? assetRef(slide.image) : null;
        if (ref) return ref;
      }
    }
    if (block._type === 'gallerySection' && Array.isArray(block.images)) {
      const ref = assetRef(block.images[0]);
      if (ref) return ref;
    }
  }
  return null;
}

/** Same rules as `IMAGE_REF_GROQ`, applied to a full document in JS. */
export function documentImageRef(doc: unknown): string | null {
  if (!isObj(doc)) return null;
  const type = typeof doc._type === 'string' ? doc._type : '';
  for (const path of IMAGE_FIELDS[type] ?? []) {
    const ref = assetRef(readPath(doc, path));
    if (ref) return ref;
  }
  return firstBuilderImage(doc);
}

export type ImageAssetInfo = {
  hash: string;
  width: number;
  height: number;
  extension: string;
};

const IMAGE_ID_RE = /^image-([A-Za-z0-9]+)-(\d+)x(\d+)-([A-Za-z0-9]+)$/;

/** Parse an image asset id (`image-<hash>-<w>x<h>-<ext>`); null otherwise. */
export function parseImageAssetId(id: string): ImageAssetInfo | null {
  const match = IMAGE_ID_RE.exec(id);
  if (!match?.[1] || !match[4]) return null;
  return {
    hash: match[1],
    width: Number(match[2]),
    height: Number(match[3]),
    extension: match[4],
  };
}

export type ImageCdnTarget = { projectId: string; dataset: string };

function cdnBase(kind: 'images' | 'files', target: ImageCdnTarget): string {
  return `https://cdn.sanity.io/${kind}/${encodeURIComponent(target.projectId)}/${encodeURIComponent(target.dataset)}`;
}

/**
 * Square CDN thumbnail (`fit=crop`, 2x the CSS size for sharp screens) of an
 * image asset id, or null when the id is not an image asset.
 */
export function imageThumbnailUrl(
  assetId: string,
  target: ImageCdnTarget,
  cssSize: number,
): string | null {
  const info = parseImageAssetId(assetId);
  if (!info) return null;
  const px = Math.max(1, Math.round(cssSize * 2));
  const file = `${info.hash}-${info.width}x${info.height}.${info.extension}`;
  return `${cdnBase('images', target)}/${file}?w=${px}&h=${px}&fit=crop&auto=format`;
}

const FILE_ID_RE = /^file-([A-Za-z0-9]+)-([A-Za-z0-9]+)$/;

/**
 * Original CDN URL of an uploaded image (`image-…`) or file (`file-…`)
 * asset id, or null for any other id. Used as the CSV link of upload rows.
 */
export function assetFileUrl(
  assetId: string,
  target: ImageCdnTarget,
): string | null {
  const image = parseImageAssetId(assetId);
  if (image) {
    return `${cdnBase('images', target)}/${image.hash}-${image.width}x${image.height}.${image.extension}`;
  }
  const file = FILE_ID_RE.exec(assetId);
  if (file?.[1] && file[2]) {
    return `${cdnBase('files', target)}/${file[1]}.${file[2]}`;
  }
  return null;
}
