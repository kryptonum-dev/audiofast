import type { ProductType } from "@/src/global/types";

import Image from "../../shared/Image";
import Button from "../Button";
import AddToComparisonButton from "./AddToComparisonButton";
import styles from "./styles.module.scss";

interface ProductCardProps {
  product: ProductType;
  headingLevel?: "h2" | "h3";
  imageSizes?: string;
  showButton?: boolean;
  layout?: "horizontal" | "vertical";
  priority?: boolean;
  loading?: "eager" | "lazy";
}

export default function ProductCard({
  product,
  layout = "horizontal",
  imageSizes = "400px",
  headingLevel = "h3",
  showButton = true,
  priority = false,
  loading = "lazy",
}: ProductCardProps) {
  const {
    slug,
    name,
    subtitle,
    basePriceCents,
    hasMultiplePrices,
    brand,
    mainImage,
    _id,
    categories,
  } = product;
  const Heading = headingLevel;

  // Format price for display (converting cents to PLN)
  const formatPrice = (priceCents: number | null | undefined) => {
    if (!priceCents || priceCents === 0) return "Brak ceny";
    const priceInPLN = priceCents / 100;
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(priceInPLN);
  };

  return (
    <article className={styles.productCard}>
      <a href={slug!} className={styles.link}>
        <div className={styles.imgBox}>
          <Image
            image={mainImage}
            sizes={imageSizes}
            fill
            priority={priority}
            loading={loading}
          />
          {brand?.logo && (
            <Image image={brand.logo} sizes="90px" loading={loading} />
          )}
          <AddToComparisonButton
            productId={_id}
            productName={name ?? ""}
            categorySlug={categories?.[0]?.slug ?? ""}
            categoryName={categories?.[0]?.name ?? categories?.[0]?.slug ?? ""}
            productData={product}
          />
        </div>
        <div className={styles.container}>
          <Heading className={styles.title}>
            {brand?.name && `${brand.name} `}
            {name}
          </Heading>
          <p className={styles.subtitle}>{subtitle}</p>
          <div className={styles.priceContainer} data-layout={layout}>
            <span className={styles.price}>
              {hasMultiplePrices ? "od " : ""}
              {formatPrice(basePriceCents)}
            </span>
            {showButton && (
              <Button
                tabIndex={-1}
                text="Dowiedz się więcej"
                variant="primary"
              />
            )}
          </div>
        </div>
      </a>
    </article>
  );
}
