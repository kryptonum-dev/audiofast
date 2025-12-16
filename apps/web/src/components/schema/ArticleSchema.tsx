import { BASE_URL, SITE_TITLE } from '@/src/global/constants';
import type { QueryReviewBySlugResult } from '@/src/global/sanity/sanity.types';
import { portableTextToPlainString } from '@/src/global/utils';

type Props = {
  review: QueryReviewBySlugResult;
};

/**
 * Article Schema Component
 *
 * Implements schema.org/Article structured data for review pages.
 * Reviews are editorial content about products, so we use Article
 * (not Review schema, which Google prohibits for self-written reviews).
 *
 * @see https://schema.org/Article
 * @see https://developers.google.com/search/docs/appearance/structured-data/article
 */
export default function ArticleSchema({ review }: Props) {
  if (!review) {
    return null;
  }

  const { name, slug, publishDate, image, author, content, product } = review;

  // Build canonical URL
  const articleUrl = `${BASE_URL}${slug}`;

  // Extract plain text from content for description
  const plainTextContent = content ? portableTextToPlainString(content) : '';
  const description = plainTextContent
    ? plainTextContent.substring(0, 200).trim() + '...'
    : undefined;

  // Build image URL
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const imageUrl =
    image?.id && projectId && dataset
      ? `https://cdn.sanity.io/images/${projectId}/${dataset}/${image.id}.jpg?w=1200&h=630&fit=crop`
      : undefined;

  // Build author object
  // Note: author.image is not available in current query types
  const authorSchema = author?.name
    ? {
        '@type': 'Person' as const,
        name: author.name,
      }
    : {
        '@type': 'Organization' as const,
        name: SITE_TITLE,
      };

  // Build publisher object
  const publisherSchema = {
    '@type': 'Organization' as const,
    name: SITE_TITLE,
    url: BASE_URL,
  };

  // Build the Article schema
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${articleUrl}#article`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    headline: name || 'Recenzja',
    ...(description && { description }),
    ...(imageUrl && {
      image: {
        '@type': 'ImageObject',
        url: imageUrl,
        ...(image?.naturalWidth && { width: image.naturalWidth }),
        ...(image?.naturalHeight && { height: image.naturalHeight }),
      },
    }),
    datePublished: publishDate,
    dateModified: publishDate, // Use publishDate since _updatedAt is not in query
    author: authorSchema,
    publisher: publisherSchema,
    articleSection: 'Recenzje',
    inLanguage: 'pl-PL',
    // Include reviewed product as "about" if available
    ...(product?.name && {
      about: {
        '@type': 'Product',
        name: product.name,
        ...(product.brand?.name && {
          brand: {
            '@type': 'Brand',
            name: product.brand.name,
          },
        }),
        ...(product.slug && { url: `${BASE_URL}${product.slug}` }),
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
