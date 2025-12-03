"use client";

import { useEffect, useRef } from "react";

import VideoModal from "../../ui/VideoModal";
import styles from "../YouTubeVideo/styles.module.scss";

interface VimeoVideoClientProps {
  vimeoId: string;
}

export function VimeoVideoClient({ vimeoId }: VimeoVideoClientProps) {
  const playButtonRef = useRef<HTMLButtonElement>(null);

  // Attach click handler to parent container to make whole area clickable
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

    container.addEventListener("click", handleContainerClick);

    return () => {
      container.removeEventListener("click", handleContainerClick);
    };
  }, []);

  return (
    <VideoModal videoId={vimeoId} videoType="vimeo" playButtonSize="medium">
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
              width="28"
              height="28"
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
  );
}
