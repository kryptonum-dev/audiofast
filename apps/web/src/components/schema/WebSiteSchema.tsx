import { BASE_URL, SITE_DESCRIPTION, SITE_TITLE } from "@/src/global/constants";

/**
 * WebSite Schema Component
 *
 * Implements schema.org/WebSite structured data for site identity.
 * This helps search engines understand the website as an entity
 * and links it to the Organization schema.
 *
 * @see https://schema.org/WebSite
 * @see https://developers.google.com/search/docs/appearance/site-names
 */
export default function WebSiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    url: BASE_URL,
    name: SITE_TITLE,
    description: SITE_DESCRIPTION,
    publisher: {
      "@id": `${BASE_URL}#organization`,
    },
    inLanguage: "pl-PL",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
