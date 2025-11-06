'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './styles.module.scss';

interface YoutubeVideoClientProps {
  youtubeId: string;
}

export function YoutubeVideoClient({ youtubeId }: YoutubeVideoClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus close button when modal opens
  useEffect(() => {
    if (isModalOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isModalOpen]);

  // Attach click handler to parent container
  useEffect(() => {
    if (!playButtonRef.current) return;

    const container = playButtonRef.current.parentElement;
    if (!container) return;

    const handleContainerClick = (e: MouseEvent) => {
      // Don't trigger if clicking directly on the button (let button handle it)
      const target = e.target as HTMLElement;
      if (playButtonRef.current?.contains(target)) {
        return;
      }

      // Trigger button click programmatically
      if (playButtonRef.current) {
        playButtonRef.current.click();
      }
    };

    container.addEventListener('click', handleContainerClick);

    return () => {
      container.removeEventListener('click', handleContainerClick);
    };
  }, []);

  const handleThumbnailClick = () => {
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  const modal = (
    <div
      className={styles.modalOverlay}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Video modal"
    >
      <button
        ref={closeButtonRef}
        type="button"
        className={styles.closeButton}
        onClick={handleClose}
        aria-label="Zamknij wideo"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M18 6L6 18M6 6L18 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.videoWrapper}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={styles.iframe}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={playButtonRef}
        className={styles.playButton}
        type="button"
        onClick={handleThumbnailClick}
      >
        <div className={styles.playButtonInner}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.playIcon}
          >
            <circle cx="16" cy="16" r="16" fill="currentColor" opacity="0.1" />
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
      {isModalOpen && createPortal(modal, document.body)}
    </>
  );
}
