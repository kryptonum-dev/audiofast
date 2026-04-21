'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import Image from '@/components/shared/Image';
import { submitCheckout } from '@/src/app/actions/checkout-submit';
import CartSupportCard from '@/src/components/b2c/CartPage/CartSupportCard';
import type { CartSupportCardData } from '@/src/components/b2c/CartPage/types';
import Checkbox from '@/src/components/ui/Checkbox';
import Error from '@/src/components/ui/Error';
import Input from '@/src/components/ui/Input';
import { getInvalidCartLines } from '@/src/global/b2c/cart/cart-selectors';
import type { CartLine, CartState } from '@/src/global/b2c/cart/types';
import { useCart } from '@/src/global/b2c/cart/use-cart';
import {
  buildCheckoutFormValues,
  buildCheckoutSubmitInput,
  type CheckoutFormValues,
} from '@/src/global/b2c/checkout/form';
import type {
  CheckoutDraft,
  CheckoutProfileDefaults,
  CheckoutSessionContext,
} from '@/src/global/b2c/checkout/types';
import { normalizePolishPhoneNumber } from '@/src/global/b2c/checkout/validation';
import { formatPrice } from '@/src/global/utils';

import CheckoutSummaryCard from './CheckoutSummaryCard';
import styles from './styles.module.scss';

type CheckoutPageClientProps = {
  initialDraft: CheckoutDraft;
  isEmailLocked: boolean;
  sessionContext: CheckoutSessionContext;
  customerProfile: CheckoutProfileDefaults | null;
  canPrefillFromProfile: boolean;
  supportCard?: CartSupportCardData | null;
};

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

const CHECKOUT_FORM_ID = 'checkout-details-form';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_PATTERN = /^\d{2}-\d{3}$/;
const TAX_ID_DIGITS_PATTERN = /^\d{10}$/;

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

