export type ConsentGroupId =
  | 'necessary'
  | 'analytics'
  | 'preferences'
  | 'marketing';

export type ConsentSubGroupId = 'conversion_api' | 'advanced_matching';

export type ConsentSelections = {
  necessary: boolean;
  analytics: boolean;
  preferences: boolean;
  marketing: boolean;
  conversion_api: boolean;
  advanced_matching: boolean;
};

export type ConsentModeState = {
  functionality_storage: 'granted' | 'denied';
  security_storage: 'granted' | 'denied';
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
  analytics_storage: 'granted' | 'denied';
  personalization_storage: 'granted' | 'denied';
  conversion_api: 'granted' | 'denied';
  advanced_matching: 'granted' | 'denied';
};

export type ConsentSubGroup = {
  id: ConsentSubGroupId;
  key: ConsentSubGroupId;
  title: string;
  description: string;
};

export type ConsentGroup = {
  id: ConsentGroupId;
  key: ConsentGroupId;
  title: string;
  description: string;
  disabled?: boolean;
  subGroups?: ConsentSubGroup[];
};

export type CookieConsentClientProps = {
  gtmId?: string | null;
  ga4Id?: string | null;
  googleAdsId?: string | null;
  metaPixelId?: string | null;
  privacyPolicyUrl: string;
};
