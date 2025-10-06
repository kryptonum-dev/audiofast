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
      <head>{settings && <OrganizationSchema settings={settings} />}</head>
      <body>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