const CHECKOUT_RULES = {
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
    pattern: {
      value: POSTAL_CODE_PATTERN,
      message: 'Podaj poprawny kod pocztowy (00-000).',
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

function renderPrice(priceCents: number) {
  return formatPrice(priceCents).replace(/\s+/g, ' ').trim();
}

function mapServerFieldErrors(
  setError: ReturnType<typeof useForm<CheckoutFormValues>>['setError'],
  error: Extract<
    Awaited<ReturnType<typeof submitCheckout>>,
    { ok: false }
  >['error'],
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

function CheckoutSection({
  title,
  headerAction = null,
  children,
}: {
  title: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionHeading}>{title}</h2>
        {headerAction}
      </div>
      {children}
    </section>
  );
}

const LoginHintIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={18}
    height={18}
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#checkout-login-hint-clip)"
    >
      <path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M16 19h6M19 16v6M6 21v-2a4 4 0 0 1 4-4h4" />
    </g>
    <defs>
      <clipPath id="checkout-login-hint-clip">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);

export default function CheckoutPageClient({
  initialDraft,
  isEmailLocked,
  sessionContext,
  supportCard = null,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const { cart, isHydrated, applyCartLineRevalidation } = useCart();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isCartBlockingOverlayOpen, setIsCartBlockingOverlayOpen] =
    useState(false);
  const [showPriceChangeNotice, setShowPriceChangeNotice] = useState(false);
  const baseFormValues = useMemo(
    () => buildCheckoutFormValues(initialDraft),
    [initialDraft],
  );
  const [provideSeparateBillingAddress, setProvideSeparateBillingAddress] =
    useState(baseFormValues.provideSeparateBillingAddress);
  const [shippingRecipientDiffers, setShippingRecipientDiffers] = useState(
    baseFormValues.shippingRecipientDiffers,
  );
  const {
    register,
    handleSubmit,
    control,
    clearErrors,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    defaultValues: baseFormValues,
    mode: 'onTouched',
  });

  const buyerType = useWatch({ control, name: 'buyerType' });
  const acceptRequiredConsents = useWatch({
    control,
    name: 'acceptRequiredConsents',
  });
  const newsletterOptIn = useWatch({ control, name: 'newsletterOptIn' });
  const isCompanyInvoice = buyerType === 'company';

  const blockingCartLines = useMemo(
    () => getInvalidCartLines(cart as CartState),
    [cart],
  );

  const buyerTypeRegister = register('buyerType', {
    onChange: (event) => {
      const nextValue = (event.target as HTMLInputElement).value;

      if (nextValue !== 'company') {
        setValue('invoiceCompanyName', '', { shouldDirty: true });
        setValue('invoiceTaxId', '', { shouldDirty: true });
      }
    },
  });

  const onSubmit = async (values: CheckoutFormValues) => {
    clearErrors();
    setFeedback(null);
    setShowPriceChangeNotice(false);

    const result = await submitCheckout(
      buildCheckoutSubmitInput({
        ...values,
        provideSeparateBillingAddress,
        shippingRecipientDiffers,
      }),
      cart,
    );

    if (!result.ok) {
      if (result.revalidationResults) {
        applyCartLineRevalidation(result.revalidationResults);
      }

      if (result.error.code === 'cart_invalid') {
        setIsCartBlockingOverlayOpen(true);
        return;
      }

      if (result.error.code === 'cart_price_updated') {
        setShowPriceChangeNotice(true);
        return;
      }

      mapServerFieldErrors(setError, result.error);
      setFeedback({
        tone: 'error',
        message: result.error.message,
      });
      return;
    }

    // Mock success path: payment integration is not wired yet, so we route
    // the customer to a temporary thank-you page. The cart is intentionally
    // kept intact to make manual checkout re-runs easier during development.
    const orderNumber = encodeURIComponent(result.value.orderNumber);
    router.push(`/podziekowania-za-zakup/?order=${orderNumber}`);
  };

  if (!isHydrated) {
    return (
      <main id="main" className="max-width">
        <section className={styles.checkoutPage}>
          <div className={styles.loadingCard}>
            <h1 className={styles.pageHeading}>
              Ładowanie formularza zamówienia…
            </h1>
          </div>
        </section>
      </main>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <main id="main" className="max-width">
        <section className={styles.checkoutPage}>
          <div className={styles.emptyStateCard}>
            <h1 className={styles.pageHeading}>Twój koszyk jest pusty</h1>
            <p className={styles.pageDescription}>
              Dodaj produkty do koszyka, aby przejść do formularza zamówienia.
            </p>
            <Link href="/koszyk/" className={styles.primaryLink}>
              Wróć do koszyka
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="main">
      <section className={`${styles.checkoutPage} max-width`}>
        <div className={styles.layout}>
          <div className={styles.formColumn}>
            {showPriceChangeNotice ? (
              <div
                className={styles.priceChangeNotice}
                role="status"
                aria-live="polite"
              >
                <strong className={styles.priceChangeNoticeTitle}>
                  Ceny zostały zaktualizowane
                </strong>
                <p className={styles.priceChangeNoticeText}>
                  Sprawdź nową łączną kwotę i ponownie kliknij „Przejdź do
                  płatności”, aby potwierdzić zamówienie.
                </p>
              </div>
            ) : null}

            {feedback ? (
              <div
                className={styles.feedbackBanner}
                data-tone={feedback.tone}
                role="status"
              >
                {feedback.message}
              </div>
            ) : null}

            <section className={styles.orderPreviewCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionHeading}>
                  Koszyk ({cart.lines.length})
                </h2>
                <Link href="/koszyk/" className="link">
                  Zmień koszyk
                </Link>
              </div>

              <ul className={styles.orderPreviewList}>
                {cart.lines.map((line) => (
                  <li key={line.lineId} className={styles.orderPreviewItem}>
                    <div className={styles.orderPreviewMedia}>
                      <Image image={line.product.image} sizes="96px" />
                    </div>

                    <div className={styles.orderPreviewMeta}>
                      <span className={styles.orderPreviewName}>
                        {line.productName}
                      </span>
                      <span className={styles.orderPreviewQuantity}>
                        {line.quantity} szt.
                      </span>
                    </div>
                    <span className={styles.orderPreviewPrice}>
                      {renderPrice(line.unitPriceCents * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <form
              id={CHECKOUT_FORM_ID}
              className={styles.form}
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <CheckoutSection
                title="Kontakt"
                headerAction={
                  !sessionContext.isAuthenticated ? (
                    <Link
                      href="/konto-klienta/"
                      className={styles.loginHintLink}
                    >
                      <LoginHintIcon />
                      <span>
                        Masz już konto?{' '}
                        <span className={styles.loginHintLinkAction}>
                          Zaloguj się
                        </span>
                      </span>
                    </Link>
                  ) : null
                }
              >
                <div className={styles.fieldGridTwo}>
                  <Input
                    label="Imię"
                    register={register(
                      'contact.firstName',
                      CHECKOUT_RULES.firstName,
                    )}
                    errors={errors.contact?.firstName?.message ?? ''}
                    placeholder="Jan"
                  />
                  <Input
                    label="Nazwisko"
                    register={register(
                      'contact.lastName',
                      CHECKOUT_RULES.lastName,
                    )}
                    errors={errors.contact?.lastName?.message ?? ''}
                    placeholder="Kowalski"
                  />
                </div>

                <div className={styles.fieldGridTwo}>
                  <Input
                    label="Telefon"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    register={register('contact.phone', CHECKOUT_RULES.phone)}
                    errors={errors.contact?.phone?.message ?? ''}
                    placeholder="123 456 789"
                  />
                  <div className={styles.lockedField}>
                    <Input
                      label="Adres e-mail"
                      type="email"
                      readOnly={isEmailLocked}
                      register={register('contact.email', CHECKOUT_RULES.email)}
                      errors={errors.contact?.email?.message ?? ''}
                      placeholder="jan@example.com"
                    />
                  </div>
                </div>
              </CheckoutSection>

              <CheckoutSection title="Kupuję jako">
                <div className={styles.radioGroup} role="radiogroup">
                  <label className={styles.radioOption}>
                    <input
                      {...buyerTypeRegister}
                      className={styles.radioInput}
                      type="radio"
                      value="private"
                    />
                    <span className={styles.radioLabel}>Osoba fizyczna</span>
                  </label>

                  <label className={styles.radioOption}>
                    <input
                      {...buyerTypeRegister}
                      className={styles.radioInput}
                      type="radio"
                      value="company"
                    />
                    <span className={styles.radioLabel}>
                      Firma/przedsiębiorca
                    </span>
                  </label>
                </div>

                {isCompanyInvoice ? (
                  <div className={styles.invoiceBranch}>
                    <div className={styles.fieldGridTwo}>
                      <Input
                        label="Nazwa firmy"
                        register={register(
                          'invoiceCompanyName',
                          isCompanyInvoice ? CHECKOUT_RULES.companyName : {},
                        )}
                        errors={errors.invoiceCompanyName?.message ?? ''}
                        placeholder="Audiofast Sp. z o.o."
                      />
                      <Input
                        label="NIP"
                        register={register(
                          'invoiceTaxId',
                          isCompanyInvoice ? CHECKOUT_RULES.taxId : {},
                        )}
                        errors={errors.invoiceTaxId?.message ?? ''}
                        placeholder="1234567890"
                      />
                    </div>

                    <Checkbox
                      register={{
                        name: 'provideSeparateBillingAddress',
                        checked: provideSeparateBillingAddress,
                        onChange: (event) =>
                          setProvideSeparateBillingAddress(
                            (event.target as HTMLInputElement).checked,
                          ),
                      }}
                      errors=""
                      label="Chcę podać inny adres do faktury"
                    />

                    {provideSeparateBillingAddress ? (
                      <>
                        <div className={styles.fieldGridTwoCompact}>
                          <Input
                            label="Kod pocztowy"
                            register={register(
                              'invoiceAddress.postalCode',
                              CHECKOUT_RULES.postalCode,
                            )}
                            errors={
                              errors.invoiceAddress?.postalCode?.message ?? ''
                            }
                            placeholder="00-000"
                          />
                          <Input
                            label="Miejscowość"
                            register={register(
                              'invoiceAddress.city',
                              CHECKOUT_RULES.city,
                            )}
                            errors={errors.invoiceAddress?.city?.message ?? ''}
                            placeholder="Warszawa"
                          />
                        </div>

                        <Input
                          label="Ulica"
                          register={register(
                            'invoiceAddress.streetName',
                            CHECKOUT_RULES.streetName,
                          )}
                          errors={
                            errors.invoiceAddress?.streetName?.message ?? ''
                          }
                          placeholder="Fakturowa"
                        />

                        <div className={styles.fieldGridTwoCompact}>
                          <Input
                            label="Numer domu"
                            register={register(
                              'invoiceAddress.buildingNumber',
                              CHECKOUT_RULES.buildingNumber,
                            )}
                            errors={
                              errors.invoiceAddress?.buildingNumber?.message ??
                              ''
                            }
                            placeholder="2"
                          />
                          <Input
                            label="Numer mieszkania (opcjonalnie)"
                            register={register(
                              'invoiceAddress.apartmentNumber',
                            )}
                            errors={
                              errors.invoiceAddress?.apartmentNumber?.message ??
                              ''
                            }
                            placeholder="10"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </CheckoutSection>

              <CheckoutSection title="Dane do dostawy">
                <div className={styles.fieldGridTwoCompact}>
                  <Input
                    label="Kod pocztowy"
                    register={register(
                      'shippingAddress.postalCode',
                      CHECKOUT_RULES.postalCode,
                    )}
                    errors={errors.shippingAddress?.postalCode?.message ?? ''}
                    placeholder="00-000"
                  />
                  <Input
                    label="Miejscowość"
                    register={register(
                      'shippingAddress.city',
                      CHECKOUT_RULES.city,
                    )}
                    errors={errors.shippingAddress?.city?.message ?? ''}
                    placeholder="Warszawa"
                  />
                </div>

                <Input
                  label="Ulica"
                  register={register(
                    'shippingAddress.streetName',
                    CHECKOUT_RULES.streetName,
                  )}
                  errors={errors.shippingAddress?.streetName?.message ?? ''}
                  placeholder="Testowa"
                />

                <div className={styles.fieldGridTwoCompact}>
                  <Input
                    label="Numer domu"
                    register={register(
                      'shippingAddress.buildingNumber',
                      CHECKOUT_RULES.buildingNumber,
                    )}
                    errors={
                      errors.shippingAddress?.buildingNumber?.message ?? ''
                    }
                    placeholder="1"
                  />
                  <Input
                    label="Numer mieszkania (opcjonalnie)"
                    register={register('shippingAddress.apartmentNumber')}
                    errors={
                      errors.shippingAddress?.apartmentNumber?.message ?? ''
                    }
                    placeholder="10"
                  />
                </div>

                <Checkbox
                  register={{
                    name: 'shippingRecipientDiffers',
                    checked: shippingRecipientDiffers,
                    onChange: (event) =>
                      setShippingRecipientDiffers(
                        (event.target as HTMLInputElement).checked,
                      ),
                  }}
                  errors=""
                  label="Chcę wysłać zamówienie na inne dane odbiorcy"
                />

                {shippingRecipientDiffers ? (
                  <>
                    <div className={styles.fieldGridTwo}>
                      <Input
                        label="Imię odbiorcy"
                        register={register(
                          'shippingAddress.firstName',
                          shippingRecipientDiffers
                            ? CHECKOUT_RULES.shippingRecipientFirstName
                            : {},
                        )}
                        errors={
                          errors.shippingAddress?.firstName?.message ?? ''
                        }
                        placeholder="Jan"
                      />
                      <Input
                        label="Nazwisko odbiorcy"
                        register={register(
                          'shippingAddress.lastName',
                          shippingRecipientDiffers
                            ? CHECKOUT_RULES.shippingRecipientLastName
                            : {},
                        )}
                        errors={errors.shippingAddress?.lastName?.message ?? ''}
                        placeholder="Kowalski"
                      />
                    </div>
                    <Input
                      label="Telefon odbiorcy"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      register={register(
                        'shippingAddress.phone',
                        shippingRecipientDiffers
                          ? CHECKOUT_RULES.shippingRecipientPhone
                          : {},
                      )}
                      errors={errors.shippingAddress?.phone?.message ?? ''}
                      placeholder="123 456 789"
                    />
                  </>
                ) : null}
              </CheckoutSection>

              <CheckoutSection title="Zgody i finalizacja">
                <div className={styles.consentsGroup}>
                  <Checkbox
                    register={{
                      name: 'selectAllConsents',
                      checked: acceptRequiredConsents && newsletterOptIn,
                      onChange: (event) => {
                        const checked = (event.target as HTMLInputElement)
                          .checked;
                        setValue('acceptRequiredConsents', checked, {
                          shouldDirty: true,
                        });
                        setValue('newsletterOptIn', checked, {
                          shouldDirty: true,
                        });
                      },
                    }}
                    errors=""
                    label="Zaznacz wszystkie"
                  />

                  <div className={styles.consentsNested}>
                    <Checkbox
                      register={register(
                        'acceptRequiredConsents',
                        CHECKOUT_RULES.acceptRequiredConsents,
                      )}
                      errors={errors.acceptRequiredConsents?.message ?? ''}
                      label={
                        <>
                          <span
                            aria-hidden="true"
                            className={styles.consentAsterisk}
                          >
                            *
                          </span>
                          Akceptuję{' '}
                          <Link
                            href="/regulamin/"
                            target="_blank"
                            className="link"
                          >
                            regulamin
                          </Link>{' '}
                          i{' '}
                          <Link
                            href="/polityka-prywatnosci/"
                            target="_blank"
                            className="link"
                          >
                            politykę prywatności
                          </Link>
                        </>
                      }
                    />

                    <Checkbox
                      register={register('newsletterOptIn')}
                      errors=""
                      label={
                        <>
                          Wyrażam zgodę na przetwarzanie moich danych osobowych
                          przez <strong>Audiofast</strong> w celu otrzymywania
                          informacji marketingowych dostosowanych do moich
                          preferencji.
                        </>
                      }
                    />
                  </div>

                  {sessionContext.isAuthenticated ? (
                    <Checkbox
                      register={register('saveToProfile')}
                      errors=""
                      label="Zapisz te dane do kolejnych zamówień"
                    />
                  ) : null}
                </div>

                <Error withIcon>{errors.root?.message ?? ''}</Error>
              </CheckoutSection>
            </form>
          </div>

          <aside className={styles.sidebar}>
            <CheckoutSummaryCard
              cart={cart as CartState}
              formId={CHECKOUT_FORM_ID}
              isSubmitting={isSubmitting}
            />
            <CartSupportCard supportCard={supportCard} />
          </aside>
        </div>

        {isCartBlockingOverlayOpen ? (
          <CheckoutBlockingOverlay blockingLines={blockingCartLines} />
        ) : null}
      </section>
    </main>
  );
}

function CheckoutBlockingOverlay({
  blockingLines,
}: {
  blockingLines: CartLine[];
}) {
  return (
    <div
      className={styles.blockingOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-blocking-heading"
    >
      <div className={styles.blockingOverlayCard}>
        <h2
          id="checkout-blocking-heading"
          className={styles.blockingOverlayHeading}
        >
          Koszyk wymaga aktualizacji
        </h2>
        <p className={styles.blockingOverlayDescription}>
          Niektóre produkty w Twoim koszyku nie są już dostępne do zakupu. Wróć
          do koszyka, aby zaktualizować zamówienie.
        </p>

        {blockingLines.length > 0 ? (
          <ul className={styles.blockingOverlayList}>
            {blockingLines.map((line) => {
              const blockingIssues = line.issues.filter(
                (issue) => issue.blocking,
              );
              return (
                <li
                  key={line.lineId}
                  className={styles.blockingOverlayListItem}
                >
                  <span className={styles.blockingOverlayProductName}>
                    {line.productName}
                  </span>
                  {blockingIssues.length > 0 ? (
                    <span className={styles.blockingOverlayIssue}>
                      {blockingIssues[0]?.message}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <Link href="/koszyk/" className={styles.blockingOverlayCta}>
          Wróć do koszyka
        </Link>
      </div>
    </div>
  );
}
