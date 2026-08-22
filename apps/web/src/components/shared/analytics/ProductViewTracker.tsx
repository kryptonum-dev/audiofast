'use client';

import { useEffect } from 'react';

import { trackEvent } from '@/global/analytics/track-event';

type ProductViewTrackerProps = {
  productId: string;
  productName: string;
  pricePLN?: number | null;
  brand?: {
    id?: string | null;
    name?: string | null;
  };
  categories?: string[];
};

export default function ProductViewTracker({
  productId,
  productName,
  pricePLN,
  brand,
  categories = [],
}: ProductViewTrackerProps) {
  useEffect(() => {
    trackEvent({
      meta: {
        eventName: 'ViewContent',
        params: {
          content_name: productName,
          content_type: 'product',
          content_ids: [productId],
          ...(brand?.name ? { brand: brand.name } : {}),
          ...(categories.length
            ? { content_category: categories.join(',') }
            : {}),
          ...(typeof pricePLN === 'number'
            ? { value: pricePLN, currency: 'PLN' }
            : {}),
        },
      },
      ga4: {
        eventName: 'view_item',
        params: {
          currency: 'PLN',
          value: typeof pricePLN === 'number' ? pricePLN : undefined,
          items: [
            {
              item_id: productId,
              item_name: productName,
              ...(brand?.name ? { item_brand: brand.name } : {}),
              ...(categories[0] ? { item_category: categories[0] } : {}),
            },
          ],
        },
      },
    });
  }, [brand?.name, categories, pricePLN, productId, productName]);

  return null;
}
