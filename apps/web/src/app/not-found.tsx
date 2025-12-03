import type { Metadata } from "next";
import { notFound } from "next/navigation";

import NotFoundComponent from "@/src/components/pageBuilder/NotFound";
import { sanityFetch } from "@/src/global/sanity/fetch";
import { queryNotFoundPage } from "@/src/global/sanity/query";
import type { QueryNotFoundPageResult } from "@/src/global/sanity/sanity.types";
import { getSEOMetadata } from "@/src/global/seo";

import Breadcrumbs from "../components/ui/Breadcrumbs";

async function fetchNotFoundPageData() {
  return await sanityFetch<QueryNotFoundPageResult>({
    query: queryNotFoundPage,
    tags: ["notFound"],
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const notFoundData = await fetchNotFoundPageData();
  return getSEOMetadata(
    notFoundData
      ? {
          seo: notFoundData.seo!,
          slug: "/404",
        }
      : {},
  );
}

export default async function NotFound() {
  const notFoundData = await fetchNotFoundPageData();

  if (!notFoundData) {
    notFound();
  }

  const breadcrumbsData = [
    {
      name: "Nie znaleziono strony",
      path: "/404",
    },
  ];

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs data={breadcrumbsData} firstItemType="notFound" />
      <NotFoundComponent {...notFoundData} />
    </main>
  );
}
