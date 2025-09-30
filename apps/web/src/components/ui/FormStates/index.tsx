import { useMemo } from 'react';

import PortableText from '@/src/components/shared/PortableText';
import Button from '@/src/components/ui/Button';
import type { QueryFooterResult } from '@/src/global/sanity/sanity.types';
import type { PortableTextValue } from '@/src/global/types';

import styles from './styles.module.scss';

type FormState = 'idle' | 'loading' | 'success' | 'error';

// Extract the formState type to handle the deeply nested nullable structure
type FormStateData = NonNullable<
  NonNullable<QueryFooterResult>['newsletter']
>['formState'];

interface FormStatesProps {
  formState: FormState;
  formStateData?: FormStateData;
  onRefresh?: () => void;
  mode?: 'light' | 'dark';
  className?: string;
}

interface StateContentProps {
  withIcon?: boolean;
  heading?: PortableTextValue | null;
  paragraph?: PortableTextValue | null;
  refreshButton?: boolean;
  refreshButtonText?: string;
  onRefresh?: () => void;
  mode?: 'light' | 'dark';
}

// Loading Component
const LoadingState = ({ mode = 'light' }: { mode?: 'light' | 'dark' }) => (
  <div className={styles.loading} data-mode={mode}>
    <div className={styles.loadingSpinner}>
      <div className={styles.spinner}>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerRing}></div>
      </div>
    </div>
  </div>
);

// Success State Component
const SuccessState = ({
  withIcon = true,
  heading,
  paragraph,
  refreshButton = false,
  refreshButtonText,
  onRefresh,
  mode = 'light',
}: StateContentProps) => (
  <div className={styles.success} data-mode={mode}>
    <div className={styles.wrapper}>
      {withIcon && <SuccessIcon />}
      <PortableText className={styles.heading} value={heading} />
      <PortableText className={styles.paragraph} value={paragraph} />
      {refreshButton && (
        <Button
          type="button"
          variant="primary"
          iconUsed="refresh"
          onClick={onRefresh}
          className={styles.refreshButton}
        >
          {refreshButtonText}
        </Button>
      )}
    </div>
  </div>
);

// Error State Component
const ErrorState = ({
  withIcon = true,
  heading,
  paragraph,
  refreshButton = true,
  refreshButtonText = 'Try again',
  onRefresh,
  mode = 'light',
}: StateContentProps) => (
  <div className={styles.error} data-mode={mode}>
    <div className={styles.wrapper}>
      {withIcon && <ErrorIcon />}
      <PortableText value={heading} className={styles.heading} />
      <PortableText value={paragraph} className={styles.paragraph} />
      {refreshButton && (
        <Button
          type="button"
          variant="secondary"
          iconUsed="refresh"
          onClick={onRefresh}
          className={styles.refreshButton}
        >
          {refreshButtonText}
        </Button>
      )}
    </div>
  </div>
);

export default function FormStates({
  formState,
  formStateData,
  onRefresh,
  mode = 'light',
  className,
}: FormStatesProps) {
  const currentStateContent = useMemo(() => {
    switch (formState) {
      case 'loading':
        return <LoadingState mode={mode} />;

      case 'success':
        return (
          <SuccessState
            {...(formStateData!.success as StateContentProps)}
            onRefresh={onRefresh}
            mode={mode}
          />
        );

      case 'error':
        return (
          <ErrorState
            {...(formStateData!.error as StateContentProps)}
            onRefresh={onRefresh}
            mode={mode}
          />
        );

      default:
        return null;
    }
  }, [formState, formStateData, onRefresh, mode]);

  if (formState === 'idle' || !currentStateContent) {
    return null;
  }

  return (
    <div
      className={`${styles.formStatesWrapper} ${className || ''}`}
      data-mode={mode}
    >
      {currentStateContent}
    </div>
  );
}

// Export individual components for more granular use if needed
export { ErrorState, LoadingState, SuccessState };
export type { FormState, FormStatesProps };

const SuccessIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={25} height={24} fill="none">
    <g clipPath="url(#a)">
      <path
        stroke="#009116"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7.5 11v8a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0a4 4 0 0 0 4-4V6a2 2 0 1 1 4 0v5h3a2 2 0 0 1 2 2l-1 5c-.144.613-.417 1.14-.777 1.501-.361.36-.79.536-1.223.499h-7a3 3 0 0 1-3-3"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M.5 0h24v24H.5z" />
      </clipPath>
    </defs>
  </svg>
);

const ErrorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={25} height={25} fill="none">
    <g clipPath="url(#a)">
      <path
        stroke="#FF6A00"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7.5 13.5v-8a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3Zm0 0a4 4 0 0 1 4 4v1a2 2 0 1 0 4 0v-5h3a2 2 0 0 0 2-2l-1-5c-.144-.614-.417-1.14-.777-1.501-.361-.36-.79-.536-1.223-.5h-7a3 3 0 0 0-3 3"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M.5.5h24v24H.5z" />
      </clipPath>
    </defs>
  </svg>
);
