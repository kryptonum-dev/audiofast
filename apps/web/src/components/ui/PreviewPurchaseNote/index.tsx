import styles from './styles.module.scss';

/**
 * Shown next to a disabled purchase button in draft mode (P10): editors see
 * the product as visitors do, but cannot put a draft into the cart.
 */
export default function PreviewPurchaseNote({
  className,
}: {
  className?: string;
}) {
  return (
    <p
      className={`${styles.previewPurchaseNote}${className ? ` ${className}` : ''}`}
      role="note"
    >
      Zakup niedostępny w podglądzie
    </p>
  );
}
