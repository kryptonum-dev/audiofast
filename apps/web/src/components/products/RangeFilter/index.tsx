'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './styles.module.scss';

type RangeFilterProps = {
  name: string;
  unit?: string;
  minValue: number; // Current selected min (from URL or default)
  maxValue: number; // Current selected max (from URL or default)
  minLimit: number; // Computed from products (smallest value)
  maxLimit: number; // Computed from products (largest value)
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
};

// Step is always 1 (hardcoded per requirements)
const STEP = 1;

export default function RangeFilter({
  name,
  unit,
  minValue,
  maxValue,
  minLimit,
  maxLimit,
  onMinChange,
  onMaxChange,
}: RangeFilterProps) {
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);
  const [minInputValue, setMinInputValue] = useState(minValue.toString());
  const [maxInputValue, setMaxInputValue] = useState(maxValue.toString());
  const minRangeRef = useRef<HTMLInputElement>(null);
  const maxRangeRef = useRef<HTMLInputElement>(null);

  // Sync internal state with props when they change
  useEffect(() => {
    setLocalMin(minValue);
    setMinInputValue(minValue.toString());
  }, [minValue]);

  useEffect(() => {
    setLocalMax(maxValue);
    setMaxInputValue(maxValue.toString());
  }, [maxValue]);

  // When maxLimit changes, clamp the max value if it exceeds the new limit
  useEffect(() => {
    if (maxValue > maxLimit) {
      const clampedMax = maxLimit;
      setLocalMax(clampedMax);
      setMaxInputValue(clampedMax.toString());
      onMaxChange(clampedMax);
    }
  }, [maxLimit, maxValue, onMaxChange]);

  // When minLimit changes, clamp the min value if it's below the new limit
  useEffect(() => {
    if (minValue < minLimit) {
      const clampedMin = minLimit;
      setLocalMin(clampedMin);
      setMinInputValue(clampedMin.toString());
      onMinChange(clampedMin);
    }
  }, [minLimit, minValue, onMinChange]);

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
      // Don't let max go below min
      const newMax = Math.max(value, localMin);
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
      if (value === '') {
        setMinInputValue('');
        return;
      }

      // Only allow digits and minus sign
      if (!/^-?\d*$/.test(value)) {
        return;
      }

      setMinInputValue(value);
    },
    [],
  );

  const handleMaxInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Allow empty string for easier editing
      if (value === '') {
        setMaxInputValue('');
        return;
      }

      // Only allow digits and minus sign
      if (!/^-?\d*$/.test(value)) {
        return;
      }

      setMaxInputValue(value);
    },
    [],
  );

  const handleMinInputBlur = useCallback(() => {
    const numValue = parseInt(minInputValue, 10);

    if (isNaN(numValue) || minInputValue === '') {
      // Reset to current localMin if invalid
      setMinInputValue(localMin.toString());
      return;
    }

    // Clamp between minLimit and localMax
    const clampedValue = Math.max(minLimit, Math.min(numValue, localMax));
    setLocalMin(clampedValue);
    setMinInputValue(clampedValue.toString());
    onMinChange(clampedValue);
  }, [minInputValue, localMin, localMax, minLimit, onMinChange]);

  const handleMaxInputBlur = useCallback(() => {
    const numValue = parseInt(maxInputValue, 10);

    if (isNaN(numValue) || maxInputValue === '') {
      // Reset to current localMax if invalid
      setMaxInputValue(localMax.toString());
      return;
    }

    // Clamp between localMin and maxLimit
    const clampedValue = Math.max(localMin, Math.min(numValue, maxLimit));
    setLocalMax(clampedValue);
    setMaxInputValue(clampedValue.toString());
    onMaxChange(clampedValue);
  }, [maxInputValue, localMin, localMax, maxLimit, onMaxChange]);

  // Calculate percentage positions for styling
  const range = maxLimit - minLimit;
  const minPercent = range > 0 ? ((localMin - minLimit) / range) * 100 : 0;
  const maxPercent = range > 0 ? ((localMax - minLimit) / range) * 100 : 100;

  return (
    <div className={styles.rangeFilter}>
      <div className={styles.header}>
        <h4 className={styles.title}>
          {name}
          {unit && <span className={styles.unit}> ({unit})</span>}
        </h4>
        <span className={styles.rangeHelper}>
          {minLimit} - {maxLimit}
          {unit && ` ${unit}`}
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
          min={minLimit}
          max={maxLimit}
          step={STEP}
          value={localMin}
          onChange={handleMinRangeChange}
          className={`${styles.rangeInput} ${styles.rangeMin}`}
          aria-label={`${name} minimalna wartość`}
        />

        <input
          ref={maxRangeRef}
          type="range"
          min={minLimit}
          max={maxLimit}
          step={STEP}
          value={localMax}
          onChange={handleMaxRangeChange}
          className={`${styles.rangeInput} ${styles.rangeMax}`}
          aria-label={`${name} maksymalna wartość`}
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
            placeholder={minLimit.toString()}
            aria-label={`${name} minimalna wartość (edytowalna)`}
          />
          {unit && <span className={styles.unitSuffix}>{unit}</span>}
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
            placeholder={maxLimit.toString()}
            aria-label={`${name} maksymalna wartość (edytowalna)`}
          />
          {unit && <span className={styles.unitSuffix}>{unit}</span>}
        </div>
      </div>
    </div>
  );
}
