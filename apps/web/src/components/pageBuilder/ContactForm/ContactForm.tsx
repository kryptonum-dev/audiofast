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
import { sendContactForm } from '@/src/global/email/send-contact';

import type { ContactFormProps } from '.';
import styles from './styles.module.scss';

type ContactFormComponentProps = Pick<ContactFormProps, 'formState'>;

type ContactFormData = {
  name: string;
  email: string;
  message: string;
  consent: boolean;
};

export default function ContactFormComponent({
  formState: formStateData,
}: ContactFormComponentProps) {
  const [formState, setFormState] = useState<FormState>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({ mode: 'onTouched' });

  const trackLead = (data: ContactFormData) => {
    const [firstName, ...rest] = data.name.trim().split(/\s+/);
    const lastName = rest.length ? rest.join(' ') : undefined;

    saveAnalyticsUser({
      email: data.email,
      name: data.name,
      first_name: firstName || undefined,
      last_name: lastName,
    });

    trackEvent({
      user: {
        email: data.email,
        name: data.name,
        first_name: firstName || undefined,
        last_name: lastName,
      },
      meta: {
        eventName: 'Lead',
        params: {
          content_name: 'contact_form',
          form_location: 'contact_section',
        },
      },
      ga4: {
        eventName: 'generate_lead',
        params: {
          form_name: 'contact_form',
          form_location: 'contact_section',
        },
      },
    });
  };

  const onSubmit = async (data: ContactFormData) => {
    setFormState('loading');

    try {
      trackLead(data);

      const result = await sendContactForm(data);

      if (result.success) {
        setFormState('success');
        reset();
      } else {
        setFormState('error');
      }
    } catch {
      setFormState('error');
    }
  };

  const handleRefresh = () => {
    setFormState('idle');
    reset();
  };

  const isDisabled = formState === 'loading';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <Input
        label="Imię i nazwisko"
        name="name"
        disabled={isDisabled}
        register={register('name', {
          required: {
            value: true,
            message: 'Imię i nazwisko jest wymagane',
          },
          minLength: {
            value: 2,
            message: 'Imię i nazwisko musi mieć co najmniej 2 znaki',
          },
        })}
        errors={errors.name?.message ?? ''}
      />

      <Input
        label="Adres e-mail"
        name="email"
        type="email"
        disabled={isDisabled}
        register={register('email', {
          required: { value: true, message: 'E-mail jest wymagany' },
          pattern: {
            value: REGEX.email,
            message: 'Niepoprawny adres e-mail',
          },
        })}
        errors={errors.email?.message ?? ''}
      />

      <Input
        label="Twoja wiadomość"
        name="message"
        textarea
        disabled={isDisabled}
        register={register('message', {
          required: {
            value: true,
            message: 'Wiadomość jest wymagana',
          },
          minLength: {
            value: 10,
            message: 'Wiadomość musi mieć co najmniej 10 znaków',
          },
        })}
        errors={errors.message?.message ?? ''}
      />

      <Checkbox
        disabled={isDisabled}
        label={
          <>
            Akceptuję{' '}
            <Link
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
        errors={errors.consent?.message ?? ''}
      />

      <Button
        type="submit"
        variant="primary"
        disabled={isDisabled}
        iconUsed="submit"
        className={styles.submitButton}
      >
        Wyślij wiadomość
      </Button>

      <FormStates
        formState={formState}
        formStateData={formStateData}
        onRefresh={handleRefresh}
        mode="light"
        className={styles.formStates}
      />
    </form>
  );
}
