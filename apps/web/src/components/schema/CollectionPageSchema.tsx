import { BASE_URL } from '@/src/global/constants';
import type { PortableTextProps } from '@/src/global/types';
import { portableTextToPlainString } from '@/src/global/utils';

type Props = {
  name: string;
  url: string;
  description?: PortableTextProps | null;
};

/**
 * CollectionPage Schema Component
 *
 * Implements schema.org/CollectionPage structured data for blog listing pages.
 * This helps search engines understand that this is an archive/collection page
 * rather than a single content page.
 *
 * @see https://schema.org/CollectionPage
 */
export default function CollectionPageSchema({
  name,
  url,
  description,
}: Props) {
  // Build full URL
  const fullUrl = `${BASE_URL}${url}`;

  // Extract plain text description
  const plainDescription = description
    ? portableTextToPlainString(description)
    : undefined;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${fullUrl}#collectionpage`,
    url: fullUrl,
    name,
    ...(plainDescription && { description: plainDescription }),
    inLanguage: 'pl-PL',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
