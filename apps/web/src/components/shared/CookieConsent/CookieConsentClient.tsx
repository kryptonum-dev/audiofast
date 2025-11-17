'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { setCookie } from '@/global/analytics/set-cookie';

import Button from '../../ui/Button';
import Switch from '../../ui/Switch';
import type {
  ConsentGroup,
  ConsentModeState,
  ConsentSelections,
  CookieConsentClientProps,
} from './CookieConsent.types';
import styles from './styles.module.scss';

const COOKIE_NAME = 'cookie-consent';
const CONSENT_ACCEPT_TTL_DAYS = 365;
const CONSENT_DENY_TTL_DAYS = 30 / (24 * 60); // 30 minutes

const PREFERENCES: ConsentGroup[] = [
  {
    id: 'necessary',
    key: 'necessary',
    title: 'Niezbędne',
    description:
      'Te pliki cookie są wymagane do podstawowego działania strony i nie można ich wyłączyć.',
    disabled: true,
  },
  {
    id: 'analytics',
    key: 'analytics',
    title: 'Analityczne',
    description:
      'Pomagają nam zrozumieć, jak odwiedzający korzystają z naszej strony internetowej (Google Analytics).',
  },
  {
    id: 'preferences',
    key: 'preferences',
    title: 'Preferencje',
    description:
      'Umożliwiają zapamiętanie wyborów użytkownika, takich jak język czy region.',
  },
  {
    id: 'marketing',
    key: 'marketing',
    title: 'Marketingowe',
    description:
      'Używane do śledzenia odwiedzających w różnych witrynach w celu wyświetlania reklam (Google Ads, Meta).',
    subGroups: [
      {
        id: 'conversion_api',
        key: 'conversion_api',
        title: 'Conversion API',
        description:
          'Pozwala na przesyłanie danych o konwersjach bezpośrednio do platform reklamowych.',
      },
      {
        id: 'advanced_matching',
        key: 'advanced_matching',
        title: 'Zaawansowane dopasowanie',
        description:
          'Wykorzystuje dodatkowe informacje o użytkowniku do lepszego dopasowania reklam i mierzenia ich skuteczności.',
      },
    ],
  },
];

const loadedMetaPixels = new Set<string>();
let gtagScriptPromise: Promise<void> | null = null;
let isGtagLoaded = false;

