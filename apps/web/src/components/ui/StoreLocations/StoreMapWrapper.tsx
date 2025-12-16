'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import type { StoreWithLocation } from './index';
import styles from './styles.module.scss';

const MapSkeleton = () => (
  <div className={styles.mapSkeleton}>
    <div className={styles.skeletonPulse}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
          fill="currentColor"
          opacity="0.3"
        />
      </svg>
      <p>Ładowanie mapy...</p>
    </div>
  </div>
);

const StoreMap = dynamic(() => import('./StoreMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

interface StoreMapWrapperProps {
  stores: StoreWithLocation[];
  mapCenter: [number, number];
}

export default function StoreMapWrapper({
  stores,
  mapCenter,
}: StoreMapWrapperProps) {
  const [isInView, setIsInView] = useState(false);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const idleCallbackRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Use callback ref to ensure we observe as soon as element is mounted
  const containerRef = (node: HTMLDivElement | null) => {
    if (!node) return;

    // Clean up existing observer if any
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // Once loaded, disconnect the observer
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before it comes into view
        threshold: 0.01,
      },
    );

    // Start observing
    observerRef.current.observe(node);
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (idleCallbackRef.current && typeof window !== 'undefined') {
        window.cancelIdleCallback?.(idleCallbackRef.current);
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isInView || shouldLoadMap) {
      return;
    }

    if (typeof window === 'undefined') {
      setShouldLoadMap(true);
      return;
    }

    const activateMap = () => setShouldLoadMap(true);

    if (typeof window.requestIdleCallback === 'function') {
      idleCallbackRef.current = window.requestIdleCallback(activateMap, {
        timeout: 1200,
      });
    } else {
      timeoutRef.current = window.setTimeout(activateMap, 1200);
    }

    return () => {
      if (idleCallbackRef.current && typeof window !== 'undefined') {
        window.cancelIdleCallback?.(idleCallbackRef.current);
        idleCallbackRef.current = null;
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isInView, shouldLoadMap]);

  if (stores.length === 0) {
    return (
      <div className={styles.mapPlaceholder}>
        <p>Nie znaleziono lokalizacji dla wybranych sklepów</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.mapWrapper}>
      {isInView && shouldLoadMap ? (
        <StoreMap stores={stores} mapCenter={mapCenter} />
      ) : (
        <MapSkeleton />
      )}
    </div>
  );
}
