import { notFound } from "next/navigation";

import { LegalBody } from "@/src/components/legal/LegalBody";
import Breadcrumbs from "@/src/components/ui/Breadcrumbs";
import { logWarn } from "@/src/global/logger";
import { sanityFetch } from "@/src/global/sanity/fetch";
import { queryTermsAndConditions } from "@/src/global/sanity/query";
import type { QueryTermsAndConditionsResult } from "@/src/global/sanity/sanity.types";
import { getSEOMetadata } from "@/src/global/seo";
import type { PortableTextProps } from "@/src/global/types";

async function fetchTermsAndConditionsData() {
  return await sanityFetch<QueryTermsAndConditionsResult>({
    query: queryTermsAndConditions,
    tags: ["termsAndConditions"],
  });
}

export async function generateMetadata() {
  const pageData = await fetchTermsAndConditionsData();

  if (!pageData) {
    logWarn("Terms and conditions page data not found");
    return getSEOMetadata();
  }

  return getSEOMetadata({
    seo: pageData.seo,
    slug: pageData.slug,
    openGraph: pageData.openGraph,
  });
}

export default async function TermsAndConditionsPage() {
  const pageData = await fetchTermsAndConditionsData();

  if (!pageData) {
    logWarn("Terms and conditions page data not found, returning 404");
    notFound();
  }

  const breadcrumbsData = [
    {
      name: pageData.name || "Regulamin",
      path: pageData.slug || "/regulamin",
    },
  ];

  return (
    <main id="main" className="page-transition">
      <Breadcrumbs data={breadcrumbsData} />
      <LegalBody
        headings={pageData.headings as unknown as PortableTextProps[]}
        name={pageData.name!}
        description={pageData.description}
        content={pageData.content}
      />
    </main>
  );
}
