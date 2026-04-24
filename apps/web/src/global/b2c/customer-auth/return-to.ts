const DEFAULT_CUSTOMER_ACCOUNT_RETURN_TO = '/konto-klienta/zamowienia/';

function normalizeReturnToValue(value: string): string | null {
  if (!value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  try {
    const url = new URL(value, 'https://audiofast.pl');
    const normalizedPathname = url.pathname.endsWith('/')
      ? url.pathname
      : `${url.pathname}/`;

    if (!normalizedPathname.startsWith('/konto-klienta/')) {
      return null;
    }

    if (normalizedPathname === '/konto-klienta/') {
      return DEFAULT_CUSTOMER_ACCOUNT_RETURN_TO;
    }

    return `${normalizedPathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function sanitizeCustomerAccountReturnTo(
  value: string | string[] | null | undefined,
): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return null;
  }

  return normalizeReturnToValue(rawValue);
}

export function resolveCustomerAccountReturnTo(
  value: string | string[] | null | undefined,
): string {
  return (
    sanitizeCustomerAccountReturnTo(value) ?? DEFAULT_CUSTOMER_ACCOUNT_RETURN_TO
  );
}

export function buildCustomerAccountGatewayHref(
  returnTo: string | null | undefined,
): string {
  const sanitizedReturnTo = sanitizeCustomerAccountReturnTo(returnTo);

  if (!sanitizedReturnTo) {
    return '/konto-klienta/';
  }

  return `/konto-klienta/?returnTo=${encodeURIComponent(sanitizedReturnTo)}`;
}
