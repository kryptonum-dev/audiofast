'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import Button from '@/src/components/ui/Button';
import Checkbox from '@/src/components/ui/Checkbox';
import FormStates, { type FormState } from '@/src/components/ui/FormStates';
import Input from '@/src/components/ui/Input';
import { REGEX } from '@/src/global/constants';
import type { QueryFooterResult } from '@/src/global/sanity/sanity.types';

import styles from './styles.module.scss';

// Extract the formState type to handle the deeply nested nullable structure
type FormStateData = NonNullable<
  NonNullable<QueryFooterResult>['newsletter']
>['formState'];

export default function NewsletterForm({
  buttonLabel = 'Zapisz się',
  formStateResult,
}: {
  buttonLabel?: string;
  formStateResult?: FormStateData;
}) {
  console.log(formStateResult);
  const [formState, setFormState] = useState<FormState>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ mode: 'onTouched' });

  const onSubmit = async () => {
    setFormState('loading');

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // For demo purposes
      const success = true;

      if (success) {
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

  const isDisabled = formState !== 'idle';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.newsletterForm}>
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
