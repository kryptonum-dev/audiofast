import type { Metadata } from 'next';

import CheckoutSteps from '@/src/components/b2c/CheckoutSteps';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Twoje dane | Audiofast',
  description: 'Pierwszy etap przejścia z koszyka do checkoutu w Audiofast.',
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

export default function CheckoutDetailsPage() {
  return (
    <>
      <Breadcrumbs data={breadcrumbsData} firstItemType="cartPage" />
      <CheckoutSteps currentStep="checkout" />
      <main id="main" className="max-width">
        <section style={{ padding: '2rem 0 4rem' }}>
          <h1>Twoje dane</h1>
          <p>
            Handoff z koszyka działa poprawnie. Pełny formularz checkoutu będzie
            rozwijany w następnym etapie implementacji.
          </p>
        </section>
      </main>
    </>
  );
}
