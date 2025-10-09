import '../global/global.scss';

import { preconnect, prefetchDNS } from 'react-dom';

import { poppins, switzer } from '@/global/fonts';
import { fetchWithLogging } from '@/global/sanity/client';
import { querySettings } from '@/global/sanity/query';
import type { QuerySettingsResult } from '@/global/sanity/sanity.types';
import OrganizationSchema from '@/src/components/schema/OrganizationSchema';
import Footer from '@/src/components/ui/Footer';
import Header from '@/src/components/ui/Header';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Preconnect to critical origins
  preconnect('https://cdn.sanity.io');
  preconnect('https://vercel.live');
  // Preconnect to Next.js Google Fonts CDN (for Poppins)
  preconnect('https://fonts.gstatic.com', { crossOrigin: 'anonymous' });
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
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/Switzer-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Switzer-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {settings && <OrganizationSchema settings={settings} />}
      </head>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
