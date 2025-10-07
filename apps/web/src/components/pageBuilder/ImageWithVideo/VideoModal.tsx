'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './styles.module.scss';

interface VideoModalProps {
  youtubeId: string;
}

export default function VideoModal({ youtubeId }: VideoModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus close button when modal opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
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
        type="button"
        className={styles.playButton}
        onClick={handleOpen}
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
      {isOpen && createPortal(modal, document.body)}
    </>
  );
}
