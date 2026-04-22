import type { UseFormRegisterReturn, UseFormSetError } from 'react-hook-form';

import type { submitCheckout } from '@/src/app/actions/checkout-submit';
import type { CheckoutFormValues } from '@/src/global/b2c/checkout/form';
import {
  normalizePolishPhoneNumber,
  normalizePolishPostalCode,
} from '@/src/global/b2c/checkout/validation';
import { formatPrice } from '@/src/global/utils';

import {
  EMAIL_PATTERN,
  POSTAL_CODE_NON_DIGITS_PATTERN,
  TAX_ID_DIGITS_PATTERN,
} from './constants';

const validateRequiredPhone =
  (
    message: string = 'Podaj numer telefonu.',
    invalidMessage: string = 'Podaj poprawny numer telefonu.',
  ) =>
  (value: string | null) => {
    if (value === null || value.trim().length === 0) {
      return message;
    }

    return normalizePolishPhoneNumber(value) !== null || invalidMessage;
  };

const requiredString = (message: string) => ({
  required: message,
  validate: (value: string) =>
    (typeof value === 'string' && value.trim().length > 0) || message,
});

export const CHECKOUT_RULES = {
  firstName: requiredString('Podaj imię.'),
  lastName: requiredString('Podaj nazwisko.'),
  email: {
    required: 'Podaj adres e-mail.',
    pattern: {
      value: EMAIL_PATTERN,
      message: 'Podaj poprawny adres e-mail.',
    },
  },
  phone: { validate: validateRequiredPhone() },
  shippingRecipientFirstName: requiredString('Podaj imię odbiorcy.'),
  shippingRecipientLastName: requiredString('Podaj nazwisko odbiorcy.'),
  shippingRecipientPhone: {
    validate: validateRequiredPhone(
      'Podaj numer telefonu odbiorcy.',
      'Podaj poprawny numer telefonu odbiorcy.',
    ),
  },
  postalCode: {
    required: 'Podaj kod pocztowy.',
    validate: (value: string) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return 'Podaj kod pocztowy.';
      }

      return (
        normalizePolishPostalCode(value) !== null ||
        'Podaj poprawny kod pocztowy (00-000).'
      );
    },
  },
  city: requiredString('Podaj miejscowość.'),
  streetName: requiredString('Podaj nazwę ulicy.'),
  buildingNumber: requiredString('Podaj numer domu.'),
  companyName: requiredString('Podaj nazwę firmy.'),
  taxId: {
    required: 'Podaj NIP.',
    validate: (value: string) => {
      const digits = (value ?? '').replace(/[^0-9]/g, '');

      return (
        TAX_ID_DIGITS_PATTERN.test(digits) || 'Podaj poprawny NIP (10 cyfr).'
      );
    },
  },
  acceptRequiredConsents: {
    validate: (value: boolean) =>
      value === true || 'Musisz zaakceptować regulamin i politykę prywatności.',
  },
} as const;

/**
 * Progressive formatter used on every keystroke in a postal-code input.
 * Strips non-digits, caps at 5 digits, and injects the dash after the 2nd digit
 * so `05200` becomes `05-200` while the user is still typing.
 */
