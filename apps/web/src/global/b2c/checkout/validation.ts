import { z } from 'zod';

import type {
  CheckoutAddress,
  CheckoutConsentsInput,
  CheckoutContactInput,
  CheckoutDraft,
  CheckoutInvoiceAddressInput,
  CheckoutInvoiceInput,
  CheckoutSessionContext,
  CheckoutShippingAddressInput,
  CheckoutSubmitInput,
} from './types';

type ValidationErrorMap<T> = Partial<Record<keyof T, string>>;

export type CheckoutAddressErrors = ValidationErrorMap<CheckoutAddress>;

export type CheckoutContactErrors = ValidationErrorMap<CheckoutContactInput>;

export type CheckoutShippingAddressErrors =
  ValidationErrorMap<CheckoutShippingAddressInput>;

export type CheckoutInvoiceAddressErrors =
  ValidationErrorMap<CheckoutInvoiceAddressInput>;

export type CheckoutInvoiceErrors = Omit<
  ValidationErrorMap<CheckoutInvoiceInput>,
  'invoiceAddress'
> & {
  invoiceAddress?: CheckoutInvoiceAddressErrors;
};

export type CheckoutConsentsErrors =
  ValidationErrorMap<CheckoutConsentsInput>;

export type CheckoutSubmitErrors = {
  contact?: CheckoutContactErrors;
  shippingAddress?: CheckoutShippingAddressErrors;
  invoice?: CheckoutInvoiceErrors;
  consents?: CheckoutConsentsErrors;
  formErrors: string[];
};

export type CheckoutValidationSuccess<T> = {
  isValid: true;
  value: T;
  errors: CheckoutSubmitErrors;
};

export type CheckoutValidationFailure = {
  isValid: false;
  value: null;
  errors: CheckoutSubmitErrors;
};

export type CheckoutValidationResult<T> =
  | CheckoutValidationSuccess<T>
  | CheckoutValidationFailure;

const PHONE_SANITIZE_PATTERN = /[\s()-]/g;
const PHONE_ALLOWED_PATTERN = /^\+?[0-9]{6,15}$/;
const TAX_ID_SANITIZE_PATTERN = /[^0-9]/g;
const POSTAL_CODE_PATTERN = /^\d{2}-\d{3}$/;
const POLAND_COUNTRY_CODE = 'PL';

const trimmedRequiredString = (message: string) =>
  z.string().trim().min(1, message);

const nullableTrimmedString = z.preprocess(
  (value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
  },
  z.string().nullable(),
);

const nullablePhoneString = z.preprocess(
  (value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();

    if (normalized.length === 0) {
      return null;
    }

    return normalized.replace(PHONE_SANITIZE_PATTERN, '');
  },
  z
    .string()
    .regex(PHONE_ALLOWED_PATTERN, 'Podaj poprawny numer telefonu.')
    .nullable(),
);

const nullableTaxIdString = z.preprocess(
  (value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();

    if (normalized.length === 0) {
      return null;
    }

    return normalized.replace(TAX_ID_SANITIZE_PATTERN, '');
  },
  z.string().length(10, 'Podaj poprawny numer NIP.').nullable(),
);

const countrySchema = z.custom<typeof POLAND_COUNTRY_CODE>(
  (value) => value === POLAND_COUNTRY_CODE,
  {
    message: 'W pierwszej wersji formularz zamówienia obsługuje tylko Polskę.',
  },
);

const checkoutAddressObjectSchema = z.object({
  street: trimmedRequiredString('Podaj ulicę i numer adresu.'),
  postalCode: z
    .string()
    .trim()
    .min(1, 'Podaj kod pocztowy.')
    .regex(POSTAL_CODE_PATTERN, 'Podaj poprawny kod pocztowy w formacie 00-000.'),
  city: trimmedRequiredString('Podaj miejscowość.'),
  country: countrySchema,
});

export const checkoutAddressSchema: z.ZodType<CheckoutAddress> =
  checkoutAddressObjectSchema;

