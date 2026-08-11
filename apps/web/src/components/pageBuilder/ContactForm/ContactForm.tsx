'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
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
  /** Honeypot - see the note on the off-screen input below */
  ref2: string;
};

export default function ContactFormComponent({
  formState: formStateData,
}: ContactFormComponentProps) {
  const [formState, setFormState] = useState<FormState>('idle');
  // Timestamp of the first render - used to reject submits that are too fast to be human
  const renderedAt = useRef(Date.now());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    mode: 'onTouched',
    defaultValues: { ref2: '' },
  });

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

      const result = await sendContactForm({
        ...data,
        elapsedMs: Date.now() - renderedAt.current,
      });

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

      {/*
        Honeypot. Moved off-screen on purpose instead of `display: none` /
        `hidden` - spam bots that drive a real browser evaluate CSS and skip
        fields that are not rendered, but they do fill fields that are merely
        pushed outside the viewport. Never visible or reachable for humans.

        The field name is meaningless on purpose: it was `companyWebsite` until
        2026-08-03, and Chrome/Edge classified it as a company-name field and
        autofilled it for real users - three blocked leads on the sister project.
        A trip here rejects the submission unless BotID positively vouches for
        a human - see the honeypot rule in /api/contact.
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('ref2')}
        />
      </div>

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
