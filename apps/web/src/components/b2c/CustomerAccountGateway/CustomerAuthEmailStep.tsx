'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { requestCustomerAuthOtpAction } from '@/src/app/actions/customer-auth-request-otp';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { REGEX } from '@/src/global/constants';

import styles from './styles.module.scss';

type CustomerAuthEmailFormData = {
  email: string;
};

type CustomerAuthEmailStepProps = {
  initialEmail: string;
  shouldAnimateOnEnter: boolean;
  onOtpRequested: (args: {
    normalizedEmail: string;
    resendAvailableInSeconds: number;
  }) => void;
};

export default function CustomerAuthEmailStep({
  initialEmail,
  shouldAnimateOnEnter,
  onOtpRequested,
}: CustomerAuthEmailStepProps) {
  const [isSubmitting, startSubmitting] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerAuthEmailFormData>({
    mode: 'onTouched',
    defaultValues: {
      email: initialEmail,
    },
  });

  const onSubmit = (data: CustomerAuthEmailFormData) => {
    setSubmitError(null);

    startSubmitting(async () => {
      try {
        const result = await requestCustomerAuthOtpAction(data.email);

        if (result.status === 'error') {
          setSubmitError(result.message);
          return;
        }

        onOtpRequested({
          normalizedEmail: result.normalizedEmail ?? data.email,
          resendAvailableInSeconds: result.resendAvailableInSeconds,
        });
      } catch {
        setSubmitError(
          'Nie udało się wysłać kodu logowania. Spróbuj ponownie za chwilę.',
        );
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`${styles.step}${shouldAnimateOnEnter ? ` ${styles.stepAnimated}` : ''}`}
      noValidate
      aria-label="Formularz logowania kodem jednorazowym"
    >
      <Input
        label="Adres e-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        disabled={isSubmitting}
        placeholder="np. jan@example.com"
        register={register('email', {
          required: {
            value: true,
            message: 'Adres e-mail jest wymagany.',
          },
          pattern: {
            value: REGEX.email,
            message: 'Podaj poprawny adres e-mail.',
          },
        })}
        errors={errors.email?.message ?? ''}
      />
      <Button
        type="submit"
        variant="primary"
        iconUsed="submit"
        isLoading={isSubmitting}
        disabled={isSubmitting}
        className={styles.submitButton}
      >
        {isSubmitting ? 'Wysyłamy kod…' : 'Wyślij kod logowania'}
      </Button>
      {submitError ? (
        <p className={styles.submitError} role="alert" aria-live="polite">
          {submitError}
        </p>
      ) : null}
      <p className={styles.footerNote}>
        Kod zadziała wyłącznie dla adresów powiązanych z istniejącymi
        zamówieniami w Audiofast.
      </p>
    </form>
  );
}
