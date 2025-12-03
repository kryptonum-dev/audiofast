"use client";

import { useEffect, useRef, useState } from "react";

import type { PortableTextProps } from "@/src/global/types";

import PortableText from "../../portableText";
import styles from "./styles.module.scss";

interface ProductDescriptionProps {
  shortDescription: PortableTextProps;
}

export default function ProductDescription({
  shortDescription,
}: ProductDescriptionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showGradient, setShowGradient] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrollable = scrollHeight > clientHeight;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;

      // Show gradient only if content is scrollable AND not at the bottom
      setShowGradient(isScrollable && !isAtBottom);
    };

    // Check initially
    checkScroll();

    // Check on scroll
    container.addEventListener("scroll", checkScroll);

    // Check on resize (in case content changes)
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", checkScroll);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className={styles.descriptionWrapper}
      data-show-gradient={showGradient}
    >
      <div ref={scrollContainerRef} className={styles.description}>
        <PortableText value={shortDescription} enablePortableTextStyles />
      </div>
    </div>
  );
}
