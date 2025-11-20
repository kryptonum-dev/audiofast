import '../global/global.scss';

import { preconnect, prefetchDNS } from 'react-dom';
import { Toaster } from 'sonner';

import { poppins, switzer } from '@/global/fonts';
import FloatingComparisonBox from '@/src/components/comparison/FloatingCompatisonBox';
import OrganizationSchema from '@/src/components/schema/OrganizationSchema';
import Analytics from '@/src/components/shared/Analytics';
import CookieConsent from '@/src/components/shared/CookieConsent';
import Footer from '@/src/components/ui/Footer';
import Header from '@/src/components/ui/Header';

import { IS_PRODUCTION_DEPLOYMENT } from '../global/constants';
import { sanityFetch } from '../global/sanity/fetch';
import { querySettings } from '../global/sanity/query';
import type { QuerySettingsResult } from '../global/sanity/sanity.types';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  'use cache';
  preconnect('https://cdn.sanity.io');
  prefetchDNS('https://cdn.sanity.io');

  const settings = await sanityFetch<QuerySettingsResult>({
    query: querySettings,
    tags: ['settings'],
  });

  return (
    <html
      lang="pl"
      className={`${poppins.className} ${switzer.variable} ${poppins.variable}`}
    >
      <head>
        {/* Preconnect to Google Tag Manager for faster loading */}
        {settings?.analytics?.gtm_id && (
          <>
            <link rel="preconnect" href="https://www.googletagmanager.com" />
            <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
          </>
        )}
      </head>
      <body>
        <Header />
        {children}
        <Footer />
        {settings && <OrganizationSchema settings={settings} />}
        {IS_PRODUCTION_DEPLOYMENT && (
          <>
            <CookieConsent />
            <Analytics />
          </>
        )}
        <FloatingComparisonBox />
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
