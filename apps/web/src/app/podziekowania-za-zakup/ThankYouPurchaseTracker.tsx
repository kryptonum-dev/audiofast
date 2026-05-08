'use client';

import { useEffect } from 'react';

import {
  type CommercePurchaseAnalyticsPayload,
  trackPurchaseOnce,
} from '@/src/global/b2c/analytics/commerce-events';

type ThankYouPurchaseTrackerProps = {
  payload: CommercePurchaseAnalyticsPayload;
};

export default function ThankYouPurchaseTracker({
  payload,
}: ThankYouPurchaseTrackerProps) {
  useEffect(() => {
    trackPurchaseOnce(payload);
  }, [payload]);

  return null;
}