export const checkoutContactSchema: z.ZodType<CheckoutContactInput> = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Podaj adres e-mail.')
    .email('Podaj poprawny adres e-mail.')
    .transform((value) => value.toLowerCase()),
  firstName: trimmedRequiredString('Podaj imię.'),
  lastName: trimmedRequiredString('Podaj nazwisko.'),
  phone: nullablePhoneString,
});

export const checkoutShippingAddressSchema: z.ZodType<CheckoutShippingAddressInput> =
  checkoutAddressObjectSchema.extend({
    firstName: trimmedRequiredString('Podaj imię odbiorcy.'),
    lastName: trimmedRequiredString('Podaj nazwisko odbiorcy.'),
    phone: z.preprocess(
      (value) => {
        if (value === null) {
          return null;
        }

        if (typeof value !== 'string') {
          return value;
        }

        const normalized = value.trim();

        if (normalized.length === 0) {
          return null;
        }

        return normalized.replace(PHONE_SANITIZE_PATTERN, '');
      },
      z
        .string()
        .regex(PHONE_ALLOWED_PATTERN, 'Podaj poprawny numer telefonu odbiorcy.')
        .nullable(),
    ),
  });

export const checkoutInvoiceAddressSchema: z.ZodType<CheckoutInvoiceAddressInput> =
  checkoutAddressSchema;

export const checkoutInvoiceSchema: z.ZodType<CheckoutInvoiceInput> = z
  .object({
    recipientType: z.enum(['private', 'company'], {
      error: 'Wybierz poprawny typ nabywcy.',
    }),
    companyName: nullableTrimmedString,
    taxId: nullableTaxIdString,
    invoiceAddress: checkoutInvoiceAddressSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.recipientType !== 'company') {
      return;
    }

    if (!value.companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyName'],
        message: 'Podaj nazwę firmy.',
      });
    }

    if (!value.taxId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxId'],
        message: 'Podaj NIP.',
      });
    }

    if (!value.invoiceAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['invoiceAddress', 'street'],
        message: 'Podaj adres do faktury.',
      });
    }
  })
  .transform((value) =>
    value.recipientType === 'private'
      ? {
          ...value,
          companyName: null,
          taxId: null,
          invoiceAddress: null,
        }
      : value,
  );

export const checkoutConsentsSchema: z.ZodType<CheckoutConsentsInput> = z.object({
  termsAccepted: z.literal(true, {
    error: 'Zaakceptuj regulamin, aby przejść dalej.',
  }),
  privacyPolicyAccepted: z.literal(true, {
    error: 'Zaakceptuj politykę prywatności, aby przejść dalej.',
  }),
});

export const checkoutSubmitSchema: z.ZodType<CheckoutSubmitInput> = z.object({
  contact: checkoutContactSchema,
  shippingAddress: checkoutShippingAddressSchema,
  invoice: checkoutInvoiceSchema,
  consents: checkoutConsentsSchema,
  saveToProfile: z.boolean(),
});

function createEmptySubmitErrors(): CheckoutSubmitErrors {
  return {
    formErrors: [],
  };
}

