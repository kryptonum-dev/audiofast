"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./styles.module.scss";

type PriceRangeProps = {
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  maxLimit?: number;
};

export default function PriceRange({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  maxLimit = 999999999,
}: PriceRangeProps) {
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);
  const [minInputValue, setMinInputValue] = useState(minValue.toString());
  const [maxInputValue, setMaxInputValue] = useState(maxValue.toString());
  const minRangeRef = useRef<HTMLInputElement>(null);
  const maxRangeRef = useRef<HTMLInputElement>(null);

  // Sync internal state with props when they change (e.g., when filters are cleared)
  useEffect(() => {
    setLocalMin(minValue);
    setMinInputValue(minValue.toString());
  }, [minValue]);

  useEffect(() => {
    setLocalMax(maxValue);
    setMaxInputValue(maxValue.toString());
  }, [maxValue]);

  // When maxLimit changes, clamp the max value if it exceeds the new limit
  // This handles cases like: user sets 180,000 → filters by brand → new limit is 155,000
  // But preserves user's choice if it's within the new limit (e.g., 60,000 → new limit 155,000)
  useEffect(() => {
    if (maxValue > maxLimit) {
      const clampedMax = maxLimit;
      setLocalMax(clampedMax);
      setMaxInputValue(clampedMax.toString());
      onMaxChange(clampedMax);
    }
  }, [maxLimit, maxValue, onMaxChange]);

  const handleMinRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      // Don't let min exceed max
      const newMin = Math.min(value, localMax);
      setLocalMin(newMin);
      setMinInputValue(newMin.toString());
      onMinChange(newMin);
    },
    [localMax, onMinChange],
  );

  const handleMaxRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      // Don't let max go below min, and ensure it's at least 1
      const newMax = Math.max(value, localMin, 1);
      setLocalMax(newMax);
      setMaxInputValue(newMax.toString());
      onMaxChange(newMax);
    },
    [localMin, onMaxChange],
  );

  const handleMinInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Allow empty string for easier editing
      if (value === "") {
        setMinInputValue("");
        return;
      }

      // Only allow positive integers
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 0) {
        return;
      }

      // Don't allow exceeding current max
      if (numValue > localMax) {
        return;
      }

      setMinInputValue(value);
    },
    [localMax],
  );

  const handleMaxInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Allow empty string for easier editing
      if (value === "") {
        setMaxInputValue("");
        return;
      }

      // Only allow positive integers
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 1) {
        return;
      }

      // Don't allow going below current min
      if (numValue < localMin) {
        return;
      }

      // Don't allow exceeding maxLimit
      if (numValue > maxLimit) {
        return;
      }

      setMaxInputValue(value);
    },
    [localMin, maxLimit],
  );

  const handleMinInputBlur = useCallback(() => {
    const numValue = parseInt(minInputValue, 10);

    if (isNaN(numValue) || minInputValue === "") {
      // Reset to current localMin if invalid
      setMinInputValue(localMin.toString());
      return;
    }

    // Clamp between 0 and localMax
    const clampedValue = Math.max(0, Math.min(numValue, localMax));
    setLocalMin(clampedValue);
    setMinInputValue(clampedValue.toString());
    onMinChange(clampedValue);
  }, [minInputValue, localMin, localMax, onMinChange]);

  const handleMaxInputBlur = useCallback(() => {
    const numValue = parseInt(maxInputValue, 10);

    if (isNaN(numValue) || maxInputValue === "") {
      // Reset to current localMax if invalid
      setMaxInputValue(localMax.toString());
      return;
    }

    // Clamp between localMin and maxLimit, ensuring minimum of 1
    const clampedValue = Math.max(localMin, 1, Math.min(numValue, maxLimit));
    setLocalMax(clampedValue);
    setMaxInputValue(clampedValue.toString());
    onMaxChange(clampedValue);
  }, [maxInputValue, localMin, localMax, maxLimit, onMaxChange]);

  // Calculate percentage positions for styling
  const minPercent = (localMin / maxLimit) * 100;
  const maxPercent = (localMax / maxLimit) * 100;

  // Format price with spaces for readability (Polish format)
  const formatPrice = (price: number) => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  return (
    <div className={styles.priceRange}>
      <div className={styles.header}>
        <h3 className={styles.title}>Cena (zł)</h3>
        <span className={styles.maxPriceHelper}>
          Max: {formatPrice(maxLimit)} zł
        </span>
      </div>

      {/* Dual Range Slider */}
      <div className={styles.sliderContainer}>
        <div className={styles.sliderTrack}>
          <div
            className={styles.sliderProgress}
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
            }}
          />
        </div>

        <input
          ref={minRangeRef}
          type="range"
          min={0}
          max={maxLimit}
          value={localMin}
          onChange={handleMinRangeChange}
          className={`${styles.rangeInput} ${styles.rangeMin}`}
          aria-label="Cena minimalna"
        />

        <input
          ref={maxRangeRef}
          type="range"
          min={1}
          max={maxLimit}
          value={localMax}
          onChange={handleMaxRangeChange}
          className={`${styles.rangeInput} ${styles.rangeMax}`}
          aria-label="Cena maksymalna"
        />
      </div>

      {/* Value Inputs */}
      <div className={styles.valuesWrapper}>
        <div className={styles.valueGroup}>
          <span className={styles.valueLabel}>od</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.valueInput}
            value={minInputValue}
            onChange={handleMinInputChange}
            onBlur={handleMinInputBlur}
            placeholder="0"
            aria-label="Cena minimalna (edytowalna)"
            aria-describedby="price-range-max-hint"
          />
        </div>
        <div className={styles.valueGroup}>
          <span className={styles.valueLabel}>do</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.valueInput}
            value={maxInputValue}
            onChange={handleMaxInputChange}
            onBlur={handleMaxInputBlur}
            placeholder={formatPrice(maxLimit)}
            aria-label="Cena maksymalna (edytowalna)"
            aria-describedby="price-range-max-hint"
          />
        </div>
      </div>
    </div>
  );
}
