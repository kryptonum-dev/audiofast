export const B2C_EMAIL_PRODUCTION_BASE_URL = 'https://audiofast.pl';
export const B2C_EMAIL_PREVIEW_BASE_URL =
  'https://audiofast-git-b2c-kryptonum.vercel.app';

export function getB2cEmailBaseUrl(): string {
  return process.env.VERCEL_ENV === 'production'
    ? B2C_EMAIL_PRODUCTION_BASE_URL
    : B2C_EMAIL_PREVIEW_BASE_URL;
}

export function buildB2cEmailUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return new URL(normalizedPath, getB2cEmailBaseUrl()).toString();
}

export function buildB2cOrderDetailEmailUrl(orderNumber: string): string {
  return buildB2cEmailUrl(
    `/konto-klienta/zamowienia/${encodeURIComponent(orderNumber)}/`,
  );
}
