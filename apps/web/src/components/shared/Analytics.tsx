'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

import {
  getCookieConsent,
  hasValidConsent,
  initializeGoogleConsent,
} from '@/src/lib/cookie-utils';

interface AnalyticsProps {
  gtmId?: string;
  ga4Id?: string;
  googleAdsId?: string;
}

export default function Analytics({
  gtmId,
  ga4Id,
  googleAdsId,
}: AnalyticsProps) {
  const [consentState, setConsentState] = useState<{
    analytics: boolean;
    marketing: boolean;
  } | null>(null);

  useEffect(() => {
    // Initialize Google Consent Mode before any scripts load
    initializeGoogleConsent();

    // Check initial consent state
    const checkConsent = () => {
      if (hasValidConsent()) {
        const consent = getCookieConsent();
        if (consent) {
          setConsentState({
            analytics: consent.analytics,
            marketing: consent.marketing,
          });
        }
      }
    };

    checkConsent();

    // Listen for consent updates
    const handleConsentChange = () => {
      checkConsent();
    };

    window.addEventListener('consentUpdated', handleConsentChange);
    window.addEventListener('storage', handleConsentChange);

    return () => {
      window.removeEventListener('consentUpdated', handleConsentChange);
      window.removeEventListener('storage', handleConsentChange);
    };
  }, []);

  // Don't render anything if no IDs are provided
  if (!gtmId && !ga4Id && !googleAdsId) return null;

  return (
    <>
      {/* Google Tag Manager */}
      {gtmId && (
        <>
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');
              `,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        </>
      )}

      {/* Google Analytics 4 */}
      {ga4Id && consentState?.analytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}', {
  page_path: window.location.pathname,
  send_page_view: true
});
              `,
            }}
          />
        </>
      )}

      {/* Google Ads */}
      {googleAdsId && consentState?.marketing && (
        <Script
          id="google-ads-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('config', '${googleAdsId}');
            `,
          }}
        />
      )}
    </>
  );
}