function formatPolishPostalCodeInput(value: string): string {
  const digits = value.replace(POSTAL_CODE_NON_DIGITS_PATTERN, '').slice(0, 5);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/**
 * Wraps a `react-hook-form` registration so the postal-code input auto-inserts
 * the dash after the 2nd digit. Keeps the original `onChange` wired into RHF
 * so form state stays in sync with what the user actually sees.
 */
export function withPostalCodeFormatting(
  registration: UseFormRegisterReturn,
): UseFormRegisterReturn {
  const originalOnChange = registration.onChange;

  return {
    ...registration,
    onChange: (event) => {
      const target = event.target as HTMLInputElement;
      const formatted = formatPolishPostalCodeInput(target.value);

      if (target.value !== formatted) {
        target.value = formatted;
      }

      return originalOnChange(event);
    },
  };
}

export function renderPrice(priceCents: number) {
  return formatPrice(priceCents).replace(/\s+/g, ' ').trim();
}

type SubmitCheckoutError = Extract<
  Awaited<ReturnType<typeof submitCheckout>>,
  { ok: false }
>['error'];

export function mapServerFieldErrors(
  setError: UseFormSetError<CheckoutFormValues>,
  error: SubmitCheckoutError,
) {
  if (error.code !== 'form_invalid') {
    return;
  }

  const fieldErrors = error.fieldErrors;

  if (fieldErrors.contact?.email) {
    setError('contact.email', {
      type: 'server',
      message: fieldErrors.contact.email,
    });
  }

  if (fieldErrors.contact?.firstName) {
    setError('contact.firstName', {
      type: 'server',
      message: fieldErrors.contact.firstName,
    });
  }

  if (fieldErrors.contact?.lastName) {
    setError('contact.lastName', {
      type: 'server',
      message: fieldErrors.contact.lastName,
    });
  }

  if (fieldErrors.contact?.phone) {
    setError('contact.phone', {
      type: 'server',
      message: fieldErrors.contact.phone,
    });
  }

  if (fieldErrors.shippingAddress?.firstName) {
    setError('shippingAddress.firstName', {
      type: 'server',
      message: fieldErrors.shippingAddress.firstName,
    });
  }

  if (fieldErrors.shippingAddress?.lastName) {
    setError('shippingAddress.lastName', {
      type: 'server',
      message: fieldErrors.shippingAddress.lastName,
    });
  }

  if (fieldErrors.shippingAddress?.phone) {
    setError('shippingAddress.phone', {
      type: 'server',
      message: fieldErrors.shippingAddress.phone,
    });
  }

  if (fieldErrors.shippingAddress?.streetName) {
    setError('shippingAddress.streetName', {
      type: 'server',
      message: fieldErrors.shippingAddress.streetName,
    });
  }

  if (fieldErrors.shippingAddress?.buildingNumber) {
    setError('shippingAddress.buildingNumber', {
      type: 'server',
      message: fieldErrors.shippingAddress.buildingNumber,
    });
  }

  if (fieldErrors.shippingAddress?.apartmentNumber) {
    setError('shippingAddress.apartmentNumber', {
      type: 'server',
      message: fieldErrors.shippingAddress.apartmentNumber,
    });
  }

  if (fieldErrors.shippingAddress?.postalCode) {
    setError('shippingAddress.postalCode', {
      type: 'server',
      message: fieldErrors.shippingAddress.postalCode,
    });
  }

  if (fieldErrors.shippingAddress?.city) {
    setError('shippingAddress.city', {
      type: 'server',
      message: fieldErrors.shippingAddress.city,
    });
  }

  if (fieldErrors.invoice?.companyName) {
    setError('invoiceCompanyName', {
      type: 'server',
      message: fieldErrors.invoice.companyName,
    });
  }

  if (fieldErrors.invoice?.taxId) {
    setError('invoiceTaxId', {
      type: 'server',
      message: fieldErrors.invoice.taxId,
    });
  }

  if (fieldErrors.invoice?.invoiceAddress?.streetName) {
    setError('invoiceAddress.streetName', {
      type: 'server',
      message: fieldErrors.invoice.invoiceAddress.streetName,
    });
  }

  if (fieldErrors.invoice?.invoiceAddress?.buildingNumber) {
    setError('invoiceAddress.buildingNumber', {
      type: 'server',
      message: fieldErrors.invoice.invoiceAddress.buildingNumber,
    });
  }

  if (fieldErrors.invoice?.invoiceAddress?.apartmentNumber) {
    setError('invoiceAddress.apartmentNumber', {
      type: 'server',
      message: fieldErrors.invoice.invoiceAddress.apartmentNumber,
    });
  }

  if (fieldErrors.invoice?.invoiceAddress?.postalCode) {
    setError('invoiceAddress.postalCode', {
      type: 'server',
      message: fieldErrors.invoice.invoiceAddress.postalCode,
    });
  }

  if (fieldErrors.invoice?.invoiceAddress?.city) {
    setError('invoiceAddress.city', {
      type: 'server',
      message: fieldErrors.invoice.invoiceAddress.city,
    });
  }

  if (fieldErrors.consents?.termsAccepted) {
    setError('acceptRequiredConsents', {
      type: 'server',
      message: fieldErrors.consents.termsAccepted,
    });
  }

  if (fieldErrors.consents?.privacyPolicyAccepted) {
    setError('acceptRequiredConsents', {
      type: 'server',
      message: fieldErrors.consents.privacyPolicyAccepted,
    });
  }
}
