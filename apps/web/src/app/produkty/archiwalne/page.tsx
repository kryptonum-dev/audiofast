import type { Metadata } from 'next';
import Link from 'next/link';

import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryArchivedProducts } from '@/src/global/sanity/query';
import type { QueryArchivedProductsResult } from '@/src/global/sanity/sanity.types';

export const metadata: Metadata = {
  title: 'Archived & Hidden Products',
  robots: {
    index: false,
    follow: true,
  },
};

export default async function ArchivedProductsPage() {
  const products = await sanityFetch<QueryArchivedProductsResult>({
    query: queryArchivedProducts,
    tags: ['product'],
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Archived & Hidden Products</h1>
      <p>
        This page exists for crawling purposes only. It includes archived
        products and products from hidden brands.
      </p>
      {products && products.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {products.map((product) => (
            <li key={product.slug} style={{ marginBottom: '0.5rem' }}>
              <Link href={product.slug || '#'}>
                {product.name || 'Unnamed Product'}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No archived or hidden products found.</p>
      )}
    </div>
  );
}
