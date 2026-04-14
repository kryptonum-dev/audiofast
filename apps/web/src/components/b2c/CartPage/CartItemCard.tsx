import { useState } from 'react';
import { toast } from 'sonner';

import Image from '@/components/shared/Image';
import Button from '@/src/components/ui/Button';
import ConfirmationModal from '@/src/components/ui/ConfirmationModal';
import QuantityStepper, {
  DEFAULT_QUANTITY_STEPPER_MAX,
} from '@/src/components/ui/QuantityStepper';
import type { CartLine } from '@/src/global/b2c/cart/types';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

export type CartItemCardProps = {
  line: CartLine;
  lineDiscountCents?: number;
  onRemove: (lineId: string) => void;
  onSetQuantity?: (lineId: string, quantity: number) => void;
  onIncrementQuantity?: (lineId: string) => void;
  onDecrementQuantity?: (lineId: string) => void;
  onReconfigure?: (lineId: string) => void;
};

export default function CartItemCard({
  line,
  lineDiscountCents = 0,
  onRemove,
  onSetQuantity,
  onIncrementQuantity,
  onDecrementQuantity,
  onReconfigure,
}: CartItemCardProps) {
  const hasBlockingIssue = line.issues.some((issue) => issue.blocking);
  const [isRemoveConfirmationOpen, setIsRemoveConfirmationOpen] =
    useState(false);
  const lineTotalCents = line.unitPriceCents * line.quantity;
  const hasConfigurationSection =
    line.lineType === 'standard' && line.configurationSummary.length > 0;

  const handleConfirmRemove = () => {
    onRemove(line.lineId);
    toast.info(`${line.productName} usunięty z koszyka`);
  };

  const handleQuantityCommit = (nextQuantity: number) => {
    if (line.lineType !== 'standard' || !onSetQuantity) {
      return;
    }

    onSetQuantity(line.lineId, nextQuantity);
  };

  const handleCappedAtMax = () => {
    toast.info(
      `Maksymalna ilość dla jednej pozycji to ${DEFAULT_QUANTITY_STEPPER_MAX}.`,
    );
  };

  const handleDecrementQuantity = () => {
    if (!onDecrementQuantity || line.lineType !== 'standard') {
      return;
    }

    if (line.quantity <= 1) {
      setIsRemoveConfirmationOpen(true);
      return;
    }

    onDecrementQuantity(line.lineId);
  };

  return (
    <>
      <article
        className={styles.cartItemCard}
        data-line-type={line.lineType}
        data-blocking={hasBlockingIssue}
      >
        <div className={styles.media}>
          <Image image={line.product.image} sizes="160px" />
        </div>

        <div className={styles.identity}>
          <span className={styles.brand}>{line.brandName}</span>
          <h2 className={styles.productName}>{line.productName}</h2>
          {line.lineType === 'cpo' ? (
            <p className={styles.cpoBadge}>Egzemplarz CPO</p>
          ) : null}
        </div>

        <div className={styles.priceBlock}>
          <span className={styles.price}>{formatPrice(lineTotalCents)}</span>
          {lineDiscountCents > 0 ? (
            <p className={styles.priceDiscount}>
              Rabat: -{formatPrice(lineDiscountCents)}
            </p>
          ) : null}
        </div>

        {line.issues.length > 0 ? (
          <ul className={styles.issuesList} aria-label="Problemy z pozycją">
            {line.issues.map((issue) => (
              <li
                key={`${line.lineId}-${issue.code}`}
                className={styles.issue}
                data-blocking={issue.blocking}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}

        {line.lineType === 'standard' ? (
          <>
            <div className={styles.metaRow}>
              <QuantityStepper
                className={styles.quantityStepper}
                quantity={line.quantity}
                max={DEFAULT_QUANTITY_STEPPER_MAX}
                onIncrement={() => onIncrementQuantity?.(line.lineId)}
                onDecrement={handleDecrementQuantity}
                onQuantityCommit={
                  onSetQuantity ? handleQuantityCommit : undefined
                }
                onCappedAtMax={handleCappedAtMax}
                disableDecrement={!onDecrementQuantity}
                disableIncrement={!onIncrementQuantity}
              />
            </div>

            {hasConfigurationSection ? (
              <div className={styles.configuration}>
                <h3 className={styles.configurationHeading}>
                  Modyfikacje / konfiguracja
                </h3>
                <dl className={styles.configurationList}>
                  {line.configurationSummary.map((item) => (
                    <div
                      key={`${line.lineId}-${item.label}-${item.value}`}
                      className={styles.configurationRow}
                    >
                      <dt className={styles.configurationLabel}>
                        {item.label}
                      </dt>
                      <dd className={styles.configurationValue}>
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </>
        ) : null}

        <div
          className={styles.actions}
          data-has-divider={hasConfigurationSection ? 'false' : 'true'}
        >
          {line.lineType === 'standard' && onReconfigure ? (
            <Button
              type="button"
              text="Edytuj konfigurację"
              variant="secondary"
              iconUsed="refresh"
              onClick={() => onReconfigure(line.lineId)}
            />
          ) : null}

          <Button
            type="button"
            text="Usuń z koszyka"
            variant="secondary"
            iconUsed="trash"
            onClick={() => setIsRemoveConfirmationOpen(true)}
          />
        </div>
      </article>

      <ConfirmationModal
        isOpen={isRemoveConfirmationOpen}
        onClose={() => setIsRemoveConfirmationOpen(false)}
        onConfirm={handleConfirmRemove}
        title="Usunąć produkt z koszyka?"
        message="Ta operacja usunie wybraną pozycję z koszyka. Czy chcesz kontynuować?"
        confirmText="Usuń produkt"
        cancelText="Anuluj"
      />
    </>
  );
}
