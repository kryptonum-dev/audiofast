export type AnalyticsUser = {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  external_id?: string | number;
  postal_code?: string;
  city?: string;
  country_code?: string;
  state?: string;
  address?: string;
  [key: string]: unknown;
};

export type AnalyticsUtm = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  capturedAt: number;
};

export type MetaPixelInstance = {
  userData?: Record<string, string>;
  userDataFormFields?: Record<string, string>;
};

export type MetaPixelFunction = ((...args: unknown[]) => void) & {
  queue?: unknown[][];
  loaded?: boolean;
  callMethod?: (...args: unknown[]) => void;
  instance?: {
    pixelsByID?: Record<string, MetaPixelInstance>;
  };
};

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (command: string, ...args: unknown[]) => void;
    fbq?: MetaPixelFunction;
    _fbq?: {
      queue?: unknown[][];
    };
    trackEvent?: (params: Record<string, unknown>) => string;
    __analyticsReady?: boolean;
    __pageViewTracked?: boolean;
    __metaPixelId?: string | null;
    __metaPixelAdvancedMatching?: boolean;
  }
}

export {};
