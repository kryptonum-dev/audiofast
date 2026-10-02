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
  /** CSS pixels the image is requested at; defaults to `size`. */
  sourceSize?: number;
  /** `view-transition-name`, so the thumbnail can morph between places. */
  transitionName?: string;
};

/**
 * Decorative square thumbnail (the document name sits next to it, so
 * `alt=""`). Falls back to a placeholder with the type icon when there is
 * no image or it fails to load.
 */
export function Thumbnail({
  assetId,
  size,
  type,
  cdn,
  sourceSize,
  transitionName,
}: ThumbnailProps) {
  const url = assetId
    ? imageThumbnailUrl(assetId, cdn, sourceSize ?? size)
    : null;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const style = {
    '--thumb-size': `${size / 16}rem`,
    viewTransitionName: transitionName,
  } as CSSProperties;

  if (!url || failedUrl === url) {
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
      data-thumb="image"
      decoding="async"
      height={size}
      loading="lazy"
      onError={() => setFailedUrl(url)}
      src={url}
      style={style}
      width={size}
    />
  );
}
