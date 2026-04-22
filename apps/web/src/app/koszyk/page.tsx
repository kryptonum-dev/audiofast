import type { Metadata } from 'next';

import CartPageClient from '@/src/components/b2c/CartPage/CartPageClient';
import type { CartEmptyStateData } from '@/src/components/b2c/CartPage/types';
import type { SupportCardData } from '@/src/components/b2c/shared/SupportCard';
import CheckoutSteps from '@/src/components/b2c/CheckoutSteps';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { sanityFetch } from '@/src/global/sanity/fetch';
import {
  queryCartEmptyState,
  queryCartSupportCard,
} from '@/src/global/sanity/query';

export const metadata: Metadata = {
  title: 'Koszyk | Audiofast',
  description:
    'Koszyk zakupowy Audiofast dla wybranych produktów i egzemplarzy CPO.',
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
];

export default async function CartPage() {
  const [supportCard, emptyStateContent] = await Promise.all([
    sanityFetch<SupportCardData | null>({
      query: queryCartSupportCard,
      tags: ['settings'],
    }),
    sanityFetch<CartEmptyStateData | null>({
      query: queryCartEmptyState,
      tags: ['settings'],
    }),
  ]);

  return (
    <>
      <Breadcrumbs data={breadcrumbsData} firstItemType="cartPage" />
      <CheckoutSteps currentStep="cart" />
      <CartPageClient
        supportCard={supportCard}
        emptyStateContent={emptyStateContent}
      />
    </>
  );
}
