import '../global/global.scss';

import { preconnect, prefetchDNS } from 'react-dom';
import { Toaster } from 'sonner';

import { poppins, switzer } from '@/global/fonts';
import { fetchWithLogging } from '@/global/sanity/client';
import { querySettings } from '@/global/sanity/query';
import type { QuerySettingsResult } from '@/global/sanity/sanity.types';
import FloatingComparisonBox from '@/src/components/comparison/FloatingCompatisonBox';
import OrganizationSchema from '@/src/components/schema/OrganizationSchema';
import Analytics from '@/src/components/shared/Analytics';
import CookieConsent from '@/src/components/shared/CookieConsent';
import Footer from '@/src/components/ui/Footer';
import Header from '@/src/components/ui/Header';

import { IS_PRODUCTION_DEPLOYMENT } from '../global/constants';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  preconnect('https://cdn.sanity.io');
  prefetchDNS('https://cdn.sanity.io');

  const settings = await fetchWithLogging<QuerySettingsResult>({
    label: 'Settings fetch failed',
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
        {IS_PRODUCTION_DEPLOYMENT && <CookieConsent />}
        {IS_PRODUCTION_DEPLOYMENT && settings?.analytics && (
          <Analytics
            gtmId={settings.analytics.gtm_id ?? undefined}
            ga4Id={settings.analytics.ga4_id ?? undefined}
            googleAdsId={settings.analytics.googleAds_id ?? undefined}
          />
        )}
        <FloatingComparisonBox />
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
