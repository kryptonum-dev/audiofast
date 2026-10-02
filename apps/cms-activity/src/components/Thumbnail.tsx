import {
  CogIcon,
  CommentIcon,
  DocumentIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  ImageIcon,
  PackageIcon,
  StarIcon,
  TagIcon,
  UserIcon,
} from '@sanity/icons';
import { type ComponentType, type CSSProperties, useState } from 'react';

import { imageThumbnailUrl, type ImageCdnTarget } from '../lib/images.js';

const TYPE_ICONS: Record<string, ComponentType> = {
  product: PackageIcon,
  cpoProduct: PackageIcon,
  brand: TagIcon,
  award: StarIcon,
  review: CommentIcon,
  reviewAuthor: UserIcon,
  teamMember: UserIcon,
  'blog-article': DocumentTextIcon,
  'blog-category': FolderIcon,
  productCategoryParent: FolderIcon,
  productCategorySub: FolderIcon,
  homePage: HomeIcon,
  settings: CogIcon,
  navbar: CogIcon,
  footer: CogIcon,
  socialMedia: CogIcon,
  redirects: CogIcon,
  'sanity.imageAsset': ImageIcon,
};

export function TypeIcon({ type }: { type: string | null | undefined }) {
  const Icon = (type && TYPE_ICONS[type]) || DocumentIcon;
  return <Icon aria-hidden="true" />;
}

type ThumbnailProps = {
  /** Image asset id (`image-…`), or null for the placeholder. */
  assetId: string | null;
  /** CSS pixels (square). */
  size: number;
  /** Document type for the placeholder icon. */
  type?: string | null;
  cdn: ImageCdnTarget;
};

/**
 * Ways to request a thumbnail, tried in order until one loads.
 *
 * Inside the Sanity Dashboard the app runs in a cross-site iframe, and there
 * a plain `<img>` request to `cdn.sanity.io` carries the browser's
 * `*.sanity.io` cookies and fails (also with any Referrer-Policy). A CORS
 * request (`crossOrigin="anonymous"`) sends no cookies and loads, provided
 * the app's hosting origin is one of the project's CORS origins. Local dev
 * (`localhost`, not a CORS origin) falls back to the plain request, which
 * works there.
 */
const LOAD_MODES = ['anonymous', 'plain'] as const;

/**
 * Decorative square thumbnail (the document name sits next to it, so
 * `alt=""`). Falls back to a placeholder with the type icon when there is
 * no image or it fails to load in every mode.
 */
export function Thumbnail({ assetId, size, type, cdn }: ThumbnailProps) {
  const url = assetId ? imageThumbnailUrl(assetId, cdn, size) : null;
  const [failed, setFailed] = useState<{ url: string; count: number } | null>(
    null,
  );
  const failures = failed && failed.url === url ? failed.count : 0;
  const mode = LOAD_MODES[failures];
  const style = { '--thumb-size': `${size / 16}rem` } as CSSProperties;

  if (!url || !mode) {
    return (
      <span
        aria-hidden="true"
        className="thumb thumb--placeholder"
        data-thumb="placeholder"
        style={style}
      >
        <TypeIcon type={type} />
      </span>
    );
  }
  return (
    <img
      alt=""
      className="thumb"
      crossOrigin={mode === 'anonymous' ? 'anonymous' : undefined}
      data-thumb="image"
      decoding="async"
      height={size}
      key={mode}
      loading="lazy"
      onError={() => setFailed({ url, count: failures + 1 })}
      src={url}
      style={style}
      width={size}
    />
  );
}
