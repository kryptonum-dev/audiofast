import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { submitCheckout } from '@/src/app/actions/checkout-submit';
import Checkbox from '@/src/components/ui/Checkbox';
import Error from '@/src/components/ui/Error';
import Input from '@/src/components/ui/Input';
import type { CartContextValue } from '@/src/global/b2c/cart/cart-context';
import type { CartState } from '@/src/global/b2c/cart/types';
import {
  buildCheckoutFormValues,
  buildCheckoutSubmitInput,
  type CheckoutFormValues,
} from '@/src/global/b2c/checkout/form';
import { MOCK_P24_SCENARIO_OPTIONS } from '@/src/global/b2c/checkout/mock-payment-scenarios';
import type {
  CheckoutDraft,
  CheckoutSessionContext,
} from '@/src/global/b2c/checkout/types';

import {
  CHECKOUT_FORM_ID,
  SHOW_MOCK_PAYMENT_SCENARIO_SELECTOR,
} from './constants';
import {
  CHECKOUT_RULES,
  mapServerFieldErrors,
  withPostalCodeFormatting,
} from './helpers';
import styles from './styles.module.scss';

type CheckoutFormProps = {
  initialDraft: CheckoutDraft;
  isEmailLocked: boolean;
  sessionContext: CheckoutSessionContext;
  cart: CartState;
  applyCartLineRevalidation: CartContextValue['applyCartLineRevalidation'];
  onFeedbackChange: (feedback: { message: string } | null) => void;
  onPriceChangeNoticeChange: (visible: boolean) => void;
  onCartBlockingOverlayOpen: () => void;
  onSubmittingChange: (isSubmitting: boolean) => void;
};

export default function CheckoutForm({
  initialDraft,
  isEmailLocked,
  sessionContext,
  cart,
  applyCartLineRevalidation,
  onFeedbackChange,
  onPriceChangeNoticeChange,
  onCartBlockingOverlayOpen,
  onSubmittingChange,
}: CheckoutFormProps) {
  const router = useRouter();
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

  useEffect(() => {
    onSubmittingChange(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

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
    onFeedbackChange(null);
    onPriceChangeNoticeChange(false);

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
        onCartBlockingOverlayOpen();
        return;
      }

      if (result.error.code === 'cart_price_updated') {
        onPriceChangeNoticeChange(true);
        return;
      }

      mapServerFieldErrors(setError, result.error);
      onFeedbackChange({
        message: result.error.message,
      });
      return;
    }

    router.push(result.value.redirectUrl);
  };

  return (
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
            <Link href="/konto-klienta/" className={styles.loginHintLink}>
              <LoginHintIcon />
              <span>
                Masz już konto?{' '}
                <span className={styles.loginHintLinkAction}>Zaloguj się</span>
              </span>
            </Link>
          ) : null
        }
      >
        <div className={styles.fieldGridTwo}>
          <Input
            label="Imię"
            register={register('contact.firstName', CHECKOUT_RULES.firstName)}
            errors={errors.contact?.firstName?.message ?? ''}
            placeholder="Jan"
          />
          <Input
            label="Nazwisko"
            register={register('contact.lastName', CHECKOUT_RULES.lastName)}
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
            <span className={styles.radioLabel}>Firma/przedsiębiorca</span>
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
                    register={withPostalCodeFormatting(
                      register(
                        'invoiceAddress.postalCode',
                        CHECKOUT_RULES.postalCode,
                      ),
                    )}
                    errors={errors.invoiceAddress?.postalCode?.message ?? ''}
                    placeholder="00-000"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
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
                  errors={errors.invoiceAddress?.streetName?.message ?? ''}
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
                      errors.invoiceAddress?.buildingNumber?.message ?? ''
                    }
                    placeholder="2"
                  />
                  <Input
                    label="Numer mieszkania (opcjonalnie)"
                    register={register('invoiceAddress.apartmentNumber')}
                    errors={
                      errors.invoiceAddress?.apartmentNumber?.message ?? ''
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
            register={withPostalCodeFormatting(
              register('shippingAddress.postalCode', CHECKOUT_RULES.postalCode),
            )}
            errors={errors.shippingAddress?.postalCode?.message ?? ''}
            placeholder="00-000"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
          />
          <Input
            label="Miejscowość"
            register={register('shippingAddress.city', CHECKOUT_RULES.city)}
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
            errors={errors.shippingAddress?.buildingNumber?.message ?? ''}
            placeholder="1"
          />
          <Input
            label="Numer mieszkania (opcjonalnie)"
            register={register('shippingAddress.apartmentNumber')}
            errors={errors.shippingAddress?.apartmentNumber?.message ?? ''}
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
                errors={errors.shippingAddress?.firstName?.message ?? ''}
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
                const checked = (event.target as HTMLInputElement).checked;

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
                  <span aria-hidden="true" className={styles.consentAsterisk}>
                    *
                  </span>
                  Akceptuję{' '}
                  <Link href="/regulamin/" target="_blank" className="link">
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
                  Wyrażam zgodę na przetwarzanie moich danych osobowych przez{' '}
                  <strong>Audiofast</strong> w celu otrzymywania informacji
                  marketingowych dostosowanych do moich preferencji.
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

        {SHOW_MOCK_PAYMENT_SCENARIO_SELECTOR ? (
          <div className={styles.mockScenarioPanel}>
            <label
              className={styles.mockScenarioLabel}
              htmlFor="mock-payment-scenario"
            >
              Scenariusz płatności (mock, tylko dev)
            </label>
            <select
              id="mock-payment-scenario"
              className={styles.mockScenarioSelect}
              aria-describedby="mock-payment-scenario-help"
              {...register('mockPaymentScenarioId', {
                setValueAs: (value) => value || null,
              })}
            >
              <option value="">Domyślny scenariusz</option>
              {MOCK_P24_SCENARIO_OPTIONS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </option>
              ))}
            </select>
            <p
              id="mock-payment-scenario-help"
              className={styles.mockScenarioHelp}
            >
              Wersja deweloperska: wybrany scenariusz zostanie zamrożony po
              stronie serwera w momencie startu płatności.
            </p>
          </div>
        ) : null}

        <Error withIcon>{errors.root?.message ?? ''}</Error>
      </CheckoutSection>
    </form>
  );
}

function CheckoutSection({
  title,
  headerAction = null,
  children,
}: {
  title: string;
  headerAction?: ReactNode;
  children: ReactNode;
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
