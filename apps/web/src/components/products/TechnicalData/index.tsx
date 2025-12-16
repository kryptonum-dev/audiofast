"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import type { QueryProductBySlugResult } from "@/src/global/sanity/sanity.types";
import type { PortableTextProps } from "@/src/global/types";

import PortableText from "../../portableText";
import styles from "./styles.module.scss";

type TechnicalDataType = NonNullable<
  NonNullable<QueryProductBySlugResult>["technicalData"]
>;

interface TechnicalDataProps {
  data?: TechnicalDataType;
  customId?: string;
}

// Mobile breakpoint in pixels (37.4375rem = 599px)
const MOBILE_BREAKPOINT = 599;
// Tablet breakpoint for 4+ variants (56.1875rem = 899px)
const TABLET_BREAKPOINT = 899;
// Threshold for "many variants" mode
const MANY_VARIANTS_THRESHOLD = 4;

export default function TechnicalData({ data, customId }: TechnicalDataProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const scrollContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isScrolling = useRef(false);

  // Check if we have valid data with groups
  if (!data || !data.groups || data.groups.length === 0) return null;

  // Filter out empty groups
  const validGroups = data.groups.filter(
    (group) => group.rows && group.rows.length > 0,
  );
  if (validGroups.length === 0) return null;

  const hasVariants = data.variants && data.variants.length > 0;
  const variants = data.variants || [];
  const hasManyVariants = variants.length >= MANY_VARIANTS_THRESHOLD;

  // Check if we have multiple groups (for showing section headings)
  const hasMultipleGroups = validGroups.length > 1;

  // Detect mobile and tablet viewport
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const checkBreakpoints = () => {
      const width = window.innerWidth;
      setIsMobile(width <= MOBILE_BREAKPOINT);
      setIsTablet(width <= TABLET_BREAKPOINT && width > MOBILE_BREAKPOINT);
    };

    checkBreakpoints();
    window.addEventListener("resize", checkBreakpoints);
    return () => window.removeEventListener("resize", checkBreakpoints);
  }, []);

  // Sync scroll across all containers
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleScroll = useCallback(
    (scrollLeft: number, sourceIndex: number) => {
      if (isScrolling.current) return;
      isScrolling.current = true;

      scrollContainerRefs.current.forEach((ref, index) => {
        if (ref && index !== sourceIndex) {
          ref.scrollLeft = scrollLeft;
        }
      });

      // Reset flag after a short delay
      requestAnimationFrame(() => {
        isScrolling.current = false;
      });
    },
    [],
  );

  // Set ref for scroll containers
  const setScrollRef = (index: number) => (el: HTMLDivElement | null) => {
    scrollContainerRefs.current[index] = el;
  };

  // Desktop/Tablet: Standard table layout
  const renderTable = (group: (typeof validGroups)[0], groupIndex: number) => (
    <div className={styles.tableWrapper}>
      <table
        className={`${styles.table} ${hasVariants ? styles.multiVariant : ""}`}
      >
        {hasVariants && (
          <thead className={styles.thead}>
            <tr className={styles.headerRow}>
              <th className={styles.parameterHeader}></th>
              {variants.map((variant, idx) => (
                <th key={idx} className={styles.variantHeader}>
                  {variant}
                </th>
              ))}
            </tr>
          </thead>
        )}

        <tbody>
          {group.rows?.map((row, rowIndex) => (
            <tr
              key={row._key || `${groupIndex}-${rowIndex}`}
              className={styles.row}
            >
              <td className={styles.parameterCell}>{row.title}</td>
              {row.values?.map((value, valueIndex) => (
                <td key={value._key || valueIndex} className={styles.valueCell}>
                  {value.content && value.content.length > 0 ? (
                    <PortableText
                      value={value.content as unknown as PortableTextProps}
                    />
                  ) : (
                    <span className={styles.emptyValue}>–</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Mobile: Multi-variant layout with synced scroll
  const renderMobileMultiVariant = (
    group: (typeof validGroups)[0],
    groupIndex: number,
  ) => {
    // Calculate base index for scroll refs (header + rows)
    const baseRefIndex = validGroups
      .slice(0, groupIndex)
      .reduce((acc, g) => acc + (g.rows?.length || 0) + 1, 0);

    return (
      <div className={styles.mobileMultiVariant}>
        {/* Header row with variant names */}
        <div
          ref={setScrollRef(baseRefIndex)}
          className={styles.mobileHeader}
          onScroll={(e) =>
            handleScroll(e.currentTarget.scrollLeft, baseRefIndex)
          }
        >
          {variants.map((variant, idx) => (
            <div key={idx} className={styles.mobileVariantName}>
              {variant}
            </div>
          ))}
        </div>

        {/* Parameter rows */}
        {group.rows?.map((row, rowIndex) => {
          const refIndex = baseRefIndex + rowIndex + 1;
          const isOdd = rowIndex % 2 === 0;

          return (
            <div
              key={row._key || `${groupIndex}-${rowIndex}`}
              className={`${styles.mobileRow} ${isOdd ? styles.odd : styles.even}`}
            >
              {/* Param name - full width, not scrolling */}
              <div className={styles.mobileParamName}>{row.title}</div>

              {/* Values - scrollable, synced */}
              <div
                ref={setScrollRef(refIndex)}
                className={styles.mobileValues}
                onScroll={(e) =>
                  handleScroll(e.currentTarget.scrollLeft, refIndex)
                }
              >
                {row.values?.map((value, valueIndex) => (
                  <div
                    key={value._key || valueIndex}
                    className={styles.mobileValueCell}
                  >
                    {value.content && value.content.length > 0 ? (
                      <PortableText
                        value={value.content as unknown as PortableTextProps}
                      />
                    ) : (
                      <span className={styles.emptyValue}>–</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Determine if we should show the scrollable layout
  // Show on mobile for all multi-variant tables, or on tablet for 4+ variants
  const shouldShowScrollableLayout =
    hasVariants && (isMobile || (isTablet && hasManyVariants));

  return (
    <section
      className={`${styles.technicalData} max-width-block`}
      id={customId}
      data-variants-count={variants.length}
      data-many-variants={hasManyVariants || undefined}
    >
      <h2 className={styles.heading}>Dane techniczne</h2>

      {validGroups.map((group, groupIndex) => (
        <React.Fragment key={group._key || groupIndex}>
          {hasMultipleGroups && group.title && (
            <h3 className={styles.groupHeading}>{group.title}</h3>
          )}

          {/* Render scrollable multi-variant or standard table */}
          {shouldShowScrollableLayout
            ? renderMobileMultiVariant(group, groupIndex)
            : renderTable(group, groupIndex)}
        </React.Fragment>
      ))}
    </section>
  );
}
