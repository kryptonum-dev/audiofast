"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { BrandType } from "@/src/global/types";

import styles from "./styles.module.scss";

type CategoryWithBrands = {
  _id: string;
  name: string;
  brands: BrandType[];
};

type CategoryAccordionProps = {
  category: CategoryWithBrands;
};

export default function CategoryAccordion({
  category,
}: CategoryAccordionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <details
      ref={detailsRef}
      className={styles.categoryCard}
      data-expanded={isOpen}
      open
    >
      <summary
        className={styles.categoryHeader}
        onClick={(e) => {
          e.preventDefault();
          handleToggle();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <h3 className={styles.categoryTitle}>{category.name}</h3>
        <svg
          className={styles.chevron}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 9L12 15L18 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className={styles.brandsWrapper}>
        <div className={styles.inner}>
          <div className={styles.brandsGrid}>
            {category.brands?.map((brand) => (
              <Link
                key={brand._id}
                href={brand.slug!}
                tabIndex={isOpen ? 0 : -1}
                className={styles.brandLink}
              >
                <span className={styles.brandName}>{brand.name}</span>
                <svg
                  className={styles.arrow}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12H19M19 12L12 5M19 12L12 19"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