export default function CookieConsentClient({
  gtmId,
  ga4Id,
  googleAdsId,
  metaPixelId,
  privacyPolicyUrl,
}: CookieConsentClientProps) {
  const hasVendors = Boolean(gtmId || ga4Id || googleAdsId || metaPixelId);
  const [isVisible, setIsVisible] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [consentSelections, setConsentSelections] = useState<ConsentSelections>(
    {
      necessary: true,
      analytics: false,
      preferences: false,
      marketing: false,
      conversion_api: false,
      advanced_matching: false,
    }
  );

  const initializeTracking = useCallback(
    async (selections: ConsentSelections) => {
      if (!hasVendors || typeof window === 'undefined') {
        setAnalyticsReady(true);
        return;
      }

      setAnalyticsReady(false);

      try {
        if (metaPixelId && selections.marketing) {
          await ensureMetaPixel(metaPixelId, selections);
          window.fbq?.('consent', 'grant');
        } else if (window.fbq) {
          window.fbq('consent', 'revoke');
        }

        const requiresGtag =
          (ga4Id && selections.analytics) ||
          (googleAdsId && selections.marketing);
        const primaryGtagId = ga4Id ?? googleAdsId ?? null;

        if (primaryGtagId && requiresGtag) {
          try {
            await ensureGtagScript(primaryGtagId);

            if (ga4Id && selections.analytics) {
              window.gtag?.('config', ga4Id, { send_page_view: false });
            }

            if (googleAdsId && selections.marketing) {
              window.gtag?.('config', googleAdsId);
            }
          } catch (error) {
            console.error(
              '[CookieConsent] Nie udało się załadować gtag',
              error
            );
          }
        }

        if (gtmId && (selections.analytics || selections.marketing)) {
          try {
            await ensureGtmScript(gtmId);
          } catch (error) {
            console.error('[CookieConsent] Nie udało się załadować GTM', error);
          }
        }
      } finally {
        setAnalyticsReady(true);
      }
    },
    [ga4Id, googleAdsId, gtmId, hasVendors, metaPixelId]
  );

  useEffect(() => {
    if (!hasVendors) return;

    const storedConsent = parseConsentCookie(getCookie(COOKIE_NAME));
    if (!storedConsent) {
      setIsVisible(true);
      return;
    }

    const selection = selectionFromConsent(storedConsent);
    setConsentSelections(selection);
    void initializeTracking(selection);
  }, [hasVendors, initializeTracking]);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const handleConsentApply = useCallback(
    async (selection: ConsentSelections) => {
      const consentMode = toConsentMode(selection);
      window.gtag?.('consent', 'update', consentMode);

      const ttl =
        selection.analytics || selection.marketing || selection.preferences
          ? CONSENT_ACCEPT_TTL_DAYS
          : CONSENT_DENY_TTL_DAYS;

      setCookie(COOKIE_NAME, JSON.stringify(consentMode), ttl);
      setConsentSelections(selection);
      setIsVisible(false);
      setIsPreferencesOpen(false);

      await initializeTracking(selection);

      document.dispatchEvent(
        new CustomEvent('cookie_consent_updated', { detail: consentMode })
      );
    },
    [initializeTracking]
  );

  const handleAcceptAll = useCallback(() => {
    void handleConsentApply({
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
      conversion_api: true,
      advanced_matching: true,
    });
  }, [handleConsentApply]);

  const handleRejectAll = useCallback(() => {
    void handleConsentApply({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
      conversion_api: false,
      advanced_matching: false,
    });
  }, [handleConsentApply]);

  const handleSavePreferences = useCallback(() => {
    void handleConsentApply({
      ...consentSelections,
      necessary: true,
    });
  }, [consentSelections, handleConsentApply]);

  const togglePreference = useCallback((key: keyof ConsentSelections) => {
    if (key === 'necessary') return;

    setConsentSelections((prev) => {
      const nextValue = !prev[key];

      if (key === 'marketing') {
        return {
          ...prev,
          marketing: nextValue,
          conversion_api: nextValue,
          advanced_matching: nextValue,
        };
      }

      if (key === 'conversion_api' || key === 'advanced_matching') {
        return {
          ...prev,
          [key]: nextValue,
          marketing: nextValue ? true : prev.marketing,
        };
      }

      return {
        ...prev,
        [key]: nextValue,
      };
    });
  }, []);

  if (!hasVendors || !isVisible) {
    return null;
  }

  return (
    <aside className={styles.overlay} role="dialog" aria-modal="true">
      <section className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.heading}>
            {isPreferencesOpen
              ? 'Ustawienia cookie'
              : 'Korzystając ze strony zgadzasz się na użycie ciasteczek'}
          </h2>
          <p className={styles.description}>
            {!isPreferencesOpen ? (
              <>
                Korzystamy z cookie i podobnych technologii, aby analizować
                ruch, dopasować treści i wyświetlać trafniejsze reklamy.{' '}
                <Link
                  href={privacyPolicyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  Dowiedz się więcej
                </Link>
              </>
            ) : (
              <>
                Zarządzaj ustawieniami prywatności i zdecyduj, jakie kategorie
                cookie mają być aktywne.{' '}
                <Link
                  href={privacyPolicyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  Dowiedz się więcej
                </Link>
              </>
            )}
          </p>
        </header>

        {isPreferencesOpen && (
          <div className={styles.preferences}>
            {PREFERENCES.map((preference) => (
              <div key={preference.id} className={styles.preferenceItem}>
                <label htmlFor={preference.id}>
                  <Switch
                    id={preference.id}
                    asLabel={false}
                    inputProps={{
                      checked:
                        preference.key === 'necessary'
                          ? true
                          : consentSelections[preference.key],
                      disabled: preference.disabled,
                      onChange:
                        preference.key === 'necessary'
                          ? undefined
                          : () => togglePreference(preference.key),
                    }}
                  />
                  <p className={styles.name}>{preference.title}</p>
                  <p className={styles.description}>{preference.description}</p>
                </label>
                {preference.subGroups && (
                  <div className={styles.subGroups}>
                    {preference.subGroups.map((subGroup) => (
                      <div key={subGroup.id} className={styles.subGroupItem}>
                        <label htmlFor={subGroup.id}>
                          <Switch
                            id={subGroup.id}
                            asLabel={false}
                            inputProps={{
                              checked: consentSelections[subGroup.key],
                              onChange: () => togglePreference(subGroup.key),
                            }}
                          />
                          <p className={styles.name}>{subGroup.title}</p>
                          <p className={styles.description}>
                            {subGroup.description}
                          </p>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={styles.buttons}>
          <Button text="Zgoda na wszystkie" onClick={handleAcceptAll} />
          <button
            type="button"
            onClick={
              isPreferencesOpen
                ? handleSavePreferences
                : () => setIsPreferencesOpen(true)
            }
            className="link"
          >
            {isPreferencesOpen ? 'Zapisz wybrane' : 'Ustaw preferencje'}
          </button>
          <button type="button" onClick={handleRejectAll} className="link">
            Odmowa
          </button>
        </div>
      </section>
    </aside>
  );
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()?.split(';').shift() ?? '');
  }
  return null;
}

function parseConsentCookie(raw: string | null): ConsentModeState | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConsentModeState;
  } catch {
    return null;
  }
}

function selectionFromConsent(consent: ConsentModeState): ConsentSelections {
  return {
    necessary: consent.functionality_storage === 'granted',
    analytics: consent.analytics_storage === 'granted',
    preferences: consent.personalization_storage === 'granted',
    marketing: consent.ad_storage === 'granted',
    conversion_api: consent.conversion_api === 'granted',
    advanced_matching: consent.advanced_matching === 'granted',
  };
}

function toConsentMode(selection: ConsentSelections): ConsentModeState {
  return {
    functionality_storage: 'granted',
    security_storage: 'granted',
    analytics_storage: selection.analytics ? 'granted' : 'denied',
    personalization_storage: selection.preferences ? 'granted' : 'denied',
    ad_storage: selection.marketing ? 'granted' : 'denied',
    ad_user_data: selection.marketing ? 'granted' : 'denied',
    ad_personalization: selection.marketing ? 'granted' : 'denied',
    conversion_api: selection.conversion_api ? 'granted' : 'denied',
    advanced_matching: selection.advanced_matching ? 'granted' : 'denied',
  };
}

function setAnalyticsReady(ready: boolean) {
  if (typeof window === 'undefined') return;
  window.__analyticsReady = ready;
  if (ready) {
    document.dispatchEvent(new Event('analytics_ready'));
  }
}

async function ensureGtagScript(primaryId: string) {
  if (typeof window === 'undefined') return;
  if (isGtagLoaded) return;
  if (gtagScriptPromise) return gtagScriptPromise;

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-gtag-loaded="true"]'
  );
  if (existingScript) {
    isGtagLoaded = true;
    return;
  }

  gtagScriptPromise = new Promise<void>((resolve, reject) => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
    script.async = true;
    script.setAttribute('data-gtag-loaded', 'true');
    script.onload = () => {
      isGtagLoaded = true;
      resolve();
    };
    script.onerror = () => {
      gtagScriptPromise = null;
      script.remove();
      reject(new Error('Failed to load gtag'));
    };
    document.head.appendChild(script);
  });

  return gtagScriptPromise;
}

async function ensureGtmScript(gtmId: string) {
  if (typeof window === 'undefined') return;
  if (document.getElementById(`gtm-${gtmId}`)) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = `gtm-${gtmId}`;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`[CookieConsent] Failed to load GTM ${gtmId}`));
    };
    document.head.appendChild(script);
  });
}

async function ensureMetaPixel(
  metaPixelId: string,
  selections: ConsentSelections
) {
  if (typeof window === 'undefined') return;

  window.__metaPixelId = metaPixelId;
  window.__metaPixelAdvancedMatching = selections.advanced_matching;

  if (!loadedMetaPixels.has(metaPixelId)) {
    if (!window.fbq) {
      const script = document.createElement('script');
      script.innerHTML = `
        !(function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
        })(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
      `;
      document.head.appendChild(script);
    }

    loadedMetaPixels.add(metaPixelId);
    window.fbq?.('init', metaPixelId);
  }
}
