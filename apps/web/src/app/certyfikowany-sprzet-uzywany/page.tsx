import { notFound } from "next/navigation";

import { PageBuilder } from "@/src/components/shared/PageBuilder";
import Breadcrumbs from "@/src/components/ui/Breadcrumbs";
import { sanityFetch } from "@/src/global/sanity/fetch";
import { queryCpoPage } from "@/src/global/sanity/query";
import type { QueryCpoPageResult } from "@/src/global/sanity/sanity.types";
import { getSEOMetadata } from "@/src/global/seo";

export async function generateMetadata() {
  const pageData = await sanityFetch<QueryCpoPageResult>({
    query: queryCpoPage,
    tags: ["cpoPage"],
  });

  if (!pageData) return getSEOMetadata();

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

export default async function CpoPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    category?: string;
    sortBy?: string | string[];
  }>;
}) {
  const searchParamsResult = await searchParams;
  const pageData = await sanityFetch<QueryCpoPageResult>({
    query: queryCpoPage,
    tags: ["cpoPage"],
  });

  if (!pageData) {
    notFound();
  }

  const breadcrumbsData = [
    {
      name: pageData.name || "CPO - Certyfikowany sprzęt używany",
      path: pageData.slug || "/certyfikowany-sprzet-uzywany/",
    },
  ];

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs
        data={breadcrumbsData}
        firstItemType={pageData.firstBlockType || undefined}
      />
      <PageBuilder
        basePath={pageData.slug || "/certyfikowany-sprzet-uzywany/"}
        pageBuilder={pageData.pageBuilder || []}
        searchParams={searchParamsResult}
      />
    </main>
  );
}
