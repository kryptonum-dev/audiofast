import { BASE_URL } from '@/src/global/constants';
import type {
  QueryBlogPostBySlugResult,
  QuerySettingsResult,
} from '@/src/global/sanity/sanity.types';
import { portableTextToPlainString } from '@/src/global/utils';

type Props = {
  blogPost: QueryBlogPostBySlugResult;
  settings: QuerySettingsResult;
};

/**
 * BlogPosting Schema Component
 *
 * Implements schema.org/BlogPosting structured data for individual blog posts.
 * This helps search engines understand:
 * - Article metadata (author, publish/modified dates)
 * - Content structure and topic
 * - Publisher information
 * - Keywords and categorization
 *
 * @see https://schema.org/BlogPosting
 * @see https://developers.google.com/search/docs/appearance/structured-data/article
 */
export default function BlogPostSchema({ blogPost, settings }: Props) {
  if (!blogPost || !settings) {
    return null;
  }

  const {
    name,
    slug,
    _createdAt,
    _updatedAt,
    image,
    category,
    author,
    keywords,
    content,
  } = blogPost;

  // Build canonical URL
  const articleUrl = `${BASE_URL}${slug}`;

  // Extract plain text from content for wordCount and articleBody
  const plainTextContent = content ? portableTextToPlainString(content) : '';
  const wordCount = plainTextContent
    ? plainTextContent.split(/\s+/).filter(Boolean).length
    : 0;

  // Build image URL with proper dimensions
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const imageUrl =
    image?.id && projectId && dataset
      ? `https://cdn.sanity.io/images/${projectId}/${dataset}/${image.id}.jpg?w=1200&h=630&fit=crop`
      : undefined;

  // Get publisher info from settings
  const publisherName = settings.structuredData?.companyName || 'Audiofast';
  const publisherLogo = settings.structuredData?.logo;

  // Build author object
  const authorSchema =
    author && projectId && dataset
      ? {
          '@type': 'Person' as const,
          name: author.name || 'Unknown Author',
          ...(author.image?.id && {
            image: `https://cdn.sanity.io/images/${projectId}/${dataset}/${author.image.id}.jpg?w=400&h=400&fit=crop`,
          }),
        }
      : undefined;

  // Build publisher object
  const publisherSchema = {
    '@type': 'Organization' as const,
    name: publisherName,
    ...(publisherLogo && {
      logo: {
        '@type': 'ImageObject' as const,
        url: publisherLogo,
      },
    }),
  };

  // Build the BlogPosting schema
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${articleUrl}#blogpost`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    headline: name || 'Blog Post',
    ...(plainTextContent && {
      description: plainTextContent.substring(0, 200),
    }),
    ...(imageUrl && {
      image: {
        '@type': 'ImageObject',
        url: imageUrl,
        ...(image?.naturalWidth && { width: image.naturalWidth }),
        ...(image?.naturalHeight && { height: image.naturalHeight }),
      },
    }),
    datePublished: _createdAt,
    dateModified: _updatedAt || _createdAt,
    author: authorSchema,
    publisher: publisherSchema,
    ...(category?.name && {
      articleSection: category.name,
    }),
    ...(keywords && keywords.length > 0 && { keywords: keywords.join(', ') }),
    ...(wordCount > 0 && { wordCount }),
    inLanguage: 'pl-PL',
    ...(plainTextContent && {
      articleBody: plainTextContent,
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
