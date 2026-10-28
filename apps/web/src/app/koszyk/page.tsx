import type { Metadata } from 'next';

import CartPageClient from '@/src/components/b2c/CartPage/CartPageClient';
import type { CartEmptyStateData } from '@/src/components/b2c/CartPage/types';
import CheckoutSteps from '@/src/components/b2c/CheckoutSteps';
import type { SupportCardData } from '@/src/components/b2c/shared/SupportCard';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import { sanityFetchPublished } from '@/src/global/sanity/live';
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
    sanityFetchPublished<SupportCardData | null>({
      requestTag: 'cart.support-card',
      query: queryCartSupportCard,
    }),
    sanityFetchPublished<CartEmptyStateData | null>({
      requestTag: 'cart.empty-state',
      query: queryCartEmptyState,
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
