// Central types for the new combined Features Configurator (v2)

export type VariantSecondOption = {
  enabled?: boolean;
  kind?: 'numeric' | 'choice';
  numeric?: {
    label?: string;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    perUnitPrice?: number;
  };
  choices?: Array<{ label: string; value: string; price?: number }>;
  optional?: boolean;
  placeholder?: string; // Custom placeholder text for choice selects when optional=true
};

export type FeatureOptionV2 = {
  _key?: string;
  label: string;
  value: string;
  basePriceModifier: number;
  isAvailable: boolean;
  secondOption?: VariantSecondOption;
};

export type ProductFeatureV2 = {
  _key?: string;
  featureName: string;
  options: FeatureOptionV2[];
};

export type PrimaryVariantV2 = {
  _key?: string;
  label: string;
  value: string;
  basePrice: number;
  secondaryFeatures: ProductFeatureV2[];
};

export type FeatureConfigV2 = {
  primary?: {
    name: string;
    variants: PrimaryVariantV2[];
  };
  secondaryFeatures?: ProductFeatureV2[];
};

export type ProductDocumentWithFeatureConfigV2 = {
  _id?: string;
  featureConfig?: FeatureConfigV2;
  name?: string;
};
