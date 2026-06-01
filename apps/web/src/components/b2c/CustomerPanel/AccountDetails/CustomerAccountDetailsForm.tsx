'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import {
  updateCustomerAccountProfileAction,
  type UpdateCustomerAccountProfileActionResult,
} from '@/src/app/actions/customer-account-profile';
import Button from '@/src/components/ui/Button';
import Checkbox from '@/src/components/ui/Checkbox';
import Error from '@/src/components/ui/Error';
import Input from '@/src/components/ui/Input';
import type { CheckoutAddress } from '@/src/global/b2c/checkout/types';
import type { CheckoutInvoiceAddressErrors } from '@/src/global/b2c/checkout/validation';
import {
  buildCustomerAccountProfileFormValues,
  buildCustomerAccountProfileSubmitInput,
  type CustomerAccountProfileFormValues,
} from '@/src/global/b2c/customer-auth/account-profile-form';
import type { CustomerAccountProfile } from '@/src/global/b2c/customer-auth/server/customer-account-profile';

import {
  CHECKOUT_RULES,
  withPostalCodeFormatting,
} from '../../CheckoutPage/helpers';
import styles from './styles.module.scss';

type CustomerAccountDetailsFormProps = {
  profile: CustomerAccountProfile;
};

function getActionErrorMessage(
  result: Extract<UpdateCustomerAccountProfileActionResult, { ok: false }>,
): string {
  switch (result.error.kind) {
    case 'validation_error':
      return (
        result.error.errors.formErrors[0] ??
        'Nie udało się zapisać danych konta, ponieważ formularz zawiera błędy.'
      );
    case 'not_found':
      return 'Nie możemy odnaleźć profilu klienta dla zalogowanego adresu e-mail.';
    case 'ownership_mismatch':
      return 'Nie możemy zapisać danych, ponieważ profil nie należy do tej sesji.';
    case 'unauthenticated':
      return 'Sesja wygasła. Zaloguj się ponownie, aby zapisać dane konta.';
    case 'unexpected_error':
    default:
      return 'Nie udało się zapisać danych konta. Spróbuj ponownie za chwilę.';
  }
}

function mapServerFieldErrors(
  setError: ReturnType<
    typeof useForm<CustomerAccountProfileFormValues>
  >['setError'],
  result: Extract<UpdateCustomerAccountProfileActionResult, { ok: false }>,
) {
  if (result.error.kind !== 'validation_error') {
    return;
  }

  const fieldErrors = result.error.errors;

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

  mapInvoiceAddressErrors(setError, fieldErrors.invoice?.invoiceAddress);
}

function mapInvoiceAddressErrors(
  setError: ReturnType<
    typeof useForm<CustomerAccountProfileFormValues>
  >['setError'],
  invoiceAddressErrors: CheckoutInvoiceAddressErrors | undefined,
) {
  if (!invoiceAddressErrors) {
    return;
  }

  (Object.keys(invoiceAddressErrors) as Array<keyof CheckoutAddress>).forEach(
    (fieldName) => {
      const message = invoiceAddressErrors[fieldName];

      if (!message) {
        return;
      }

      setError(`invoiceAddress.${fieldName}` as const, {
        type: 'server',
        message,
      });
    },
  );
}

