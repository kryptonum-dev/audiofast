import NextImage from 'next/image';
import type { PortableTextTypeComponentProps } from 'next-sanity';

import type { PortableTextProps } from '@/src/global/types';

import Image from '../../shared/Image';
import styles from './styles.module.scss';
import { YoutubeVideoClient } from './YoutubeVideoClient';

type YoutubeVideoValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptYoutubeVideo';
};

/**
 * Fetches YouTube video title using oEmbed API
 * Falls back to null if fetch fails or title is not available
 */
async function fetchYouTubeTitle(youtubeId: string): Promise<string | null> {
  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;

    const response = await fetch(oEmbedUrl, {
      cache: 'force-cache',
      headers: {
        'User-Agent': 'Audiofast-Website/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.title || null;
  } catch (error) {
    console.error(
      `Error fetching YouTube title for video ${youtubeId}:`,
      error,
    );
    return null;
  }
}

/**
 * List of YouTube thumbnail resolutions to try, in order of preference
 */
const YOUTUBE_THUMBNAIL_RESOLUTIONS = [
  'maxresdefault.jpg', // Highest quality (1280x720)
  'sddefault.jpg', // Standard definition (640x480)
  'hqdefault.jpg', // High quality (480x360)
  'mqdefault.jpg', // Medium quality (320x180)
  'default.jpg', // Default quality (120x90)
];

/**
 * Finds the best available YouTube thumbnail URL by checking multiple resolutions
 * Returns undefined if no thumbnail is available
 */
async function getYouTubeThumbnailUrl(
  youtubeId: string,
): Promise<string | undefined> {
  for (const resolution of YOUTUBE_THUMBNAIL_RESOLUTIONS) {
    const url = `https://img.youtube.com/vi/${youtubeId}/${resolution}`;
    try {
      // Use HEAD request to check if image exists without downloading it
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'force-cache',
        headers: {
          'User-Agent': 'Audiofast-Website/1.0',
        },
      });

      if (response.ok) {
        return url;
      }
    } catch {
      // Continue to next resolution if this one fails
      continue;
    }
  }

  // No suitable thumbnail found after trying all resolutions
  return undefined;
}

export async function YoutubeVideoComponent({
  value,
}: PortableTextTypeComponentProps<YoutubeVideoValue>) {
  const { youtubeId, thumbnail, title } = value;

  if (!youtubeId) {
    return null;
  }

  // Fetch title from YouTube if not provided in Sanity
  const videoTitle = title || (await fetchYouTubeTitle(youtubeId));

  // Try to get YouTube thumbnail if no Sanity thumbnail is provided
  let thumbnailUrl: string | undefined;
  if (!thumbnail) {
    thumbnailUrl = await getYouTubeThumbnailUrl(youtubeId);
  }

  const imageSizes =
    '(max-width: 33.6875rem) 98vw, (max-width: 56.1875rem) 86vw, (max-width: 85.375rem) 43vw, 587px';

  return (
    <div className={styles.youtubeVideo}>
      {thumbnail ? (
        <Image
          image={thumbnail}
          className={styles.thumbnail}
          sizes={imageSizes}
          loading="lazy"
          fill
          style={{ objectFit: 'cover' }}
        />
      ) : thumbnailUrl ? (
        <NextImage
          src={thumbnailUrl}
          alt="Video thumbnail"
          className={styles.thumbnail}
          loading="lazy"
          fill
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div className={styles.placeholder}>
          <svg
            className={styles.placeholderIcon}
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M14.75 12L9.25 8.5V15.5L14.75 12Z" fill="currentColor" />
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <span className={styles.placeholderText}>Wideo YouTube</span>
        </div>
      )}
      {videoTitle && <span className={styles.titleText}>{videoTitle}</span>}
      <YoutubeVideoClient youtubeId={youtubeId} />
    </div>
  );
}
