import Button from '@/src/components/ui/Button';

import styles from './placeholder.module.scss';

type CustomerPanelPlaceholderProps = {
  eyebrow: string;
  heading: string;
  description: string;
  actions: Array<{
    href: string;
    label: string;
    iconUsed: 'arrowLeft' | 'arrowRight';
    variant: 'primary' | 'secondary';
  }>;
};

export default function CustomerPanelPlaceholder({
  eyebrow,
  heading,
  description,
  actions,
}: CustomerPanelPlaceholderProps) {
  return (
    <main id="main" className="page-transition">
      <section className={styles.placeholderPage}>
        <div className={`max-width ${styles.inner}`}>
          <div className={styles.card}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 className={styles.heading}>{heading}</h1>
            <p className={styles.description}>{description}</p>
            <div className={styles.actions}>
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
          </div>
        </div>
      </section>
    </main>
  );
}
