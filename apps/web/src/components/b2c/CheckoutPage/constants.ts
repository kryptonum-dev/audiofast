export const CHECKOUT_FORM_ID = 'checkout-details-form';

export const SHOW_MOCK_PAYMENT_SCENARIO_SELECTOR =
  process.env.NODE_ENV !== 'production';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TAX_ID_DIGITS_PATTERN = /^\d{10}$/;
export const POSTAL_CODE_NON_DIGITS_PATTERN = /\D/g;
