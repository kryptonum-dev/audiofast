export const E2E_EMAIL_DOMAIN = 'audiofast.test';
export const E2E_CUSTOMER_AUTH_STATE_PATH = 'e2e/.auth/customer.json';
export const E2E_CUSTOMER_AUTH_EMAIL = `e2e+customer-auth@${E2E_EMAIL_DOMAIN}`;

export const E2E_EMAIL_PREFIXES = {
  guestCheckout: 'e2e+guest-checkout',
  checkoutValidation: 'e2e+checkout-validation',
} as const;