export default function CustomerAccountDetailsForm({
  profile,
}: CustomerAccountDetailsFormProps) {
  const router = useRouter();
  const baseFormValues = useMemo(
    () => buildCustomerAccountProfileFormValues(profile),
    [profile],
  );
  const [provideSeparateBillingAddress, setProvideSeparateBillingAddress] =
    useState(baseFormValues.provideSeparateBillingAddress);
  const [shippingRecipientDiffers, setShippingRecipientDiffers] = useState(
    baseFormValues.shippingRecipientDiffers,
  );
  const {
    clearErrors,
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm<CustomerAccountProfileFormValues>({
    defaultValues: baseFormValues,
    mode: 'onTouched',
  });
  const buyerType = useWatch({ control, name: 'buyerType' });
  const isCompanyInvoice = buyerType === 'company';
  const rootError = errors.root?.message;
  const buyerTypeRegister = register('buyerType');

  const handleBuyerTypeChange = (nextBuyerType: 'private' | 'company') => {
    setValue('buyerType', nextBuyerType, {
      shouldDirty: true,
      shouldTouch: true,
    });

    if (nextBuyerType !== 'company') {
      setValue('invoiceCompanyName', '', { shouldDirty: true });
      setValue('invoiceTaxId', '', { shouldDirty: true });
    }
  };

  const onSubmit = async (values: CustomerAccountProfileFormValues) => {
    clearErrors();

    const result = await updateCustomerAccountProfileAction(
      buildCustomerAccountProfileSubmitInput({
        ...values,
        provideSeparateBillingAddress,
        shippingRecipientDiffers,
      }),
    );

    if (!result.ok) {
      mapServerFieldErrors(setError, result);
      const message = getActionErrorMessage(result);

      setError('root', {
        type: 'server',
        message,
      });
      toast.error(message);
      return;
    }

    const nextValues = buildCustomerAccountProfileFormValues(
      result.value.profile,
    );

    reset(nextValues);
    setProvideSeparateBillingAddress(nextValues.provideSeparateBillingAddress);
    setShippingRecipientDiffers(nextValues.shippingRecipientDiffers);
    toast.success('Dane konta zostały zapisane.');
    router.refresh();
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Formularz danych konta"
    >
      <AccountDetailsSection
        title="Kontakt"
        description="Te dane wykorzystamy jako domyślne informacje kontaktowe przy kolejnych zamówieniach."
      >
        <div className={styles.fieldGridTwo}>
          <Input
            label="Imię"
            register={register('contact.firstName', CHECKOUT_RULES.firstName)}
            errors={errors.contact?.firstName?.message ?? ''}
            placeholder="Imię"
            autoComplete="given-name"
            disabled={isSubmitting}
          />
          <Input
            label="Nazwisko"
            register={register('contact.lastName', CHECKOUT_RULES.lastName)}
            errors={errors.contact?.lastName?.message ?? ''}
            placeholder="Nazwisko"
            autoComplete="family-name"
            disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
          <div className={styles.lockedField}>
            <input
              type="hidden"
              {...register('contact.email', CHECKOUT_RULES.email)}
            />
            <label className={styles.disabledEmailField}>
              <span>Adres e-mail</span>
              <input
                type="email"
                value={profile.email}
                disabled
                aria-describedby="customer-account-email-note"
              />
            </label>
            <p id="customer-account-email-note">
              Adres e-mail jest kluczem dostępu do panelu i nie może być
              zmieniony samodzielnie.
            </p>
          </div>
        </div>
      </AccountDetailsSection>

      <AccountDetailsSection
        title="Adres dostawy"
        description="Ten adres podpowiemy w formularzu kolejnego zakupu. Dane zapisane przy wcześniejszych zamówieniach pozostają bez zmian."
      >
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
            disabled={isSubmitting}
          />
          <Input
            label="Miejscowość"
            register={register('shippingAddress.city', CHECKOUT_RULES.city)}
            errors={errors.shippingAddress?.city?.message ?? ''}
            placeholder="Warszawa"
            autoComplete="address-level2"
            disabled={isSubmitting}
          />
        </div>

        <Input
          label="Ulica"
          register={register(
            'shippingAddress.streetName',
            CHECKOUT_RULES.streetName,
          )}
          errors={errors.shippingAddress?.streetName?.message ?? ''}
          placeholder="Nazwa ulicy"
          autoComplete="address-line1"
          disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
          <Input
            label="Numer mieszkania (opcjonalnie)"
            register={register('shippingAddress.apartmentNumber')}
            errors={errors.shippingAddress?.apartmentNumber?.message ?? ''}
            placeholder="10"
            disabled={isSubmitting}
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
          disabled={isSubmitting}
          label="Chcę zapisać inne dane odbiorcy dla dostawy"
        />

        {shippingRecipientDiffers ? (
          <div className={styles.nestedFields}>
            <div className={styles.fieldGridTwo}>
              <Input
                label="Imię odbiorcy"
                register={register(
                  'shippingAddress.firstName',
                  CHECKOUT_RULES.shippingRecipientFirstName,
                )}
                errors={errors.shippingAddress?.firstName?.message ?? ''}
                placeholder="Imię odbiorcy"
                disabled={isSubmitting}
              />
              <Input
                label="Nazwisko odbiorcy"
                register={register(
                  'shippingAddress.lastName',
                  CHECKOUT_RULES.shippingRecipientLastName,
                )}
                errors={errors.shippingAddress?.lastName?.message ?? ''}
                placeholder="Nazwisko odbiorcy"
                disabled={isSubmitting}
              />
            </div>
            <Input
              label="Telefon odbiorcy"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              register={register(
                'shippingAddress.phone',
                CHECKOUT_RULES.shippingRecipientPhone,
              )}
              errors={errors.shippingAddress?.phone?.message ?? ''}
              placeholder="123 456 789"
              disabled={isSubmitting}
            />
          </div>
        ) : null}
      </AccountDetailsSection>

      <AccountDetailsSection
        title="Dane firmowe"
        description="Jeśli zwykle kupujesz jako firma, zapisz dane firmy, aby nie wpisywać ich ponownie."
      >
        <div className={styles.radioGroup} role="radiogroup">
          <label className={styles.radioOption}>
            <input
              {...buyerTypeRegister}
              className={styles.radioInput}
              type="radio"
              value="private"
              checked={buyerType === 'private'}
              onChange={() => handleBuyerTypeChange('private')}
              disabled={isSubmitting}
            />
            <span className={styles.radioLabel}>Osoba fizyczna</span>
          </label>

          <label className={styles.radioOption}>
            <input
              {...buyerTypeRegister}
              className={styles.radioInput}
              type="radio"
              value="company"
              checked={buyerType === 'company'}
              onChange={() => handleBuyerTypeChange('company')}
              disabled={isSubmitting}
            />
            <span className={styles.radioLabel}>Firma</span>
          </label>
        </div>

        {isCompanyInvoice ? (
          <div className={styles.nestedFields}>
            <div className={styles.fieldGridTwo}>
              <Input
                label="Nazwa firmy"
                register={register(
                  'invoiceCompanyName',
                  CHECKOUT_RULES.companyName,
                )}
                errors={errors.invoiceCompanyName?.message ?? ''}
                placeholder="Nazwa firmy"
                disabled={isSubmitting}
              />
              <Input
                label="NIP"
                register={register('invoiceTaxId', CHECKOUT_RULES.taxId)}
                errors={errors.invoiceTaxId?.message ?? ''}
                placeholder="1234567890"
                inputMode="numeric"
                disabled={isSubmitting}
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
              disabled={isSubmitting}
              label="Chcę zapisać inny adres firmowy"
            />

            {provideSeparateBillingAddress ? (
              <div className={styles.nestedFields}>
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
                    disabled={isSubmitting}
                  />
                  <Input
                    label="Miejscowość"
                    register={register(
                      'invoiceAddress.city',
                      CHECKOUT_RULES.city,
                    )}
                    errors={errors.invoiceAddress?.city?.message ?? ''}
                    placeholder="Warszawa"
                    disabled={isSubmitting}
                  />
                </div>

                <Input
                  label="Ulica"
                  register={register(
                    'invoiceAddress.streetName',
                    CHECKOUT_RULES.streetName,
                  )}
                  errors={errors.invoiceAddress?.streetName?.message ?? ''}
                  placeholder="Nazwa ulicy"
                  disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  />
                  <Input
                    label="Numer lokalu (opcjonalnie)"
                    register={register('invoiceAddress.apartmentNumber')}
                    errors={
                      errors.invoiceAddress?.apartmentNumber?.message ?? ''
                    }
                    placeholder="10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </AccountDetailsSection>

      <div className={styles.formFooter}>
        <div className={styles.footerCopy}>
          <strong>Zmiany działają tylko na przyszłe zamówienia.</strong>
          <span>
            Historia zamówień nadal pokazuje dane zapisane w chwili zakupu.
          </span>
        </div>
        <Button
          type="submit"
          variant="secondary"
          iconUsed="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className={styles.submitButton}
        >
          Zapisz dane konta
        </Button>
      </div>

      <Error withIcon>{rootError ?? ''}</Error>
    </form>
  );
}

function AccountDetailsSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className={styles.sectionCard}>
      <header className={styles.sectionHeader}>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}
