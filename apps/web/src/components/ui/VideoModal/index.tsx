"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./styles.module.scss";

type VideoType = "youtube" | "vimeo";

interface VideoModalProps {
  videoId: string;
  videoType: VideoType;
  children?: (openModal: () => void) => React.ReactNode;
  playButtonSize?: "small" | "medium" | "large";
  playButtonClassName?: string;
  closeButtonLabel?: string;
}

function getEmbedUrl(videoType: VideoType, videoId: string): string {
  switch (videoType) {
    case "youtube":
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    case "vimeo":
      return `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`;
    default:
      return "";
  }
}

export default function VideoModal({
  videoId,
  videoType,
  children,
  playButtonSize = "medium",
  playButtonClassName,
  closeButtonLabel = "Zamknij wideo",
}: VideoModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Auto-focus close button when modal opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Close modal on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleOpen = () => {
    triggerRef.current = document.activeElement as HTMLElement;
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Restore focus to trigger element after a brief delay
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  };

  const embedUrl = getEmbedUrl(videoType, videoId);
  const playerTitle =
    videoType === "youtube" ? "YouTube video player" : "Vimeo video player";

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
        aria-label={closeButtonLabel}
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
            src={embedUrl}
            title={playerTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={styles.iframe}
          />
        </div>
      </div>
    </div>
  );

  // If custom children provided, use render prop pattern
  if (children) {
    return (
      <>
        {children(handleOpen)}
        {isOpen && createPortal(modal, document.body)}
      </>
    );
  }

  // Default: render styled play button
  const sizeClass = styles[playButtonSize];
  const buttonClass = `${styles.playButton} ${sizeClass} ${playButtonClassName || ""}`;

  return (
    <>
      <button
        type="button"
        className={buttonClass}
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
