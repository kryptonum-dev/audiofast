import type { SanityRawImage } from '@/components/shared/Image';

export type CartSupportCardData = {
  paragraph?: string | null;
  phoneNumber?: string | null;
  image?: SanityRawImage | null;
};

export type CartEmptyStateData = {
  heading?: string | null;
  description?: string | null;
  buttonText?: string | null;
};
