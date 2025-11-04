'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import ArrowButton from '../ArrowButton';
import styles from './styles.module.scss';

type PaginationProps = {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  basePath: string;
  searchParams?: URLSearchParams;
};

export default function Pagination({
  totalItems,
  itemsPerPage,
  currentPage,
  basePath,
  searchParams,
}: PaginationProps) {
  const router = useRouter();
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Don't render if only 1 page
  if (totalPages <= 1) return null;

  const getPageUrl = (pageNum: number): string => {
    if (pageNum < 1 || pageNum > totalPages) return '#';

    // Clone the existing search params properly using the URLSearchParams constructor
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

  const getPaginationCase = ():
    | 'FEW_PAGES'
    | 'NEAR_START'
    | 'IN_MIDDLE'
    | 'NEAR_END' => {
    if (totalPages <= 5) return 'FEW_PAGES';
    if (currentPage <= 2) return 'NEAR_START';
    if (currentPage >= totalPages - 1) return 'NEAR_END';
    return 'IN_MIDDLE';
  };

  const renderPageNumbers = () => {
    const paginationCase = getPaginationCase();

    switch (paginationCase) {
      case 'FEW_PAGES':
        // Show all pages: 1, 2, 3, 4, 5
        return Array.from({ length: totalPages }, (_, i) => i + 1).map(
          (pageNum) => (
            <PageNumber
              key={pageNum}
              pageNum={pageNum}
              href={getPageUrl(pageNum)}
              isActive={currentPage === pageNum}
            />
          )
        );

      case 'NEAR_START':
        // Show: 1, 2, 3, ..., last
        return (
          <>
            <PageNumber
              pageNum={1}
              href={getPageUrl(1)}
              isActive={currentPage === 1}
            />
            <PageNumber
              pageNum={2}
              href={getPageUrl(2)}
              isActive={currentPage === 2}
            />
            <PageNumber
              pageNum={3}
              href={getPageUrl(3)}
              isActive={currentPage === 3}
            />
            <Ellipsis />
            <PageNumber
              pageNum={totalPages}
              href={getPageUrl(totalPages)}
              isActive={currentPage === totalPages}
            />
          </>
        );

      case 'IN_MIDDLE':
        // Show: 1, ..., current, ..., last
        return (
          <>
            <PageNumber pageNum={1} href={getPageUrl(1)} isActive={false} />
            <Ellipsis />
            <PageNumber
              pageNum={currentPage}
              href={getPageUrl(currentPage)}
              isActive={true}
            />
            <Ellipsis />
            <PageNumber
              pageNum={totalPages}
              href={getPageUrl(totalPages)}
              isActive={false}
            />
          </>
        );

      case 'NEAR_END':
        // Show: 1, ..., (last-2), (last-1), last
        return (
          <>
            <PageNumber pageNum={1} href={getPageUrl(1)} isActive={false} />
            <Ellipsis />
            <PageNumber
              pageNum={totalPages - 2}
              href={getPageUrl(totalPages - 2)}
              isActive={currentPage === totalPages - 2}
            />
            <PageNumber
              pageNum={totalPages - 1}
              href={getPageUrl(totalPages - 1)}
              isActive={currentPage === totalPages - 1}
            />
            <PageNumber
              pageNum={totalPages}
              href={getPageUrl(totalPages)}
              isActive={currentPage === totalPages}
            />
          </>
        );
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      router.push(getPageUrl(currentPage - 1), { scroll: false });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      router.push(getPageUrl(currentPage + 1), { scroll: false });
    }
  };

  return (
    <nav className={styles.pagination} aria-label="Paginacja">
      {/* Previous Arrow */}
      <ArrowButton
        direction="prev"
        onClick={handlePrevPage}
        ariaLabel="Poprzednia strona"
        disabled={currentPage <= 1}
        variant="gray"
        size="md"
      />

      {/* Page Numbers */}
      {renderPageNumbers()}

      {/* Next Arrow */}
      <ArrowButton
        direction="next"
        onClick={handleNextPage}
        ariaLabel="Następna strona"
        disabled={currentPage >= totalPages}
        variant="gray"
        size="md"
      />
    </nav>
  );
}

// Helper Components
function PageNumber({
  pageNum,
  href,
  isActive,
}: {
  pageNum: number;
  href: string;
  isActive: boolean;
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
    <Link href={href} className={styles.pageNumber} scroll={false}>
      {pageNum}
    </Link>
  );
}

function Ellipsis() {
  return <span className={styles.ellipsis}>···</span>;
}
