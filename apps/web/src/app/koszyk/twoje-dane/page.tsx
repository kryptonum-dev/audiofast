import type { Metadata } from 'next';

import type { CartSupportCardData } from '@/src/components/b2c/CartPage/types';
import CheckoutPageClient from '@/src/components/b2c/CheckoutPage/CheckoutPageClient';
import CheckoutSteps from '@/src/components/b2c/CheckoutSteps';
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

export default async function CheckoutDetailsPage() {
  const [checkoutPageResult, supportCard] = await Promise.all([
    loadCheckoutPageData(),
    sanityFetch<CartSupportCardData | null>({
      query: queryCartSupportCard,
      tags: ['settings'],
    }),
  ]);

  return (
    <>
      <Breadcrumbs data={breadcrumbsData} firstItemType="cartPage" />
      <CheckoutSteps currentStep="checkout" />
      {checkoutPageResult.ok ? (
        <CheckoutPageClient
          initialDraft={checkoutPageResult.value.initialDraft}
          isEmailLocked={checkoutPageResult.value.isEmailLocked}
          sessionContext={checkoutPageResult.value.sessionContext}
          customerProfile={checkoutPageResult.value.customerProfile}
          canPrefillFromProfile={checkoutPageResult.value.canPrefillFromProfile}
          supportCard={supportCard}
        />
      ) : (
        <main id="main" className="max-width">
          <section style={{ padding: '2rem 0 4rem' }}>
            <h1>Twoje dane</h1>
            <p>
              Nie udało się przygotować formularza zamówienia. Odśwież stronę i
              spróbuj ponownie za chwilę.
            </p>
          </section>
        </main>
      )}
    </>
  );
}
