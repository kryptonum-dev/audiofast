export const CONSENT_COOKIE_NAME = 'cookie-consent';
export const CONSENT_DURATION = 12 * 30 * 24 * 60 * 60 * 1000; // 12 months in milliseconds
export const CONSENT_VERSION = '1.0';

export const DEFAULT_CONSENT = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
  conversion_api: false,
  advanced_matching: false,
  consentGiven: false,
  timestamp: Date.now(),
  version: CONSENT_VERSION,
};

export type CookieConsent = typeof DEFAULT_CONSENT;

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const expires = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  ).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookieConsent(): CookieConsent | null {
  try {
    const consentCookie = getCookie(CONSENT_COOKIE_NAME);
    if (!consentCookie) return null;

    const consent: CookieConsent = JSON.parse(consentCookie);

    // Validate the structure
    if (
      typeof consent !== 'object' ||
      typeof consent.necessary !== 'boolean' ||
      typeof consent.analytics !== 'boolean' ||
      typeof consent.marketing !== 'boolean' ||
      typeof consent.preferences !== 'boolean' ||
      typeof consent.conversion_api !== 'boolean' ||
      typeof consent.advanced_matching !== 'boolean' ||
      typeof consent.consentGiven !== 'boolean' ||
      typeof consent.timestamp !== 'number' ||
      typeof consent.version !== 'string'
    ) {
      return null;
    }

    return consent;
  } catch (error) {
    console.error('Error parsing cookie consent:', error);
    return null;
  }
}

export function hasValidConsent(): boolean {
  const consent = getCookieConsent();
  if (!consent || !consent.consentGiven) return false;

  const isExpired = Date.now() - consent.timestamp > CONSENT_DURATION;
  if (isExpired) return false;

  return consent.version === CONSENT_VERSION;
}

export function saveCookieConsent(
  consent: Omit<CookieConsent, 'timestamp' | 'version'>
) {
  const fullConsent: CookieConsent = {
    ...consent,
    timestamp: Date.now(),
    version: CONSENT_VERSION,
  };

  setCookie(CONSENT_COOKIE_NAME, JSON.stringify(fullConsent), 365);

  // Dispatch custom event for analytics components to react
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('consentUpdated'));
    // Also trigger storage event for cross-tab sync
    window.dispatchEvent(
      new StorageEvent('storage', { key: CONSENT_COOKIE_NAME })
    );
  }

  // Update Google Consent Mode
  updateGoogleConsent(fullConsent);
}

export function updateGoogleConsent(consent: CookieConsent) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('consent', 'update', {
    functionality_storage: consent.necessary ? 'granted' : 'denied',
    security_storage: consent.necessary ? 'granted' : 'denied',
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.marketing ? 'granted' : 'denied',
    ad_user_data: consent.marketing ? 'granted' : 'denied',
    ad_personalization: consent.marketing ? 'granted' : 'denied',
    personalization_storage: consent.preferences ? 'granted' : 'denied',
  });

  // Trigger custom events for conversion API and advanced matching
  if (consent.conversion_api) {
    window.gtag('event', 'conversion_api_enabled');
  }
  if (consent.advanced_matching) {
    window.gtag('event', 'advanced_matching_enabled');
  }
}

// Initialize default consent mode (should be called before GTM loads)
export function initializeGoogleConsent() {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  // Set default consent to denied for everything except necessary
  window.gtag('consent', 'default', {
    functionality_storage: 'granted',
    security_storage: 'granted',
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    personalization_storage: 'denied',
    wait_for_update: 500,
  });

  // Check if user already has consent and update
  const consent = getCookieConsent();
  if (consent && consent.consentGiven) {
    updateGoogleConsent(consent);
  }
}

// Type declaration for gtag
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (coomand: string, ...args: unknown[]) => void;
  }
}