function mapZodIssuesToSubmitErrors(
  issues: z.ZodIssue[],
  prefix?: 'contact' | 'shippingAddress' | 'invoice' | 'consents',
): CheckoutSubmitErrors {
  const errors = createEmptySubmitErrors();

  issues.forEach((issue) => {
    const path = prefix ? [prefix, ...issue.path] : issue.path;
    const [section, field, nestedField] = path;

    if (typeof section !== 'string') {
      errors.formErrors.push(issue.message);
      return;
    }

    if (
      section !== 'contact' &&
      section !== 'shippingAddress' &&
      section !== 'invoice' &&
      section !== 'consents'
    ) {
      errors.formErrors.push(issue.message);
      return;
    }

    if (!field || typeof field !== 'string') {
      errors.formErrors.push(issue.message);
      return;
    }

    if (section === 'contact') {
      if (!errors.contact) {
        errors.contact = {};
      }

      if (!errors.contact[field as keyof CheckoutContactErrors]) {
        errors.contact[field as keyof CheckoutContactErrors] = issue.message;
      }

      return;
    }

    if (section === 'shippingAddress') {
      if (!errors.shippingAddress) {
        errors.shippingAddress = {};
      }

      if (
        !errors.shippingAddress[field as keyof CheckoutShippingAddressErrors]
      ) {
        errors.shippingAddress[
          field as keyof CheckoutShippingAddressErrors
        ] = issue.message;
      }

      return;
    }

    if (section === 'consents') {
      if (!errors.consents) {
        errors.consents = {};
      }

      if (!errors.consents[field as keyof CheckoutConsentsErrors]) {
        errors.consents[field as keyof CheckoutConsentsErrors] = issue.message;
      }

      return;
    }

    if (section === 'invoice') {
      if (!errors.invoice) {
        errors.invoice = {};
      }

      if (field === 'invoiceAddress' && typeof nestedField === 'string') {
        const invoiceErrors = errors.invoice;

        if (!invoiceErrors.invoiceAddress) {
          invoiceErrors.invoiceAddress = {};
        }

        if (
          !invoiceErrors.invoiceAddress[
            nestedField as keyof CheckoutInvoiceAddressErrors
          ]
        ) {
          invoiceErrors.invoiceAddress[
            nestedField as keyof CheckoutInvoiceAddressErrors
          ] = issue.message;
        }

        return;
      }

      if (!errors.invoice[field as keyof CheckoutInvoiceErrors]) {
        errors.invoice[field as keyof CheckoutInvoiceErrors] = issue.message;
      }
    }
  });

  return errors;
}

function mergeSubmitErrors(
  ...parts: CheckoutSubmitErrors[]
): CheckoutSubmitErrors {
  return parts.reduce<CheckoutSubmitErrors>((accumulator, part) => {
    if (part.contact) {
      accumulator.contact = {
        ...accumulator.contact,
        ...part.contact,
      };
    }

    if (part.shippingAddress) {
      accumulator.shippingAddress = {
        ...accumulator.shippingAddress,
        ...part.shippingAddress,
      };
    }

    if (part.invoice) {
      accumulator.invoice = {
        ...(accumulator.invoice ?? {}),
        ...part.invoice,
        invoiceAddress: {
          ...(accumulator.invoice?.invoiceAddress ?? {}),
          ...(part.invoice.invoiceAddress ?? {}),
        },
      };
    }

    if (part.consents) {
      accumulator.consents = {
        ...accumulator.consents,
        ...part.consents,
      };
    }

    accumulator.formErrors.push(...part.formErrors);

    return accumulator;
  }, createEmptySubmitErrors());
}

function hasAnyErrors(errors: CheckoutSubmitErrors): boolean {
  return Boolean(
    errors.formErrors.length > 0 ||
      errors.contact ||
      errors.shippingAddress ||
      errors.invoice ||
      errors.consents,
  );
}

function createValidationFailure<T>(
  issues: z.ZodIssue[],
  prefix?: 'contact' | 'shippingAddress' | 'invoice' | 'consents',
): CheckoutValidationResult<T> {
  return {
    isValid: false,
    value: null,
    errors: mapZodIssuesToSubmitErrors(issues, prefix),
  };
}

export function validateCheckoutContact(
  input: CheckoutContactInput,
  sessionContext?: CheckoutSessionContext,
): CheckoutValidationResult<CheckoutContactInput> {
  const result = checkoutContactSchema.safeParse(input);

  if (!result.success) {
    return createValidationFailure<CheckoutContactInput>(
      result.error.issues,
      'contact',
    );
  }

  if (
    sessionContext?.isAuthenticated &&
    sessionContext.authenticatedEmail &&
    result.data.email !== sessionContext.authenticatedEmail.toLowerCase()
  ) {
    return {
      isValid: false,
      value: null,
      errors: {
        contact: {
          email:
            'Adres e-mail zalogowanego klienta nie może zostać zmieniony podczas składania zamówienia.',
        },
        formErrors: [],
      },
    };
  }

  return {
    isValid: true,
    value: result.data,
    errors: createEmptySubmitErrors(),
  };
}

