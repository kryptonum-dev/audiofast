'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import ArrowButton from '@/src/components/ui/ArrowButton';

import { useCustomerOrdersLoading } from '../CustomerOrdersLoadingContext';
import styles from './styles.module.scss';

const CUSTOMER_ORDERS_PENDING_SCROLL_TARGET_KEY =
  'customer-orders-pending-scroll-target';

type CustomerOrdersPaginationProps = {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  basePath: string;
  searchParams?: URLSearchParams;
  scrollTargetId?: string;
};

export default function CustomerOrdersPagination({
  totalItems,
  itemsPerPage,
  currentPage,
  basePath,
  searchParams,
  scrollTargetId,
}: CustomerOrdersPaginationProps) {
  const router = useRouter();
  const { startLoading } = useCustomerOrdersLoading();
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const scrollToTarget = useCallback(() => {
    if (!scrollTargetId) return;

    const target = document.getElementById(scrollTargetId);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollTargetId]);

  useEffect(() => {
    setPendingPage(null);

    if (!scrollTargetId) return;

    const pendingScrollTarget = window.sessionStorage.getItem(
      CUSTOMER_ORDERS_PENDING_SCROLL_TARGET_KEY,
    );

    if (pendingScrollTarget !== scrollTargetId) return;

    window.sessionStorage.removeItem(CUSTOMER_ORDERS_PENDING_SCROLL_TARGET_KEY);
    window.requestAnimationFrame(() => {
      scrollToTarget();
    });
  }, [currentPage, scrollTargetId, scrollToTarget]);

  const displayPage = pendingPage ?? currentPage;

  if (totalPages <= 1) return null;

  const markPendingScroll = () => {
    if (!scrollTargetId) return;

    window.sessionStorage.setItem(
      CUSTOMER_ORDERS_PENDING_SCROLL_TARGET_KEY,
      scrollTargetId,
    );
  };

  const getPageUrl = (pageNum: number): string => {
    if (pageNum < 1 || pageNum > totalPages) return '#';

    const params = searchParams
      ? new URLSearchParams(searchParams)
      : new URLSearchParams();

    if (pageNum > 1) {
      params.set('page', pageNum.toString());
    } else {
      params.delete('page');
    }

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const handlePageNavigate = (pageNum: number) => {
    const href = getPageUrl(pageNum);

    setPendingPage(pageNum);
    startLoading('pagination');
    markPendingScroll();
    scrollToTarget();
    router.push(href, { scroll: false });
  };

  const handlePrevPage = () => {
    const prevPage = displayPage - 1;

    if (prevPage >= 1) {
      setPendingPage(prevPage);
      startLoading('pagination');
      markPendingScroll();
      scrollToTarget();
      router.push(getPageUrl(prevPage), { scroll: false });
    }
  };

  const handleNextPage = () => {
    const nextPage = displayPage + 1;

    if (nextPage <= totalPages) {
      setPendingPage(nextPage);
      startLoading('pagination');
      markPendingScroll();
      scrollToTarget();
      router.push(getPageUrl(nextPage), { scroll: false });
    }
  };

  const renderPageNumbers = () => {
    const paginationCase = getPaginationCase(displayPage, totalPages);

    switch (paginationCase) {
      case 'FEW_PAGES':
        return Array.from({ length: totalPages }, (_, i) => i + 1).map(
          (pageNum) => (
            <PageNumber
              key={pageNum}
              pageNum={pageNum}
              href={getPageUrl(pageNum)}
              isActive={displayPage === pageNum}
              onNavigate={() => handlePageNavigate(pageNum)}
            />
          ),
        );

      case 'NEAR_START':
        return (
          <>
            <PageNumber
              pageNum={1}
              href={getPageUrl(1)}
              isActive={displayPage === 1}
              onNavigate={() => handlePageNavigate(1)}
            />
            <PageNumber
              pageNum={2}
              href={getPageUrl(2)}
              isActive={displayPage === 2}
              onNavigate={() => handlePageNavigate(2)}
            />
            <PageNumber
              pageNum={3}
              href={getPageUrl(3)}
              isActive={displayPage === 3}
              onNavigate={() => handlePageNavigate(3)}
            />
            <Ellipsis />
            <PageNumber
              pageNum={totalPages}
              href={getPageUrl(totalPages)}
              isActive={displayPage === totalPages}
              onNavigate={() => handlePageNavigate(totalPages)}
            />
          </>
        );

      case 'IN_MIDDLE':
        return (
          <>
            <PageNumber
              pageNum={1}
              href={getPageUrl(1)}
              isActive={displayPage === 1}
              onNavigate={() => handlePageNavigate(1)}
            />
            <Ellipsis />
            <PageNumber
              pageNum={displayPage}
              href={getPageUrl(displayPage)}
              isActive
              onNavigate={() => handlePageNavigate(displayPage)}
            />
            <Ellipsis />
            <PageNumber
              pageNum={totalPages}
              href={getPageUrl(totalPages)}
              isActive={displayPage === totalPages}
              onNavigate={() => handlePageNavigate(totalPages)}
            />
          </>
        );

      case 'NEAR_END':
        return (
          <>
            <PageNumber
              pageNum={1}
              href={getPageUrl(1)}
              isActive={displayPage === 1}
              onNavigate={() => handlePageNavigate(1)}
            />
            <Ellipsis />
            <PageNumber
              pageNum={totalPages - 2}
              href={getPageUrl(totalPages - 2)}
              isActive={displayPage === totalPages - 2}
              onNavigate={() => handlePageNavigate(totalPages - 2)}
            />
            <PageNumber
              pageNum={totalPages - 1}
              href={getPageUrl(totalPages - 1)}
              isActive={displayPage === totalPages - 1}
              onNavigate={() => handlePageNavigate(totalPages - 1)}
            />
            <PageNumber
              pageNum={totalPages}
              href={getPageUrl(totalPages)}
              isActive={displayPage === totalPages}
              onNavigate={() => handlePageNavigate(totalPages)}
            />
          </>
        );
    }
  };

  return (
    <nav className={styles.pagination} aria-label="Paginacja zamówień">
      <ArrowButton
        direction="prev"
        onClick={handlePrevPage}
        ariaLabel="Poprzednia strona zamówień"
        disabled={displayPage <= 1}
        variant="gray"
        size="md"
      />
      {renderPageNumbers()}
      <ArrowButton
        direction="next"
        onClick={handleNextPage}
        ariaLabel="Następna strona zamówień"
        disabled={displayPage >= totalPages}
        variant="gray"
        size="md"
      />
    </nav>
  );
}

function getPaginationCase(
  displayPage: number,
  totalPages: number,
): 'FEW_PAGES' | 'NEAR_START' | 'IN_MIDDLE' | 'NEAR_END' {
  if (totalPages <= 5) return 'FEW_PAGES';
  if (displayPage <= 2) return 'NEAR_START';
  if (displayPage >= totalPages - 1) return 'NEAR_END';

  return 'IN_MIDDLE';
}

function PageNumber({
  pageNum,
  href,
  isActive,
  onNavigate,
}: {
  pageNum: number;
  href: string;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  if (isActive) {
    return (
      <span
        className={`${styles.pageNumber} ${styles.active}`}
        aria-current="page"
      >
        {pageNum}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={styles.pageNumber}
      scroll={false}
      onClick={(event) => {
        if (!onNavigate) return;

        event.preventDefault();
        onNavigate();
      }}
    >
      {pageNum}
    </Link>
  );
}

function Ellipsis() {
  return <span className={styles.ellipsis}>···</span>;
}
