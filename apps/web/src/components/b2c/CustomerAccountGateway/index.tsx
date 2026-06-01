'use client';

import { type ComponentProps, useState } from 'react';

import CustomerAuthEmailStep from '@/src/components/b2c/CustomerAccountGateway/CustomerAuthEmailStep';
import CustomerAuthOtpStep from '@/src/components/b2c/CustomerAccountGateway/CustomerAuthOtpStep';

import styles from './styles.module.scss';

type CustomerAccountGatewayState =
  | {
      stepId: 'email-entry';
      lastSubmittedEmail: string;
    }
  | {
      stepId: 'otp-entry';
      email: string;
      resendAvailableInSeconds: number;
    };

type CustomerAccountGatewayProps = {
  returnTo: string;
};

export default function CustomerAccountGateway({
  returnTo,
}: CustomerAccountGatewayProps) {
  const [gatewayState, setGatewayState] = useState<CustomerAccountGatewayState>(
    {
      stepId: 'email-entry',
      lastSubmittedEmail: '',
    },
  );
  const [shouldAnimateStepEntry, setShouldAnimateStepEntry] = useState(false);

  const heading = 'Logowanie do konta';
  const description =
    gatewayState.stepId === 'email-entry' ? (
      <>
        Podaj adres e-mail użyty przy zamówieniu. Wyślemy na niego kod
        logowania.
      </>
    ) : (
      <>
        Wpisz sześciocyfrowy kod wysłany na adres{' '}
        <strong>{gatewayState.email}</strong>.
      </>
    );

  return (
    <section
      className={styles.gateway}
      aria-label="Logowanie do konta klienta Audiofast"
    >
      <div className={styles.card} data-step={gatewayState.stepId}>
        <div className={styles.header}>
          <span className={styles.iconBadge} aria-hidden="true">
            <CustomerAccountIcon />
          </span>
          <h1 className={styles.heading}>{heading}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        {gatewayState.stepId === 'email-entry' ? (
          <CustomerAuthEmailStep
            initialEmail={gatewayState.lastSubmittedEmail}
            shouldAnimateOnEnter={shouldAnimateStepEntry}
            onOtpRequested={({ normalizedEmail, resendAvailableInSeconds }) => {
              setShouldAnimateStepEntry(true);
              setGatewayState({
                stepId: 'otp-entry',
                email: normalizedEmail,
                resendAvailableInSeconds,
              });
            }}
          />
        ) : gatewayState.stepId === 'otp-entry' ? (
          <CustomerAuthOtpStep
            email={gatewayState.email}
            resendAvailableInSeconds={gatewayState.resendAvailableInSeconds}
            returnTo={returnTo}
            shouldAnimateOnEnter={shouldAnimateStepEntry}
            onResendAccepted={(nextResendAvailableInSeconds) => {
              setGatewayState({
                stepId: 'otp-entry',
                email: gatewayState.email,
                resendAvailableInSeconds: nextResendAvailableInSeconds,
              });
            }}
            onResetToEmailStep={() => {
              setShouldAnimateStepEntry(true);
              setGatewayState({
                stepId: 'email-entry',
                lastSubmittedEmail: gatewayState.email,
              });
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function CustomerAccountIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        clipPath="url(#customer-account-icon)"
      >
        <path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h1.5M15 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0M20.203 20.2l1.8 1.8" />
      </g>
      <defs>
        <clipPath id="customer-account-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}
