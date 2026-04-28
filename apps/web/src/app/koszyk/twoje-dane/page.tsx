import type { Metadata } from 'next';
import { Suspense } from 'react';

import CheckoutLoadingSkeleton from '@/src/components/b2c/CheckoutPage/CheckoutLoadingSkeleton';
import CheckoutPageClient from '@/src/components/b2c/CheckoutPage/CheckoutPageClient';
import CheckoutSteps from '@/src/components/b2c/CheckoutSteps';
import type { SupportCardData } from '@/src/components/b2c/shared/SupportCard';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { loadCheckoutPageData } from '@/src/global/b2c/checkout/server/load-checkout';
import { sanityFetch } from '@/src/global/sanity/fetch';
import { queryCartSupportCard } from '@/src/global/sanity/query';

export const metadata: Metadata = {
  title: 'Twoje dane | Audiofast',
  description:
    'Pierwszy etap przejścia z koszyka do formularza zamówienia w Audiofast.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

const breadcrumbsData = [
  {
    name: 'Produkty',
    path: '/produkty/',
  },
  {
    name: 'Koszyk',
    path: '/koszyk/',
  },
  {
    name: 'Twoje dane',
    path: '/koszyk/twoje-dane/',
  },
];

type CheckoutDetailsContentProps = {
  supportCard: SupportCardData | null;
};

async function loadCheckoutSupportCard(): Promise<SupportCardData | null> {
  try {
    return await sanityFetch<SupportCardData | null>({
      query: queryCartSupportCard,
      tags: ['settings'],
    });
  } catch (error) {
    console.error('Failed to load checkout support card.', error);
    return null;
  }
}

export default async function CheckoutDetailsPage() {
  const supportCard = await loadCheckoutSupportCard();

  return (
    <>
      <Breadcrumbs data={breadcrumbsData} firstItemType="cartPage" />
      <CheckoutSteps currentStep="checkout" />
      <Suspense fallback={<CheckoutLoadingSkeleton />}>
        <CheckoutDetailsContent supportCard={supportCard} />
      </Suspense>
    </>
  );
}

async function CheckoutDetailsContent({
  supportCard,
}: CheckoutDetailsContentProps) {
  const checkoutPageData = await loadCheckoutPageData();

  return (
    <CheckoutPageClient
      initialDraft={checkoutPageData.initialDraft}
      isEmailLocked={checkoutPageData.isEmailLocked}
      sessionContext={checkoutPageData.sessionContext}
      supportCard={supportCard}
    />
  );
}
