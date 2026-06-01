'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { requestCustomerAuthOtpAction } from '@/src/app/actions/customer-auth-request-otp';
import { verifyCustomerAuthOtpAction } from '@/src/app/actions/customer-auth-verify-otp';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';

import styles from './styles.module.scss';

const OTP_CODE_LENGTH = 6;
const OTP_CODE_PATTERN = /^\d{6}$/;

type CustomerAuthOtpFormData = {
  code: string;
};

type CustomerAuthOtpResendTone = 'success' | 'error' | 'neutral';

type CustomerAuthOtpStepProps = {
  email: string;
  resendAvailableInSeconds: number;
  returnTo: string;
  shouldAnimateOnEnter: boolean;
  onResetToEmailStep: () => void;
  onResendAccepted: (resendAvailableInSeconds: number) => void;
};

export default function CustomerAuthOtpStep({
  email,
  resendAvailableInSeconds,
  returnTo,
  shouldAnimateOnEnter,
  onResetToEmailStep,
  onResendAccepted,
}: CustomerAuthOtpStepProps) {
  const router = useRouter();
  const [isVerifying, startVerify] = useTransition();
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isResending, startResend] = useTransition();
  const [resendSecondsLeft, setResendSecondsLeft] = useState(
    resendAvailableInSeconds,
  );
  const [resendMessage, setResendMessage] = useState<{
    text: string;
    tone: CustomerAuthOtpResendTone;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<CustomerAuthOtpFormData>({
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      code: '',
    },
  });

  useEffect(() => {
    setFocus('code');
  }, [setFocus]);

  useEffect(() => {
    if (resendSecondsLeft <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setResendSecondsLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [resendSecondsLeft]);

  const onSubmit = (data: CustomerAuthOtpFormData) => {
    setVerifyError(null);

    startVerify(async () => {
      try {
        const result = await verifyCustomerAuthOtpAction({
          email,
          code: data.code,
        });

        if (result.status === 'verified') {
          router.refresh();
          router.replace(returnTo);
          return;
        }

        setVerifyError(result.message);
      } catch {
        setVerifyError(
          'Nie udało się potwierdzić kodu logowania. Spróbuj ponownie.',
        );
      }
    });
  };

  const handleResend = () => {
    if (resendSecondsLeft > 0 || isResending || isVerifying) {
      return;
    }

    setResendMessage(null);

    startResend(async () => {
      try {
        const result = await requestCustomerAuthOtpAction(email);

        if (result.status === 'error') {
          setResendMessage({
            text: result.message,
            tone: 'error',
          });
          return;
        }

        setResendSecondsLeft(result.resendAvailableInSeconds);
        onResendAccepted(result.resendAvailableInSeconds);
        setResendMessage({
          text: 'Wysłaliśmy nowy kod logowania.',
          tone: 'success',
        });
      } catch {
        setResendMessage({
          text: 'Nie udało się wysłać kodu logowania. Spróbuj ponownie za chwilę.',
          tone: 'error',
        });
      }
    });
  };

  const isBusy = isVerifying || isResending;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`${styles.step}${shouldAnimateOnEnter ? ` ${styles.stepAnimated}` : ''}`}
      noValidate
      aria-label="Formularz weryfikacji kodu jednorazowego"
    >
      <Input
        label="Kod jednorazowy"
        type="text"
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={OTP_CODE_LENGTH}
        disabled={isBusy}
        placeholder="np. 123456"
        register={register('code', {
          required: {
            value: true,
            message: 'Wpisz otrzymany kod logowania.',
          },
          pattern: {
            value: OTP_CODE_PATTERN,
            message: 'Kod powinien składać się z sześciu cyfr.',
          },
        })}
        errors={errors.code?.message ?? ''}
      />
      <Button
        type="submit"
        variant="primary"
        iconUsed="arrowRight"
        isLoading={isVerifying}
        disabled={isBusy}
        className={styles.submitButton}
      >
        {isVerifying ? 'Weryfikujemy kod…' : 'Zaloguj się'}
      </Button>
      {verifyError ? (
        <p className={styles.submitError} role="alert" aria-live="polite">
          {verifyError}
        </p>
      ) : null}
      <div className={styles.otpFooter}>
        <button
          type="button"
          onClick={handleResend}
          disabled={isBusy || resendSecondsLeft > 0}
          className={styles.linkButton}
        >
          {resendSecondsLeft > 0
            ? `Wyślij ponownie za ${resendSecondsLeft}s`
            : 'Wyślij kod ponownie'}
        </button>
        <span aria-hidden="true" className={styles.otpFooterDivider}>
          •
        </span>
        <button
          type="button"
          onClick={onResetToEmailStep}
          disabled={isBusy}
          className={styles.linkButton}
        >
          Zmień adres e-mail
        </button>
      </div>
      {resendMessage ? (
        <p
          className={styles.resendMessage}
          data-tone={resendMessage.tone}
          role="status"
          aria-live="polite"
        >
          {resendMessage.text}
        </p>
      ) : null}
    </form>
  );
}
