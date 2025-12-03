"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { SanityRawImage } from "../../shared/Image";
import Image from "../../shared/Image";
import ArrowButton from "../../ui/ArrowButton";
import styles from "./styles.module.scss";

type Props = {
  images: SanityRawImage[];
};

export function Slider({ images }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const [isImageTransitioning, setIsImageTransitioning] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Determine carousel behavior based on image count
  // 4-5 images: double them for smoother looping experience
  // 6+ images: use as-is with looping enabled
  const shouldDouble = images.length >= 4 && images.length <= 5;
  const shouldLoop = images.length >= 6 || shouldDouble;

  // Create the display images array (doubled if needed)
  const displayImages = useMemo(() => {
    if (shouldDouble) {
      return [...images, ...images];
    }
    return images;
  }, [images, shouldDouble]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: shouldLoop,
    align: "start",
    skipSnaps: false,
    containScroll: shouldLoop ? undefined : "trimSnaps",
    slidesToScroll: 1,
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Modal handlers - always use original images for modal
  const openModal = useCallback(
    (displayIndex: number) => {
      triggerRef.current = document.activeElement as HTMLElement;
      // Map display index back to original image index (handles doubled images)
      const originalIndex = displayIndex % images.length;
      setModalIndex(originalIndex);
      setIsModalOpen(true);
    },
    [images.length],
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  }, []);

  const changeModalImage = useCallback(
    (newIndex: number) => {
      if (isImageTransitioning) return;
      setIsImageTransitioning(true);
      // After fade out, change the image
      setTimeout(() => {
        setModalIndex(newIndex);
        setIsImageTransitioning(false);
      }, 150);
    },
    [isImageTransitioning],
  );

  const modalPrev = useCallback(() => {
    const newIndex = modalIndex === 0 ? images.length - 1 : modalIndex - 1;
    changeModalImage(newIndex);
  }, [modalIndex, images.length, changeModalImage]);

  const modalNext = useCallback(() => {
    const newIndex = modalIndex === images.length - 1 ? 0 : modalIndex + 1;
    changeModalImage(newIndex);
  }, [modalIndex, images.length, changeModalImage]);

  // Auto-focus close button when modal opens
  useEffect(() => {
    if (isModalOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isModalOpen]);

  // Close modal on ESC key and handle arrow navigation
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      } else if (e.key === "ArrowLeft") {
        modalPrev();
      } else if (e.key === "ArrowRight") {
        modalNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, closeModal, modalPrev, modalNext]);

  // Responsive sizes for square images in grid
  const slideSizes =
    "(max-width: 35.9375rem) 45vw, (max-width: 56.125rem) 30vw, 200px";

  const modal = (
    <div
      className={styles.modalOverlay}
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
      aria-label="Podgląd zdjęcia"
    >
      <button
        ref={closeButtonRef}
        type="button"
        className={styles.closeButton}
        onClick={closeModal}
        aria-label="Zamknij podgląd"
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

      <div
        className={styles.modalNavigation}
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowButton
          direction="prev"
          onClick={modalPrev}
          ariaLabel="Poprzednie zdjęcie"
          variant="ghost"
          outline="light"
        />
      </div>

      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div
          className={styles.modalImageWrapper}
          data-transitioning={isImageTransitioning}
        >
          <Image
            image={images[modalIndex]}
            sizes="(max-width: 87.5rem) 90vw, 75rem"
            loading="eager"
            className={styles.modalImage}
          />
        </div>
        <div className={styles.modalCounter}>
          {modalIndex + 1} / {images.length}
        </div>
      </div>

      <div
        className={styles.modalNavigation}
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowButton
          direction="next"
          onClick={modalNext}
          ariaLabel="Następne zdjęcie"
          variant="ghost"
          outline="light"
        />
      </div>
    </div>
  );

  return (
    <figure className={styles.wrapper} data-no-wrapper>
      <div className={styles.sliderContainer}>
        <div className={styles.viewport} ref={emblaRef}>
          <div className={styles.slides}>
            {displayImages.map((image, index) => (
              <button
                key={index}
                type="button"
                className={styles.slide}
                onClick={() => openModal(index)}
                aria-label={`Powiększ zdjęcie ${(index % images.length) + 1}`}
              >
                <Image
                  image={image}
                  sizes={slideSizes}
                  loading="lazy"
                  className={styles.slideImage}
                />
                <div className={styles.zoomIcon}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11ZM11 8V14M8 11H14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controls}>
          <ArrowButton
            direction="prev"
            onClick={scrollPrev}
            ariaLabel="Poprzednie zdjęcia"
            variant="ghost"
            outline="light"
          />
          <ArrowButton
            direction="next"
            onClick={scrollNext}
            ariaLabel="Następne zdjęcia"
            variant="ghost"
            outline="light"
          />
        </div>
      </div>

      {isModalOpen && createPortal(modal, document.body)}
    </figure>
  );
}
