'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import {
  CUSTOMER_ORDERS_SORT_OPTIONS,
  type CustomerOrdersSortBy,
  parseCustomerOrdersSortBy,
} from '@/src/global/b2c/customer-auth/orders-listing-query';

import { useCustomerOrdersLoading } from '../CustomerOrdersLoadingContext';
import styles from './styles.module.scss';

type CustomerOrdersSortDropdownProps = {
  basePath: string;
  defaultValue?: CustomerOrdersSortBy;
  label?: string;
};

export default function CustomerOrdersSortDropdown({
  basePath,
  defaultValue = 'newest',
  label = 'Sortuj:',
}: CustomerOrdersSortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading } = useCustomerOrdersLoading();
  const [, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<CustomerOrdersSortBy | null>(
    null,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const urlValue = parseCustomerOrdersSortBy(searchParams.get('sortBy'));
  const currentValue = pendingValue ?? urlValue;
  const currentLabel =
    CUSTOMER_ORDERS_SORT_OPTIONS.find((option) => option.value === currentValue)
      ?.label ?? CUSTOMER_ORDERS_SORT_OPTIONS[0].label;

  useEffect(() => {
    setPendingValue(null);
  }, [urlValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleFocusOut = (event: FocusEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.relatedTarget as Node)
      ) {
        setIsOpen(false);
      }
    };

    const dropdownElement = dropdownRef.current;
    dropdownElement?.addEventListener('focusout', handleFocusOut);

    return () => {
      dropdownElement?.removeEventListener('focusout', handleFocusOut);
    };
  }, [isOpen]);

  const handleOptionClick = (value: CustomerOrdersSortBy) => {
    setPendingValue(value);

    const params = new URLSearchParams(searchParams.toString());

    if (value === defaultValue) {
      params.delete('sortBy');
    } else {
      params.set('sortBy', value);
    }

    params.delete('page');

    const queryString = params.toString();
    const nextUrl = queryString ? `${basePath}?${queryString}` : basePath;

    startLoading('sort');
    startTransition(() => {
      router.push(nextUrl, { scroll: false });
    });
    setIsOpen(false);
  };

  return (
    <div className={styles.sortDropdown} ref={dropdownRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className={styles.labelSection}>
          <FilterIcon />
          <span className={styles.label}>{label}</span>
        </div>
        <div className={styles.valueSection}>
          <span className={styles.value}>{currentLabel}</span>
          <SortIcon />
        </div>
      </button>

      {isOpen ? (
        <div className={styles.dropdown} role="listbox">
          {CUSTOMER_ORDERS_SORT_OPTIONS.map((option) => {
            const isActive = currentValue === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`${styles.option} ${isActive ? styles.active : ''}`}
                onClick={() => handleOptionClick(option.value)}
                tabIndex={isActive ? -1 : 0}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none">
    <path
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="M3.6 1.4h8.8c.733 0 1.333.6 1.333 1.333V4.2c0 .533-.333 1.2-.666 1.533L10.2 8.267c-.4.333-.667 1-.667 1.533v2.867c0 .4-.266.933-.6 1.133L8 14.4c-.867.533-2.067-.067-2.067-1.133V9.733c0-.466-.266-1.066-.533-1.4L2.867 5.667c-.334-.334-.6-.934-.6-1.334V2.8c0-.8.6-1.4 1.333-1.4ZM7.287 1.4 4 6.667"
    />
  </svg>
);

const SortIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none">
    <path
      stroke="#FE0140"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M2 4.667h12M4 8h8M6.667 11.333h2.666"
    />
  </svg>
);
