'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import styles from './styles.module.scss';

type SearchbarProps = {
  placeholder?: string;
  basePath?: string;
  name?: string;
  debounceMs?: number;
  onSearch?: (searchTerm: string) => void;
};

export default function Searchbar({
  placeholder = 'Szukaj',
  basePath,
  name = 'search',
  debounceMs = 300,
  onSearch,
}: SearchbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Get initial value from URL params
  const urlSearchValue = searchParams.get(name) || '';

  // Controlled input state
  const [inputValue, setInputValue] = useState(urlSearchValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync input with URL params when they change externally
  useEffect(() => {
    const urlValue = searchParams.get(name) || '';
    setInputValue(urlValue);
  }, [searchParams, name]);

  // Update URL params
  const updateURLParams = useCallback(
    (value: string) => {
      // If custom handler provided, use it
      if (onSearch) {
        onSearch(value);
        return;
      }

      // Otherwise, handle navigation with URL params
      if (basePath) {
        const params = new URLSearchParams(searchParams.toString());

        if (value.trim()) {
          params.set(name, value.trim());
        } else {
          params.delete(name);
        }
        params.delete('page'); // Reset to page 1 when searching

        const queryString = params.toString();
        const newUrl = queryString ? `${basePath}?${queryString}` : basePath;

        startTransition(() => {
          router.push(newUrl);
        });
      }
    },
    [basePath, name, onSearch, router, searchParams]
  );

  // Debounced input change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // For 1-4 characters OR empty: instant search (no debounce)
    if (newValue.length <= 4) {
      updateURLParams(newValue);
    } else {
      // For 5+ characters: debounced search
      debounceTimerRef.current = setTimeout(() => {
        updateURLParams(newValue);
      }, debounceMs);
    }
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.searchbar}>
      <svg
        width="18"
        height="18"
        className={styles.searchIcon}
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 21L16.65 16.65"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        name={name}
        placeholder={placeholder}
        value={inputValue}
        className={styles.input}
        autoComplete="off"
        onChange={handleInputChange}
      />
    </div>
  );
}
