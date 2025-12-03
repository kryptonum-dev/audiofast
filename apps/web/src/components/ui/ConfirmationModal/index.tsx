"use client";

import { useEffect } from "react";

import Button from "../Button";
import styles from "./styles.module.scss";

type ConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Potwierdź",
  cancelText = "Anuluj",
}: ConfirmationModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-message"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.iconWrapper}>
          <AlertIcon />
        </div>

        <h2 className={styles.title} id="confirmation-title">
          {title}
        </h2>
        <p className={styles.message} id="confirmation-message">
          {message}
        </p>

        <div className={styles.actions}>
          <Button
            className={styles.cancelButton}
            onClick={onClose}
            type="button"
            variant="secondary"
          >
            {cancelText}
          </Button>
          <Button
            className={styles.confirmButton}
            onClick={handleConfirm}
            type="button"
            iconUsed="trash"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M9.996 20.777a8.94 8.94 0 0 1-2.48-.97M14 3.223a9.003 9.003 0 0 1 0 17.554M4.579 17.093a8.963 8.963 0 0 1-1.227-2.592M3.125 10.5c.16-.95.468-1.85.9-2.675l.169-.305M6.906 4.579A8.954 8.954 0 0 1 10 3.223M12 8v4M12 16v.01" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
