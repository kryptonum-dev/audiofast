import type { Metadata } from 'next';
import Link from 'next/link';

import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryOrphanReviews } from '@/src/global/sanity/query';
import type { QueryOrphanReviewsResult } from '@/src/global/sanity/sanity.types';

export const metadata: Metadata = {
  title: 'Archived Reviews',
  robots: {
    index: false,
    follow: true,
  },
};

export default async function ArchivedReviewsPage() {
  const reviews = await sanityFetch<QueryOrphanReviewsResult>({
    query: queryOrphanReviews,
    tags: ['review'],
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Archived Reviews</h1>
      <p>
        This page exists for crawling purposes only. It includes reviews not
        linked from any visible product page.
      </p>
      {reviews && reviews.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {reviews.map((review) => (
            <li key={review.slug} style={{ marginBottom: '0.5rem' }}>
              <Link href={review.slug || '#'}>
                {review.name || 'Unnamed Review'}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No archived reviews found.</p>
      )}
    </div>
  );
}
