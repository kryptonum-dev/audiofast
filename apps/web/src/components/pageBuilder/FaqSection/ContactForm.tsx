'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import PortableText from '@/src/components/portableText';
import Button from '@/src/components/ui/Button';
import Checkbox from '@/src/components/ui/Checkbox';
import type { FormStateData as FormStateDataProps } from '@/src/components/ui/FormStates';
import FormStates, { type FormState } from '@/src/components/ui/FormStates';
import Input from '@/src/components/ui/Input';
import { saveAnalyticsUser } from '@/src/global/analytics/analytics-user-storage';
import { trackEvent } from '@/src/global/analytics/track-event';
import { REGEX } from '@/src/global/constants';
import { sendContactForm } from '@/src/global/resend/send-contact';
import type { PagebuilderType } from '@/src/global/types';

import styles from './styles.module.scss';

type ContactFormData = {
  message: string;
  email: string;
  name: string;
  consent: boolean;
};

type FormStep = 1 | 2;

export default function ContactForm({
  contactForm,
  index,
  isContactOnly = false,
}: {
  contactForm: PagebuilderType<'faqSection'>['contactForm'];
  index: number;
  isContactOnly?: boolean;
}) {
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [formState, setFormState] = useState<FormState>('idle');
  const formRef = useRef<HTMLFormElement>(null);
  const previousStepRef = useRef<FormStep>(1);

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    setFocus,
    formState: { errors },
  } = useForm<ContactFormData>({ mode: 'onTouched' });

  // Focus management when step changes
  useEffect(() => {
    // Moving from step 1 to step 2 - focus email input
    if (currentStep === 2 && previousStepRef.current === 1) {
      setFocus('email');
    }
    // Going back from step 2 to step 1 - focus textarea
    else if (currentStep === 1 && previousStepRef.current === 2) {
      setFocus('message');
    }

    previousStepRef.current = currentStep;
  }, [currentStep, setFocus]);

  const goBackToStep1 = () => {
    setCurrentStep(1);
  };

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
          content_name: 'faq_contact_form',
          form_location: isContactOnly ? 'contact_page' : 'faq_section',
        },
      },
      ga4: {
        eventName: 'generate_lead',
        params: {
          form_name: 'faq_contact_form',
          form_location: isContactOnly ? 'contact_page' : 'faq_section',
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
        setCurrentStep(1);
        reset();
      } else {
        setFormState('error');
      }
    } catch {
      setFormState('error');
    }
  };

  const handleRefresh = () => {
    const previousFormState = formState;
    setFormState('idle');

    if (previousFormState === 'success') {
      // Go back to step 1 for new message
      setCurrentStep(1);
      reset();

      // Focus textarea after refresh from success
      setTimeout(() => {
        setFocus('message');
      }, 50);
    } else if (previousFormState === 'error') {
      // For error state, stay on current step and focus appropriate input
      setTimeout(() => {
        if (currentStep === 1) {
          setFocus('message');
        } else {
          setFocus('email');
        }
      }, 50);
    }
  };

  const isDisabled = formState === 'loading';

  const handleStep1Submit = async () => {
    // Trigger validation for the message field
    const isValid = await trigger('message');
    if (isValid) {
      setCurrentStep(2);
    }
  };

  return (
    <div className={styles.formContainer}>
      <PortableText
        value={contactForm!.heading}
        className={styles.formHeading}
        headingLevel={isContactOnly ? (index === 0 ? 'h1' : 'h2') : 'h3'}
      />
      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        data-step={currentStep}
      >
        {/* Step 1 - Message */}
        <Input
          label=""
          textarea
          disabled={isDisabled}
          placeholder="Treść wiadomości"
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
          errors={errors}
          className={styles.messageInput}
        />

        {/* Step 2 - Contact Details */}
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
          errors={errors}
        />

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
          errors={errors}
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
          errors={errors}
        />
        <Button
          type="button"
          onClick={handleStep1Submit}
          variant="primary"
          disabled={isDisabled}
          className={styles.nextButton}
        >
          Przejdź dalej
        </Button>
        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={goBackToStep1}
            disabled={isDisabled}
            className={styles.backButton}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
            >
              <g stroke="#000">
                <path d="M5 12h14M5 12l6 6M5 12l6-6" />
              </g>
            </svg>
            Wstecz
          </button>
          <Button
            type="submit"
            variant="primary"
            disabled={isDisabled}
            className={styles.submitButton}
          >
            {contactForm!.buttonText}
          </Button>
        </div>

        <FormStates
          formState={formState}
          formStateData={contactForm?.formState as FormStateDataProps}
          onRefresh={handleRefresh}
          mode="light"
          className={styles.formStates}
        />
      </form>
    </div>
  );
}
