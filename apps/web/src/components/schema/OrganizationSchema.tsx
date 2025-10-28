import { BASE_URL } from '@/src/global/constants';
import type { QuerySettingsResult } from '@/src/global/sanity/sanity.types';

type Props = {
  settings: QuerySettingsResult;
};

/**
 * Organization + LocalBusiness Schema Component
 *
 * Implements schema.org/Organization and schema.org/LocalBusiness structured data
 * for better SEO, knowledge graph, and local search results.
 *
 * This schema helps search engines understand:
 * - Business identity and contact information
 * - Physical location and service area
 * - Social media presence
 * - Business hours and price range
 *
 * @see https://schema.org/Organization
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */
export default function OrganizationSchema({ settings }: Props) {
  if (!settings || !settings.structuredData) {
    return null;
  }

  const { address, email, tel, socialMedia, structuredData } = settings;

  const { companyName, companyDescription, logo, geo, priceRange } =
    structuredData;

  // Build the postal address object
  const postalAddress = address
    ? {
        '@type': 'PostalAddress',
        streetAddress: address.streetAddress,
        addressLocality: address.city,
        postalCode: address.postalCode,
        addressCountry: 'PL', // ISO 3166-1 alpha-2 country code for Poland
      }
    : undefined;

  // Build geo coordinates if available
  const geoCoordinates =
    geo?.latitude && geo?.longitude
      ? {
          '@type': 'GeoCoordinates',
          latitude: geo.latitude,
          longitude: geo.longitude,
        }
      : undefined;

  // Build the organization schema combining Organization and LocalBusiness
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness', 'Store'],
    '@id': `${BASE_URL}#organization`,
    name: companyName,
    description: companyDescription,
    url: BASE_URL,
    ...(logo && { logo: logo }),
    ...(logo && {
      image: logo,
    }),
    ...(postalAddress && { address: postalAddress }),
    ...(email && { email: email }),
    ...(tel && { telephone: tel }),
    ...(geoCoordinates && { geo: geoCoordinates }),
    ...(socialMedia &&
      socialMedia.length > 0 && {
        sameAs: socialMedia.filter(Boolean),
      }),
    ...(priceRange && { priceRange: priceRange }),
    // Contact point for customer service
    ...(email &&
      tel && {
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: tel,
          email: email,
          contactType: 'customer service',
          availableLanguage: ['pl', 'en'],
        },
      }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
