'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import Button from '@/src/components/ui/Button';
import Checkbox from '@/src/components/ui/Checkbox';
import FormStates, { type FormState } from '@/src/components/ui/FormStates';
import Input from '@/src/components/ui/Input';
import { saveAnalyticsUser } from '@/src/global/analytics/analytics-user-storage';
import { trackEvent } from '@/src/global/analytics/track-event';
import { REGEX } from '@/src/global/constants';
import type { QueryFooterResult } from '@/src/global/sanity/sanity.types';

import styles from './styles.module.scss';

// Extract the formState type to handle the deeply nested nullable structure
type FormStateData = NonNullable<
  NonNullable<QueryFooterResult>['newsletter']
>['formState'];

type NewsletterFormData = {
  email: string;
  consent: boolean;
};

export default function NewsletterForm({
  buttonLabel = 'Zapisz się',
  formStateResult,
}: {
  buttonLabel?: string;
  formStateResult?: FormStateData;
}) {
  const [formState, setFormState] = useState<FormState>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterFormData>({
    mode: 'onTouched',
    defaultValues: {
      email: '',
      consent: false,
    },
  });

  const onSubmit = async (data: NewsletterFormData) => {
    setFormState('loading');

    try {
      // Track analytics before API call
      saveAnalyticsUser({
        email: data.email,
      });

      trackEvent({
        user: {
          email: data.email,
        },
        meta: {
          eventName: 'Lead',
          params: {
            content_name: 'newsletter_signup',
            form_location: 'footer',
          },
        },
        ga4: {
          eventName: 'generate_lead',
          params: {
            form_name: 'newsletter_signup',
            form_location: 'footer',
          },
        },
      });

      // Call newsletter API
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          consent: data.consent,
        }),
      });

      const result = await response.json();

      console.log(result);

      if (response.ok && result.success) {
        setFormState('success');
        reset();
      } else {
        setFormState('error');
      }
    } catch (error) {
      console.error('[Newsletter Form] Submission error:', error);
      setFormState('error');
    }
  };

  const handleRefresh = () => {
    setFormState('idle');
    reset();
  };

  const isDisabled = formState !== 'idle';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={styles.newsletterForm}
      noValidate
    >
      <Input
        label="Adres e-mail"
        mode="dark"
        name="email"
        disabled={isDisabled}
        register={register('email', {
          required: { value: true, message: 'E-mail jest wymagany' },
          pattern: {
            value: REGEX.email,
            message: 'Niepoprawny adres e-mail',
          },
        })}
        errors={errors}
      />

      <Checkbox
        mode="dark"
        disabled={isDisabled}
        label={
          <>
            Akceptuję{' '}
            <Link
              data-dark
              href="/polityka-prywatnosci"
              target="_blank"
              className="link"
              tabIndex={isDisabled ? -1 : 0}
            >
              politykę prywatności
            </Link>
          </>
        }
        register={register('consent', {
          required: {
            value: true,
            message: 'Zgoda jest wymagana',
          },
        })}
        errors={errors}
      />

      <Button
        type="submit"
        variant="secondary"
        className={styles.submitButton}
        disabled={isDisabled}
      >
        {buttonLabel}
      </Button>

      <FormStates
        formState={formState}
        formStateData={formStateResult}
        onRefresh={handleRefresh}
        mode="dark"
        className={styles.formStates}
      />
    </form>
  );
}
