import NextImage from "next/image";
import type { PortableTextTypeComponentProps } from "next-sanity";

import type { PortableTextProps } from "@/src/global/types";

import Image from "../../shared/Image";
import styles from "../YouTubeVideo/styles.module.scss";
import { VimeoVideoClient } from "./VimeoVideoClient";

type VimeoVideoValue = NonNullable<PortableTextProps>[number] & {
  _type: "ptVimeoVideo";
};

/**
 * Fetches Vimeo video title using oEmbed API
 * Falls back to null if fetch fails or title is not available
 */
async function fetchVimeoTitle(vimeoId: string): Promise<string | null> {
  try {
    const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`;

    const response = await fetch(oEmbedUrl, {
      cache: "force-cache",
      headers: {
        "User-Agent": "Audiofast-Website/1.0",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.title || null;
  } catch (error) {
    console.error(`Error fetching Vimeo title for video ${vimeoId}:`, error);
    return null;
  }
}

/**
 * Fetches Vimeo thumbnail URL using oEmbed API
 */
async function getVimeoThumbnailUrl(
  vimeoId: string,
): Promise<string | undefined> {
  try {
    const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`;

    const response = await fetch(oEmbedUrl, {
      cache: "force-cache",
      headers: {
        "User-Agent": "Audiofast-Website/1.0",
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json();
    // Vimeo oEmbed returns thumbnail_url at various sizes
    // We can modify the size by changing the URL
    const thumbnailUrl = data?.thumbnail_url;
    if (thumbnailUrl) {
      // Replace the size in URL to get higher resolution (default is 640)
      return thumbnailUrl.replace(/_\d+x\d+/, "_1280x720");
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function VimeoVideoComponent({
  value,
}: PortableTextTypeComponentProps<VimeoVideoValue>) {
  const { vimeoId, thumbnail, title } = value;

  if (!vimeoId) {
    return null;
  }

  // Fetch title from Vimeo if not provided in Sanity
  const videoTitle = title || (await fetchVimeoTitle(vimeoId));

  // Try to get Vimeo thumbnail if no Sanity thumbnail is provided
  let thumbnailUrl: string | undefined;
  if (!thumbnail) {
    thumbnailUrl = await getVimeoThumbnailUrl(vimeoId);
  }

  const imageSizes =
    "(max-width: 33.6875rem) 98vw, (max-width: 56.1875rem) 86vw, (max-width: 85.375rem) 43vw, 587px";

  return (
    <div className={styles.youtubeVideo}>
      {thumbnail ? (
        <Image
          image={thumbnail}
          className={styles.thumbnail}
          sizes={imageSizes}
          loading="lazy"
          fill
          style={{ objectFit: "cover" }}
        />
      ) : thumbnailUrl ? (
        <NextImage
          src={thumbnailUrl}
          alt="Video thumbnail"
          className={styles.thumbnail}
          loading="lazy"
          fill
          style={{ objectFit: "cover" }}
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
          <span className={styles.placeholderText}>Wideo Vimeo</span>
        </div>
      )}
      {videoTitle && <span className={styles.titleText}>{videoTitle}</span>}
      <VimeoVideoClient vimeoId={vimeoId} />
    </div>
  );
}
