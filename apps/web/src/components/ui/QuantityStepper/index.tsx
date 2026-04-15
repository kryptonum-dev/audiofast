'use client';

import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from 'react';

import styles from './styles.module.scss';

export const DEFAULT_QUANTITY_STEPPER_MAX = 99;

export type QuantityStepperProps = {
  /** Committed quantity from parent state */
  quantity: number;
  min?: number;
  max?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /**
   * When set, the numeric field is editable and this runs on blur / Enter
   * after validation. Omitted fields are read-only.
   */
  onQuantityCommit?: (quantity: number) => void;
  /** After capping typed input to `max`; use e.g. for toast feedback */
  onCappedAtMax?: () => void;
  decrementAriaLabel?: string;
  incrementAriaLabel?: string;
  quantityInputAriaLabel?: string;
  className?: string;
  disableDecrement?: boolean;
  disableIncrement?: boolean;
  disabled?: boolean;
};

export default function QuantityStepper({
  quantity,
  min = 1,
  max = DEFAULT_QUANTITY_STEPPER_MAX,
  onIncrement,
  onDecrement,
  onQuantityCommit,
  onCappedAtMax,
  decrementAriaLabel = 'Zmniejsz ilość',
  incrementAriaLabel = 'Zwiększ ilość',
  quantityInputAriaLabel = 'Ilość',
  className,
  disableDecrement = false,
  disableIncrement = false,
  disabled = false,
}: QuantityStepperProps) {
  const [quantityInput, setQuantityInput] = useState(String(quantity));

  useEffect(() => {
    setQuantityInput(String(quantity));
  }, [quantity]);

  const commitQuantityInput = () => {
    if (disabled || !onQuantityCommit) {
      return;
    }

    const normalizedValue = quantityInput.trim();

    if (normalizedValue === '') {
      setQuantityInput(String(quantity));
      return;
    }

    const nextQuantity = Number.parseInt(normalizedValue, 10);

    if (!Number.isFinite(nextQuantity)) {
      setQuantityInput(String(quantity));
      return;
    }

    if (nextQuantity <= 0) {
      setQuantityInput(String(quantity));
      return;
    }

    if (nextQuantity > max) {
      setQuantityInput(String(max));
      onCappedAtMax?.();

      if (quantity !== max) {
        onQuantityCommit(max);
      }

      return;
    }

    const sanitizedQuantity = Math.max(min, Math.floor(nextQuantity));
    setQuantityInput(String(sanitizedQuantity));

    if (sanitizedQuantity !== quantity) {
      onQuantityCommit(sanitizedQuantity);
    }
  };

  const handleQuantityInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;

    if (/^\d*$/.test(nextValue)) {
      setQuantityInput(nextValue);
    }
  };

  const handleQuantityInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Escape') {
      setQuantityInput(String(quantity));
      event.currentTarget.blur();
    }
  };

  const rootClassName = [styles.quantityStepper, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName}>
      <button
        type="button"
        className={styles.button}
        aria-label={decrementAriaLabel}
        onClick={onDecrement}
        disabled={disabled || disableDecrement}
      >
        -
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className={styles.input}
        aria-label={quantityInputAriaLabel}
        value={quantityInput}
        onChange={handleQuantityInputChange}
        onBlur={commitQuantityInput}
        onKeyDown={handleQuantityInputKeyDown}
        readOnly={disabled || !onQuantityCommit}
        disabled={disabled}
      />
      <button
        type="button"
        className={styles.button}
        aria-label={incrementAriaLabel}
        onClick={onIncrement}
        disabled={disabled || disableIncrement || quantity >= max}
      >
        +
      </button>
    </div>
  );
}
