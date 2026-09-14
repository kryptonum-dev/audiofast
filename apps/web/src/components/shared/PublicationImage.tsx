import { getYouTubeThumbnailUrl } from '@workspace/youtube';
import NextImage from 'next/image';

import Image, { type AppImageProps } from './Image';

type PublicationImageProps = AppImageProps & {
  publicationType: string;
  videoUrl?: string | null;
};

export default function PublicationImage({
  publicationType,
  videoUrl,
  ...props
}: PublicationImageProps) {
  const fallback =
    publicationType === 'youtubeVideo' && !props.image?.id
      ? getYouTubeThumbnailUrl(videoUrl ?? '')
      : undefined;

  if (!fallback) return <Image {...props} />;

  return (
    <NextImage
      src={fallback}
      alt={props.alt ?? ''}
      width={480}
      height={360}
      sizes={props.sizes}
      priority={props.priority}
      loading={props.loading}
      unoptimized
    />
  );
}
