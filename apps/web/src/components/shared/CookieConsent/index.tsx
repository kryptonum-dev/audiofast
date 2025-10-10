'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  type CookieConsent,
  getCookieConsent,
  hasValidConsent,
  saveCookieConsent,
} from '@/src/lib/cookie-utils';

import Button from '../../ui/Button';
import Switch from '../../ui/Switch';
import styles from './styles.module.scss';

const PREFERENCES = [
  {
    id: 'necessary',
    key: 'necessary' as const,
    title: 'Niezbędne',
    description:
      'Te pliki cookie są wymagane do podstawowego działania strony i nie można ich wyłączyć.',
    disabled: true,
  },
  {
    id: 'analytics',
    key: 'analytics' as const,
    title: 'Analityczne',
    description:
      'Pomagają nam zrozumieć, jak odwiedzający korzystają z naszej strony internetowej (Google Analytics).',
    disabled: false,
  },
  {
    id: 'preferences',
    key: 'preferences' as const,
    title: 'Preferencje',
    description:
      'Umożliwiają zapamiętanie wyborów użytkownika, takich jak język czy region.',
    disabled: false,
  },
  {
    id: 'marketing',
    key: 'marketing' as const,
    title: 'Marketingowe',
    description:
      'Używane do śledzenia odwiedzających w różnych witrynach w celu wyświetlania reklam (Google Ads).',
    disabled: false,
    subGroups: [
      {
        id: 'conversion_api',
        key: 'conversion_api' as const,
        title: 'Conversion API',
        description:
          'Pozwala na przesyłanie danych o konwersjach bezpośrednio do platform reklamowych, co umożliwia lepsze śledzenie skuteczności reklam.',
      },
      {
        id: 'advanced_matching',
        key: 'advanced_matching' as const,
        title: 'Zaawansowane dopasowanie',
        description:
          'Wykorzystuje dodatkowe informacje o użytkowniku do lepszego dopasowania reklam i mierzenia ich skuteczności.',
      },
    ],
  },
];

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<
    Omit<CookieConsent, 'timestamp' | 'version'>
  >({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
    conversion_api: false,
    advanced_matching: false,
    consentGiven: false,
  });

  useEffect(() => {
    // Check if consent is needed
    const needsConsent = !hasValidConsent();
    setShowBanner(needsConsent);

    // Load existing preferences if available
    const existingConsent = getCookieConsent();
    if (existingConsent) {
      setPreferences({
        necessary: existingConsent.necessary,
        analytics: existingConsent.analytics,
        marketing: existingConsent.marketing,
        preferences: existingConsent.preferences,
        conversion_api: existingConsent.conversion_api,
        advanced_matching: existingConsent.advanced_matching,
        consentGiven: existingConsent.consentGiven,
      });
    }
  }, []);

  const handleAcceptAll = () => {
    const consent = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
      conversion_api: true,
      advanced_matching: true,
      consentGiven: true,
    };
    saveCookieConsent(consent);
    setShowBanner(false);
    document.body.style.overflow = '';
  };

  const handleRejectAll = () => {
    const consent = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
      conversion_api: false,
      advanced_matching: false,
      consentGiven: true,
    };
    saveCookieConsent(consent);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    const consent = {
      ...preferences,
      necessary: true, // Always true
      consentGiven: true,
    };
    saveCookieConsent(consent);
    setShowBanner(false);
    setShowSettings(false);
  };

  const togglePreference = (
    key:
      | 'necessary'
      | 'analytics'
      | 'marketing'
      | 'preferences'
      | 'conversion_api'
      | 'advanced_matching'
  ) => {
    // Don't allow toggling necessary cookies
    if (key === 'necessary') return;

    setPreferences((prev) => {
      const newValue = !prev[key];

      // If toggling marketing, also toggle its subgroups
      if (key === 'marketing') {
        return {
          ...prev,
          marketing: newValue,
          conversion_api: newValue,
          advanced_matching: newValue,
        };
      }

      // If enabling a subgroup, also enable marketing
      if (
        (key === 'conversion_api' || key === 'advanced_matching') &&
        newValue
      ) {
        return {
          ...prev,
          [key]: newValue,
          marketing: true,
        };
      }

      return {
        ...prev,
        [key]: newValue,
      };
    });
  };

  if (!showBanner) return null;

  return (
    <aside className={styles.overlay}>
      <section className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.heading}>
            {showSettings
              ? 'Ustawienia cookie'
              : 'Korzystając ze strony zgadzasz się na użycie ciasteczek'}
          </h2>
          <p className={styles.description}>
            {!showSettings ? (
              <>
                Korzystamy z cookie i podobnych technologii, by analizowac ruch
                na stronie, dopasowac ja do Ciebie i wyswietlac trafniejsze
                reklamy.{' '}
                <Link
                  href="/polityka-prywatnosci"
                  target="_blank"
                  className="link"
                >
                  Dowiedz sie wiecej
                </Link>
              </>
            ) : (
              <>
                Korzystajac ze strony zgadzasz sie na uzycie tych ciasteczek.{' '}
                <Link
                  href="/polityka-prywatnosci"
                  target="_blank"
                  className="link"
                >
                  Dowiedz sie wiecej
                </Link>
              </>
            )}
          </p>
        </header>

        {showSettings && (
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
                          : preferences[preference.key],
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
                              checked: preferences[subGroup.key],
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
              showSettings ? handleSavePreferences : () => setShowSettings(true)
            }
            className="link"
          >
            {showSettings ? 'Zapisz wybrane' : 'Ustaw preferencje'}
          </button>
          <button type="button" onClick={handleRejectAll} className="link">
            Odmowa
          </button>
        </div>
      </section>
    </aside>
  );
}
