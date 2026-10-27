import '../global/global.scss';

import { BotIdClient } from 'botid/client';
import { draftMode } from 'next/headers';
import { Suspense } from 'react';
import { preconnect, prefetchDNS } from 'react-dom';
import { Toaster } from 'sonner';

import { poppins, switzer } from '@/global/fonts';
import FloatingComparisonBox from '@/src/components/comparison/FloatingComparisonBox';
import OrganizationSchema from '@/src/components/schema/OrganizationSchema';
import WebSiteSchema from '@/src/components/schema/WebSiteSchema';
import Analytics from '@/src/components/shared/Analytics';
import CookieConsent from '@/src/components/shared/CookieConsent';
import LiveVisualEditing from '@/src/components/shared/LiveVisualEditing';
import PreviewBar from '@/src/components/shared/PreviewBar';
import Footer from '@/src/components/ui/Footer';
import Header from '@/src/components/ui/Header';
import { CartProvider } from '@/src/global/b2c/cart/cart-provider';
import { DraftModeProvider } from '@/src/global/sanity/draft-mode-context';

import { IS_PRODUCTION_DEPLOYMENT } from '../global/constants';
import { renderDraftAware } from '../global/sanity/draft-aware';
import { sanityFetchPublished, SanityLive } from '../global/sanity/live';
import { querySettings } from '../global/sanity/query';
import type { QuerySettingsResult } from '../global/sanity/sanity.types';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No 'use cache' here. A cached scope around `children` is what hung
  // Najbar's cold `next dev` loads (research/01 §5.9), and the draft branch
  // must read the request cookie. Reading `draftMode()` does not opt the route
  // out of prerendering: during a prerender it resolves to `false`, so the
  // static shell is the published branch. Every data read below has its own
  // cache scope (`sanityFetchPublished`, the cached Header/Footer leaves).
  const { isEnabled: isDraft } = await draftMode();
  preconnect('https://cdn.sanity.io');
  prefetchDNS('https://cdn.sanity.io');
  preconnect('https://vercel.live');
  prefetchDNS('https://vercel.live');

  // Published-only: the settings feed the GTM preconnect and the Organization
  // JSON-LD, neither of which may carry stega or unpublished data.
  const settings = await sanityFetchPublished<QuerySettingsResult>({
    requestTag: 'layout.settings',
    query: querySettings,
    tags: ['settings'],
  });

  return (
    <html
      lang="pl"
      className={`${poppins.className} ${switzer.variable} ${poppins.variable}`}
    >
      <head>
        {/* BotID. Only classifies and stamps an `x-is-human` header — it never blocks
            on its own. /api/contact decides what to do with the verdict. Rendered
            unconditionally: guarding it behind a production check would leave preview
            deployments with no header, which the route reads as an unknown verdict. */}
        {/* Both spellings: the interceptor matches pathname exactly, and
            `trailingSlash: true` makes `/api/contact/` the canonical path. */}
        <BotIdClient
          protect={[
            { path: '/api/contact/', method: 'POST' },
            { path: '/api/contact', method: 'POST' },
          ]}
        />
        {/* Preconnect to Google Tag Manager for faster loading */}
        {settings?.analytics?.gtm_id &&
          IS_PRODUCTION_DEPLOYMENT &&
          !isDraft && (
            <>
              <link rel="preconnect" href="https://www.googletagmanager.com" />
              <link
                rel="dns-prefetch"
                href="https://www.googletagmanager.com"
              />
            </>
          )}
      </head>
      <body>
        <DraftModeProvider isDraft={isDraft}>
          <CartProvider>
            <Suspense fallback={null}>{renderDraftAware(Header, {})}</Suspense>
            {children}
            {renderDraftAware(Footer, {})}
            {!isDraft && settings && <OrganizationSchema settings={settings} />}
            {!isDraft && <WebSiteSchema />}
            {/* No consent banner, GTM or Meta inside a Presentation session:
              editors must never emit analytics events. */}
            {IS_PRODUCTION_DEPLOYMENT && !isDraft && (
              <>
                <CookieConsent />
                <Analytics />
              </>
            )}
            <Suspense fallback={null}>
              <FloatingComparisonBox />
            </Suspense>
            <Toaster position="bottom-center" richColors />
            {/* Draft-only: published HTML carries no overlay code, no Live
              connection and no preview bar. SanityLive mounts in exactly one
              place and refreshes the route on any content change (chrome
              singletons included); VisualEditing draws the overlays. */}
            {isDraft && (
              <>
                <PreviewBar />
                <LiveVisualEditing />
                <SanityLive includeDrafts />
              </>
            )}
          </CartProvider>
        </DraftModeProvider>
      </body>
    </html>
  );
}
