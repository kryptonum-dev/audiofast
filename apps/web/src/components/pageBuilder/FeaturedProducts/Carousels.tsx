'use client';

import type { EmblaCarouselType } from 'embla-carousel';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import ArrowButton from '../../ui/ArrowButton';
import type { ProductType } from '../../ui/ProductCard';
import ProductsCarousel from './ProductsCarousel';
import styles from './styles.module.scss';

type Props = {
  children: ReactNode;
  newProducts: ProductType[];
  bestsellers: ProductType[];
  index: number;
};

type TabType = 'newProducts' | 'bestsellers';

export default function Carousels({
  children,
  newProducts,
  bestsellers,
  index,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('newProducts');
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

  const newProductsApiRef = useRef<EmblaCarouselType | null>(null);
  const bestsellersApiRef = useRef<EmblaCarouselType | null>(null);

  // Get the currently active carousel API
  const getActiveApi = useCallback(() => {
    return activeTab === 'newProducts'
      ? newProductsApiRef.current
      : bestsellersApiRef.current;
  }, [activeTab]);

  // Navigation functions
  const scrollPrev = useCallback(() => {
    const api = getActiveApi();
    if (api) api.scrollPrev();
  }, [getActiveApi]);

  const scrollNext = useCallback(() => {
    const api = getActiveApi();
    if (api) api.scrollNext();
  }, [getActiveApi]);

  // Update button states based on active carousel
  const onSelect = useCallback((api: EmblaCarouselType) => {
    setPrevBtnDisabled(!api.canScrollPrev());
    setNextBtnDisabled(!api.canScrollNext());
  }, []);

  // Handle API changes from carousels
  const handleNewProductsApi = useCallback(
    (api: EmblaCarouselType) => {
      newProductsApiRef.current = api;
      if (activeTab === 'newProducts') {
        onSelect(api);
        api.on('reInit', onSelect);
        api.on('select', onSelect);
      }
    },
    [activeTab, onSelect]
  );

  const handleBestsellersApi = useCallback(
    (api: EmblaCarouselType) => {
      bestsellersApiRef.current = api;
      if (activeTab === 'bestsellers') {
        onSelect(api);
        api.on('reInit', onSelect);
        api.on('select', onSelect);
      }
    },
    [activeTab, onSelect]
  );

  // Update button states when switching tabs
  useEffect(() => {
    const activeApi = getActiveApi();
    if (activeApi) {
      onSelect(activeApi);
    }
  }, [activeTab, getActiveApi, onSelect]);

  const tabs = [
    { key: 'newProducts' as const, label: 'Nowości', products: newProducts },
    {
      key: 'bestsellers' as const,
      label: 'Bestsellery',
      products: bestsellers,
    },
  ];

  return (
    <>
      <header className={styles.header}>
        <div className={styles.tabSwitcher} data-active-tab={activeTab}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tabButton} ${
                activeTab === tab.key ? 'data-active' : ''
              }`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
          <div className={styles.tabSwitcherIndicator} />
        </div>
        {children}
      </header>

      {/* Carousels */}
      <div className={styles.carousel}>
        {activeTab === 'newProducts' && (
          <ProductsCarousel
            products={newProducts}
            sectionType="newProducts"
            onApiChange={handleNewProductsApi}
            index={index}
          />
        )}
        {activeTab === 'bestsellers' && (
          <ProductsCarousel
            products={bestsellers}
            sectionType="bestsellers"
            onApiChange={handleBestsellersApi}
            index={index}
          />
        )}
        {((activeTab === 'newProducts' && newProducts.length > 3) ||
          (activeTab === 'bestsellers' && bestsellers.length > 3)) && (
          <div className={styles.buttons}>
            <ArrowButton
              direction="prev"
              onClick={scrollPrev}
              disabled={prevBtnDisabled}
              variant="filled"
              size="md"
            />
            <ArrowButton
              direction="next"
              onClick={scrollNext}
              disabled={nextBtnDisabled}
              variant="filled"
              size="md"
            />
          </div>
        )}
      </div>
    </>
  );
}