export function validateCheckoutAddress(
  input: CheckoutAddress,
): CheckoutValidationResult<CheckoutAddress> {
  const result = checkoutAddressSchema.safeParse(input);

  if (!result.success) {
    return createValidationFailure<CheckoutAddress>(
      result.error.issues,
      'shippingAddress',
    );
  }

  return {
    isValid: true,
    value: result.data,
    errors: createEmptySubmitErrors(),
  };
}

export function validateCheckoutShippingAddress(
  input: CheckoutShippingAddressInput,
): CheckoutValidationResult<CheckoutShippingAddressInput> {
  const result = checkoutShippingAddressSchema.safeParse(input);

  if (!result.success) {
    return createValidationFailure<CheckoutShippingAddressInput>(
      result.error.issues,
      'shippingAddress',
    );
  }

  return {
    isValid: true,
    value: result.data,
    errors: createEmptySubmitErrors(),
  };
}

export function validateCheckoutInvoiceAddress(
  input: CheckoutInvoiceAddressInput,
): CheckoutValidationResult<CheckoutInvoiceAddressInput> {
  const result = checkoutInvoiceAddressSchema.safeParse(input);

  if (!result.success) {
    return createValidationFailure<CheckoutInvoiceAddressInput>(
      result.error.issues,
      'invoice',
    );
  }

  return {
    isValid: true,
    value: result.data,
    errors: createEmptySubmitErrors(),
  };
}

export function validateCheckoutInvoice(
  input: CheckoutInvoiceInput,
): CheckoutValidationResult<CheckoutInvoiceInput> {
  const result = checkoutInvoiceSchema.safeParse(input);

  if (!result.success) {
    return createValidationFailure<CheckoutInvoiceInput>(
      result.error.issues,
      'invoice',
    );
  }

  return {
    isValid: true,
    value: result.data,
    errors: createEmptySubmitErrors(),
  };
}

export function validateCheckoutConsents(
  input: CheckoutConsentsInput,
): CheckoutValidationResult<CheckoutConsentsInput> {
  const result = checkoutConsentsSchema.safeParse(input);

  if (!result.success) {
    return createValidationFailure<CheckoutConsentsInput>(
      result.error.issues,
      'consents',
    );
  }

  return {
    isValid: true,
    value: result.data,
    errors: createEmptySubmitErrors(),
  };
}

export function validateCheckoutSubmitInput(
  input: CheckoutSubmitInput,
  sessionContext?: CheckoutSessionContext,
): CheckoutValidationResult<CheckoutSubmitInput> {
  const contactResult = validateCheckoutContact(input.contact, sessionContext);
  const shippingResult = validateCheckoutShippingAddress(input.shippingAddress);
  const invoiceResult = validateCheckoutInvoice(input.invoice);
  const consentsResult = validateCheckoutConsents(input.consents);

  const errors = mergeSubmitErrors(
    contactResult.errors,
    shippingResult.errors,
    invoiceResult.errors,
    consentsResult.errors,
  );

  if (
    hasAnyErrors(errors) ||
    !contactResult.isValid ||
    !shippingResult.isValid ||
    !invoiceResult.isValid ||
    !consentsResult.isValid
  ) {
    errors.formErrors.push(
      'Nie udało się przejść dalej, ponieważ formularz zawiera błędy.',
    );

    return {
      isValid: false,
      value: null,
      errors,
    };
  }

  return {
    isValid: true,
    value: {
      contact: contactResult.value,
      shippingAddress: shippingResult.value,
      invoice: invoiceResult.value,
      consents: consentsResult.value,
      saveToProfile: input.saveToProfile,
    },
    errors,
  };
}

export function createEmptyCheckoutDraft(): CheckoutDraft {
  return {
    contact: {
      email: '',
      firstName: '',
      lastName: '',
      phone: null,
    },
    shippingAddress: {
      firstName: '',
      lastName: '',
      phone: null,
      street: '',
      postalCode: '',
      city: '',
      country: POLAND_COUNTRY_CODE,
    },
    invoice: {
      recipientType: 'private',
      companyName: null,
      taxId: null,
      invoiceAddress: null,
    },
    consents: {
      termsAccepted: false,
      privacyPolicyAccepted: false,
    },
    saveToProfile: false,
    updatedAt: null,
  };
}
