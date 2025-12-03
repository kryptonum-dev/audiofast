import type { Metadata } from "next";
import { cookies } from "next/headers";

import { fetchComparisonPageData } from "@/src/app/actions/comparison";
import ComparisonTable from "@/src/components/comparison/ComparisonTable";
import Breadcrumbs from "@/src/components/ui/Breadcrumbs";
import EmptyState from "@/src/components/ui/EmptyState";
import { getComparisonCookieServer } from "@/src/global/comparison/cookie-manager";

import styles from "../../components/comparison/ComparisonTable/styles.module.scss";

export const metadata: Metadata = {
  title: "Porównaj produkty | Audiofast",
  description: "Porównaj specyfikacje produktów audio wysokiej klasy",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

const breadcrumbsData = [
  {
    name: "Porównanie produktów",
    path: "/porownaj/",
  },
];

function EmptyStateInline({
  type,
  button,
}: {
  type: "comparator-noCookies" | "comparator-noProduct";
  button?: {
    name: string;
    href: string;
  };
}) {
  return (
    <main className="page-transition">
      <Breadcrumbs data={breadcrumbsData} />
      <section className={`${styles.emptyState} max-width`}>
        <EmptyState type={type} button={button} />
      </section>
    </main>
  );
}

export default async function ComparisonPage() {
  const cookieStore = await cookies();
  const comparisonCookie = await getComparisonCookieServer(cookieStore);

  if (!comparisonCookie || comparisonCookie.productIds.length === 0) {
    return (
      <EmptyStateInline
        type="comparator-noCookies"
        button={{
          name: "Przeglądaj produkty",
          href: "/produkty/",
        }}
      />
    );
  }

  const categorySlug = comparisonCookie.categorySlug;

  // Fetch products and comparator config in a single query
  const { products: allCategoryProducts, enabledParameters } = categorySlug
    ? await fetchComparisonPageData(categorySlug)
    : { products: [], enabledParameters: [] };

  // Split products: ones in comparison vs ones available to add
  const comparisonProductIds = new Set(comparisonCookie.productIds);
  const comparisonProducts = allCategoryProducts.filter((product) =>
    comparisonProductIds.has(product._id),
  );
  const availableProducts = allCategoryProducts.filter(
    (product) => !comparisonProductIds.has(product._id),
  );

  // Handle case where category is empty or products were deleted
  if (
    !allCategoryProducts ||
    allCategoryProducts.length === 0 ||
    comparisonProducts.length === 0
  ) {
    return (
      <EmptyStateInline
        type="comparator-noProduct"
        button={{
          name: "Przeglądaj produkty",
          href: "/produkty/",
        }}
      />
    );
  }

  return (
    <main className="page-transition">
      <Breadcrumbs data={breadcrumbsData} firstItemType="comparison" />
      <ComparisonTable
        products={comparisonProducts}
        availableProducts={availableProducts}
        enabledParameters={enabledParameters}
      />
    </main>
  );
}
