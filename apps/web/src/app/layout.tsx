import '../global/global.scss';

import { preconnect, prefetchDNS } from 'react-dom';

import { poppins } from '@/global/fonts';
import Header from '@/layouts/Header';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  preconnect('https://cdn.sanity.io');
  prefetchDNS('https://cdn.sanity.io');
  return (
    <html lang="en" className={poppins.className}>
      <body>
        <Header />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
