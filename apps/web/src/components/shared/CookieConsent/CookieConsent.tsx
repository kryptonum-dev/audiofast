/* eslint-disable @next/next/no-img-element */

import { sanityFetch } from '@/global/sanity/fetch';
import { querySettings } from '@/src/global/sanity/query';

import CookieConsentClient from './CookieConsentClient';

type AnalyticsConfig = {
  analytics?: {
    gtm_id?: string | null;
    ga4_id?: string | null;
    googleAds_id?: string | null;
    metaPixelId?: string | null;
  } | null;
};

async function getAnalyticsConfig() {
  const data = await sanityFetch<AnalyticsConfig>({
    query: querySettings,
    tags: ['settings'],
  });

  return data?.analytics ?? null;
}

export default async function CookieConsent() {
  const analytics = await getAnalyticsConfig();

  if (
    !analytics?.gtm_id &&
    !analytics?.ga4_id &&
    !analytics?.googleAds_id &&
    !analytics?.metaPixelId
  ) {
    return null;
  }

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            ;(function () {
              const COOKIE_NAME = 'cookie-consent'
              const entry = document.cookie.split('; ').find(function (row) {
                return row.startsWith(COOKIE_NAME + '=')
              })
              let consent = null
              if (entry) {
                try {
                  consent = JSON.parse(decodeURIComponent(entry.split('=')[1]))
                } catch (e) {
                  consent = null
                }
              }
              const denied = {
                functionality_storage: 'denied',
                security_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                analytics_storage: 'denied',
                personalization_storage: 'denied',
                conversion_api: 'denied',
                advanced_matching: 'denied',
              }
              window.dataLayer = window.dataLayer || []
              window.gtag =
                window.gtag ||
                function gtag() {
                  window.dataLayer.push(arguments)
                }
              window.gtag('consent', 'default', consent || denied)
            })()
          `,
        }}
      />

      <CookieConsentClient
        gtmId={analytics?.gtm_id ?? null}
        ga4Id={analytics?.ga4_id ?? null}
        googleAdsId={analytics?.googleAds_id ?? null}
        metaPixelId={analytics?.metaPixelId ?? null}
        privacyPolicyUrl="/polityka-prywatnosci"
      />

      {analytics?.metaPixelId ? (
        <noscript>
          <img
            alt=""
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${analytics.metaPixelId}&ev=PageView&noscript=1`}
          />
        </noscript>
      ) : null}
    </>
  );
}
