import { BASE_URL } from "@/src/global/constants";
import type { QueryBrandBySlugResult } from "@/src/global/sanity/sanity.types";
import { portableTextToPlainString } from "@/src/global/utils";

type Props = {
  brand: QueryBrandBySlugResult;
};

/**
 * Brand Schema Component
 *
 * Implements schema.org/Brand structured data for brand pages.
 * This helps search engines understand the brand entity and
 * establish Audiofast as an authoritative source for brand information.
 *
 * @see https://schema.org/Brand
 */
export default function BrandSchema({ brand }: Props) {
  if (!brand) {
    return null;
  }

  const { name, slug, logo, description } = brand;

  // Build canonical URL
  const brandUrl = `${BASE_URL}${slug}`;

  // Extract plain text description
  const plainDescription = description
    ? portableTextToPlainString(description)
    : undefined;

  // Build logo URL
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const logoUrl =
    logo?.id && projectId && dataset
      ? `https://cdn.sanity.io/images/${projectId}/${dataset}/${logo.id}.png?w=400&h=400&fit=max`
      : undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Brand",
    "@id": `${brandUrl}#brand`,
    name: name || "Brand",
    url: brandUrl,
    ...(plainDescription && { description: plainDescription }),
    ...(logoUrl && { logo: logoUrl }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
