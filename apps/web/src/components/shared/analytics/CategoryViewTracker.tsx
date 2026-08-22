'use client';

import { useEffect } from 'react';

import { trackEvent } from '@/global/analytics/track-event';

type CategoryViewTrackerProps = {
  categoryId?: string | null;
  categoryName: string;
  totalItems?: number | null;
};

export default function CategoryViewTracker({
  categoryId,
  categoryName,
  totalItems,
}: CategoryViewTrackerProps) {
  useEffect(() => {
    trackEvent({
      meta: {
        eventName: 'ViewCategory',
        params: {
          content_name: categoryName,
          content_type: 'category',
          ...(categoryId ? { content_ids: [categoryId] } : {}),
          ...(typeof totalItems === 'number' ? { num_items: totalItems } : {}),
        },
      },
      ga4: {
        eventName: 'view_item_list',
        params: {
          item_list_name: categoryName,
          ...(categoryId ? { item_list_id: categoryId } : {}),
          ...(typeof totalItems === 'number'
            ? { items_total: totalItems }
            : {}),
        },
      },
    });
  }, [categoryId, categoryName, totalItems]);

  return null;
}
