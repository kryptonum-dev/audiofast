'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { SanityRawImage } from '@/components/shared/Image';
import ConfirmationModal from '@/src/components/ui/ConfirmationModal';
import type { FormStateData } from '@/src/components/ui/FormStates';

import ProductInquiryForm from './ProductInquiryForm';
import ProductSummary from './ProductSummary';
import styles from './styles.module.scss';

export interface ConfigurationOption {
  label: string;
  value: string;
  priceDelta: number; // in cents (0 for base, positive for additions)
}

export interface ProductContext {
  id: string;
  name: string;
  brandName: string;
  brandLogo?: SanityRawImage;
  image: SanityRawImage;
  basePrice: number; // in cents
  configurationOptions: ConfigurationOption[];
  totalPrice: number; // in cents
}

interface ProductInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductContext;
  formStateData?: FormStateData | null;
}

export default function ProductInquiryModal({
  isOpen,
  onClose,
  product,
  formStateData,
}: ProductInquiryModalProps) {
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle close attempt with unsaved changes check
  const handleCloseAttempt = useCallback(() => {
    if (isFormDirty) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }, [isFormDirty, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCloseAttempt();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleCloseAttempt]);

  // Confirm close (from warning modal)
  const handleConfirmClose = () => {
    setShowUnsavedWarning(false);
    setIsFormDirty(false);
    onClose();
  };

  // Cancel close (stay in modal)
  const handleCancelClose = () => {
    setShowUnsavedWarning(false);
  };

  // Handle form dirty state changes - memoized to prevent unnecessary re-renders
  const handleFormDirtyChange = useCallback((isDirty: boolean) => {
    setIsFormDirty(isDirty);
  }, []);

  // Reset dirty state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsFormDirty(false);
      setShowUnsavedWarning(false);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <>
      <div
        className={styles.overlay}
        onClick={handleCloseAttempt}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-inquiry-title"
      >
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleCloseAttempt}
            aria-label="Zamknij formularz"
          >
            <CloseIcon />
          </button>

          <div className={styles.content}>
            <h2 id="product-inquiry-title" className={styles.title}>
              Zapytaj o produkt
            </h2>

            <div className={styles.columns}>
              <div className={styles.productColumn}>
                <ProductSummary product={product} />
              </div>

              <div className={styles.formColumn}>
                <ProductInquiryForm
                  product={product}
                  onFormDirtyChange={handleFormDirtyChange}
                  formStateData={formStateData}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved changes warning */}
      <ConfirmationModal
        isOpen={showUnsavedWarning}
        onClose={handleCancelClose}
        onConfirm={handleConfirmClose}
        title="Niezapisane zmiany"
        message="Masz niewysłaną wiadomość. Czy na pewno chcesz zamknąć formularz? Wprowadzone dane zostaną utracone."
        confirmText="Zamknij formularz"
        cancelText="Wróć do formularza"
      />
    </>
  );

  return createPortal(modalContent, document.body);
}

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
