'use client';

import NextImage from 'next/image';
import { useEffect, useRef, useState } from 'react';

import Image from '../../shared/Image';
import VideoModal from '../VideoModal';
import styles from './styles.module.scss';

interface VimeoBlockProps {
  vimeoId: string;
  title?: string;
  thumbnail?: {
    id: string;
    preview?: string;
    alt?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    hotspot?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    crop?: {
      bottom: number;
      left: number;
      right: number;
      top: number;
    };
  };
}

export function VimeoBlock({ vimeoId, title, thumbnail }: VimeoBlockProps) {
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(title || null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(
    undefined
  );

  // Fetch title and thumbnail from Vimeo if not provided
  useEffect(() => {
    async function fetchVideoData() {
      try {
        const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`;
        const response = await fetch(oEmbedUrl);
        if (response.ok) {
          const data = await response.json();
          if (!title && data?.title) {
            setVideoTitle(data.title);
          }
          if (!thumbnail && data?.thumbnail_url) {
            // Get higher resolution thumbnail
            const highResThumbnail = data.thumbnail_url.replace(
              /_\d+x\d+/,
              '_1280x720'
            );
            setThumbnailUrl(highResThumbnail);
          }
        }
      } catch {
        // Ignore errors
      }
    }

    fetchVideoData();
  }, [vimeoId, title, thumbnail]);

  // Attach click handler to parent container to make whole area clickable
  useEffect(() => {
    if (!playButtonRef.current) return;

    const container = playButtonRef.current.parentElement;
    if (!container) return;

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (playButtonRef.current?.contains(target)) {
        return;
      }
      if (playButtonRef.current) {
        playButtonRef.current.click();
      }
    };

    container.addEventListener('click', handleContainerClick);

    return () => {
      container.removeEventListener('click', handleContainerClick);
    };
  }, []);

  const imageSizes =
    '(max-width: 33.6875rem) 98vw, (max-width: 56.1875rem) 86vw, (max-width: 85.375rem) 90vw, 1238px';

  return (
    <div className={styles.youtubeBlock}>
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
          <span className={styles.placeholderText}>Wideo Vimeo</span>
        </div>
      )}
      {videoTitle && <span className={styles.titleText}>{videoTitle}</span>}
      <VideoModal videoId={vimeoId} videoType="vimeo" playButtonSize="large">
        {(openModal) => (
          <button
            ref={playButtonRef}
            className={styles.playButton}
            type="button"
            onClick={openModal}
            aria-label="Odtwórz wideo"
          >
            <div className={styles.playButtonInner}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={styles.playIcon}
              >
                <circle
                  cx="16"
                  cy="16"
                  r="16"
                  fill="currentColor"
                  opacity="0.1"
                />
                <path
                  d="M12 9.5L23 16L12 22.5V9.5Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>
        )}
      </VideoModal>
    </div>
  );
}

