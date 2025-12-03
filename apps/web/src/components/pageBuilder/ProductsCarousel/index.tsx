import type { PagebuilderType } from "@/src/global/types";

import PortableText from "../../portableText";
import ProductsCarouselWrapper from "./ProductsCarouselWrapper";
import styles from "./styles.module.scss";

type ProductsCarouselProps = PagebuilderType<"productsCarousel"> & {
  index: number;
  customId?: string;
};

export default function ProductsCarousel({
  customId,
  heading,
  products,
  index,
}: ProductsCarouselProps) {
  return (
    <section
      id={customId}
      className={`${styles.productsCarousel} max-width-block`}
    >
      <PortableText
        value={heading}
        headingLevel={index === 0 ? "h1" : "h2"}
        className={styles.heading}
      />
      <ProductsCarouselWrapper products={products} index={index} />
    </section>
  );
}
