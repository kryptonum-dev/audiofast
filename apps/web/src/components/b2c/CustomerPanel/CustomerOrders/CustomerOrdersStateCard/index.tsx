import Button from '@/src/components/ui/Button';

import styles from './styles.module.scss';

type CustomerOrdersStateAction = {
  href: string;
  label: string;
  iconUsed: 'arrowLeft' | 'arrowRight';
  variant: 'primary' | 'secondary';
};

type CustomerOrdersStateCardProps = {
  heading: string;
  description: string;
  actions: CustomerOrdersStateAction[];
  live?: boolean;
};

export default function CustomerOrdersStateCard({
  heading,
  description,
  actions,
  live = false,
}: CustomerOrdersStateCardProps) {
  return (
    <section
      className={styles.stateCard}
      {...(live ? { 'aria-live': 'polite' as const } : {})}
    >
      <h2 className={styles.stateHeading}>{heading}</h2>
      <p className={styles.stateDescription}>{description}</p>
      <div className={styles.stateActions}>
        {actions.map((action) => (
          <Button
            key={action.href}
            href={action.href}
            variant={action.variant}
            iconUsed={action.iconUsed}
            className={styles.actionButton}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
