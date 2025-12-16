"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useProductsLoading } from "../../products/ProductsLoadingContext";
import ArrowButton from "../ArrowButton";
import styles from "./styles.module.scss";

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
  const { startLoading } = useProductsLoading();
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Clear pending page when actual currentPage changes (navigation complete)
  useEffect(() => {
    setPendingPage(null);
  }, [currentPage]);

  // Use pending page for optimistic UI, fall back to actual current page
  const displayPage = pendingPage ?? currentPage;

  // Helper to trigger pagination loading with optimistic update
  const handlePageNavigate = (pageNum: number) => {
    setPendingPage(pageNum);
    startLoading("pagination");
  };

  // Don't render if only 1 page
  if (totalPages <= 1) return null;

  const getPageUrl = (pageNum: number): string => {
    if (pageNum < 1 || pageNum > totalPages) return "#";

    // Clone the existing search params properly using the URLSearchParams constructor
    const params = searchParams
      ? new URLSearchParams(searchParams)
      : new URLSearchParams();

    if (pageNum > 1) {
      params.set("page", pageNum.toString());
    } else {
      params.delete("page");
    }

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const getPaginationCase = ():
    | "FEW_PAGES"
    | "NEAR_START"
    | "IN_MIDDLE"
    | "NEAR_END" => {
    if (totalPages <= 5) return "FEW_PAGES";
    if (displayPage <= 2) return "NEAR_START";
    if (displayPage >= totalPages - 1) return "NEAR_END";
    return "IN_MIDDLE";
  };

  const renderPageNumbers = () => {
    const paginationCase = getPaginationCase();

    switch (paginationCase) {
      case "FEW_PAGES":
        // Show all pages: 1, 2, 3, 4, 5
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

      case "NEAR_START":
        // Show: 1, 2, 3, ..., last
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

      case "IN_MIDDLE":
        // Show: 1, ..., current, ..., last
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
              isActive={true}
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

      case "NEAR_END":
        // Show: 1, ..., (last-2), (last-1), last
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

  const handlePrevPage = () => {
    const prevPage = displayPage - 1;
    if (prevPage >= 1) {
      setPendingPage(prevPage);
      startLoading("pagination");
      router.push(getPageUrl(prevPage), { scroll: false });
    }
  };

  const handleNextPage = () => {
    const nextPage = displayPage + 1;
    if (nextPage <= totalPages) {
      setPendingPage(nextPage);
      startLoading("pagination");
      router.push(getPageUrl(nextPage), { scroll: false });
    }
  };

  return (
    <nav className={styles.pagination} aria-label="Paginacja">
      {/* Previous Arrow */}
      <ArrowButton
        direction="prev"
        onClick={handlePrevPage}
        ariaLabel="Poprzednia strona"
        disabled={displayPage <= 1}
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
        disabled={displayPage >= totalPages}
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
      onClick={onNavigate}
    >
      {pageNum}
    </Link>
  );
}

function Ellipsis() {
  return <span className={styles.ellipsis}>···</span>;
}
