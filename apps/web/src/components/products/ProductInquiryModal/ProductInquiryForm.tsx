'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import Button from '@/src/components/ui/Button';
import Checkbox from '@/src/components/ui/Checkbox';
import FormStates, { type FormState, type FormStateData } from '@/src/components/ui/FormStates';
import Input from '@/src/components/ui/Input';
import { saveAnalyticsUser } from '@/src/global/analytics/analytics-user-storage';
import { trackEvent } from '@/src/global/analytics/track-event';
import { REGEX } from '@/src/global/constants';
import { sendContactForm } from '@/src/global/email/send-contact';

import type { ProductContext } from '.';
import styles from './styles.module.scss';

interface ProductInquiryFormProps {
  product: ProductContext;
  onFormDirtyChange: (isDirty: boolean) => void;
  formStateData?: FormStateData | null;
}

// Helper to create portable text block from plain string
const toPortableText = (text: string) => [
  {
    _type: 'block' as const,
    _key: Math.random().toString(36).slice(2),
    children: [{ _type: 'span' as const, _key: 'span', text }],
    markDefs: null,
  },
];

// Default form state data for success/error messages
const defaultFormStateData: FormStateData = {
  success: {
    withIcon: true,
    heading: toPortableText('Dziękujemy za zapytanie!'),
    paragraph: toPortableText('Twoja wiadomość została wysłana. Skontaktujemy się z Tobą wkrótce.'),
    refreshButton: false,
    refreshButtonText: null,
  },
  error: {
    withIcon: true,
    heading: toPortableText('Wystąpił błąd'),
    paragraph: toPortableText('Nie udało się wysłać wiadomości. Spróbuj ponownie później.'),
    refreshButton: true,
    refreshButtonText: 'Spróbuj ponownie',
  },
};

type FormData = {
  name: string;
  email: string;
  message: string;
  consent: boolean;
};

export default function ProductInquiryForm({
  product,
  onFormDirtyChange,
  formStateData: externalFormStateData,
}: ProductInquiryFormProps) {
  // Use external form state data if available, otherwise fall back to defaults
  const formStateData = externalFormStateData ?? defaultFormStateData;
  const [formState, setFormState] = useState<FormState>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({ 
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      message: '',
      consent: false,
    },
  });

  // Notify parent when form becomes dirty (user has modified any field)
  useEffect(() => {
    onFormDirtyChange(isDirty);
  }, [isDirty, onFormDirtyChange]);

  const trackLead = (data: FormData) => {
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
          content_name: 'product_inquiry_form',
          form_location: 'product_modal',
          product_id: product.id,
          product_name: product.name,
          product_brand: product.brandName,
        },
      },
      ga4: {
        eventName: 'generate_lead',
        params: {
          form_name: 'product_inquiry_form',
          form_location: 'product_modal',
          item_id: product.id,
          item_name: product.name,
          item_brand: product.brandName,
        },
      },
    });
  };

  const onSubmit = async (data: FormData) => {
    setFormState('loading');

    try {
      trackLead(data);

      const result = await sendContactForm({
        name: data.name,
        email: data.email,
        message: data.message,
        consent: data.consent,
        product: {
          name: product.name,
          brandName: product.brandName,
          configuration: product.configurationOptions.map((opt) => ({
            label: opt.label,
            value: opt.value,
            priceDelta: opt.priceDelta,
          })),
          basePrice: product.basePrice,
          totalPrice: product.totalPrice,
        },
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

      <Button
        type="submit"
        variant="primary"
        disabled={isDisabled}
        iconUsed="submit"
        className={styles.submitButton}
      >
        Wyślij zapytanie
      </Button>

      <FormStates
        formState={formState}
        formStateData={formStateData}
        onRefresh={handleRefresh}
        mode="light"
      />
    </form>
  );
}
