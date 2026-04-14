import styles from './styles.module.scss';

type CheckoutStepId = 'cart' | 'checkout' | 'confirmation';

type CheckoutStepsProps = {
  currentStep: CheckoutStepId;
};

const STEP_ITEMS: Array<{
  id: CheckoutStepId;
  label: string;
}> = [
  {
    id: 'cart',
    label: 'Koszyk',
  },
  {
    id: 'checkout',
    label: 'Twoje dane',
  },
  {
    id: 'confirmation',
    label: 'Potwierdzenie',
  },
];

export default function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const activeIndex = STEP_ITEMS.findIndex((step) => step.id === currentStep);

  return (
    <nav
      className={`${styles.checkoutSteps} max-width`}
      aria-label="Postęp zamówienia"
    >
      <ol className={styles.stepsList}>
        {STEP_ITEMS.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = index < activeIndex;

          return (
            <li
              key={step.id}
              className={styles.stepItem}
              data-state={
                isCurrent ? 'current' : isCompleted ? 'completed' : 'upcoming'
              }
            >
              <span className={styles.stepIndicator} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.stepLabel}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
