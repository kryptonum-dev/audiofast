import { useState } from 'react';
import { toast } from 'sonner';

import Image from '@/components/shared/Image';
import Button from '@/src/components/ui/Button';
import ConfirmationModal from '@/src/components/ui/ConfirmationModal';
import QuantityStepper, {
  DEFAULT_QUANTITY_STEPPER_MAX,
} from '@/src/components/ui/QuantityStepper';
import type { CartLine, CartLineIssue } from '@/src/global/b2c/cart/types';
import { formatPrice } from '@/src/global/utils';

import styles from './styles.module.scss';

type CartItemCardProps = {
  line: CartLine;
  lineDiscountCents?: number;
  isInteractionDisabled?: boolean;
  onRemove: (lineId: string) => void;
  onSetQuantity?: (lineId: string, quantity: number) => void;
  onIncrementQuantity?: (lineId: string) => void;
  onDecrementQuantity?: (lineId: string) => void;
  onReconfigure?: (lineId: string) => void;
  onKeepWithoutOptions?: (lineId: string) => void;
};

type BlockingOverlayContent = {
  title: string;
  description: string;
  removeButtonText: string;
  showReconfigureAction?: boolean;
  showKeepWithoutOptionsAction?: boolean;
  keepWithoutOptionsButtonText?: string;
  requiresRemoveConfirmation?: boolean;
};

function getBlockingOverlayContent(
  issues: CartLineIssue[],
  options?: {
    allowKeepWithoutOptions?: boolean;
    allowReconfigureWithAddedOptions?: boolean;
  },
): BlockingOverlayContent | null {
  const issueCodes = new Set(issues.map((issue) => issue.code));

  if (issueCodes.has('cpo_unavailable')) {
    return {
      title: 'Egzemplarz CPO jest niedostępny.',
      description:
        'Egzemplarz został już kupiony albo jest obecnie w trakcie finalizacji zakupu.',
      removeButtonText: 'Usuń egzemplarz CPO',
    };
  }

  if (issueCodes.has('not_buyable')) {
    return {
      title: 'Produkt nie jest już dostępny online.',
      description:
        'Produkt nie może zostać obecnie zamówiony online. Usuń go z koszyka, aby kontynuować.',
      removeButtonText: 'Usuń niedostępny produkt',
    };
  }

  if (issueCodes.has('configuration_invalid')) {
    if (options?.allowKeepWithoutOptions) {
      return {
        title: 'Wybrane opcje nie są już dostępne.',
        description:
          'Ten produkt można dalej kupić, ale bez wcześniej zapisanych opcji. Możesz zostawić go w koszyku bez opcji albo usunąć go całkowicie.',
        removeButtonText: 'Usuń produkt',
        showKeepWithoutOptionsAction: true,
        keepWithoutOptionsButtonText: 'Zachowaj produkt',
        requiresRemoveConfirmation: true,
      };
    }

    if (options?.allowReconfigureWithAddedOptions) {
      return {
        title: 'Produkt wymaga nowej konfiguracji.',
        description:
          'Od czasu dodania do koszyka ten produkt otrzymał nowe opcje konfiguracji. Skonfiguruj produkt ponownie albo usuń go z koszyka.',
        removeButtonText: 'Usuń produkt',
        showReconfigureAction: true,
        requiresRemoveConfirmation: true,
      };
    }

    return {
      title: 'Konfiguracja wymaga ponownego ustawienia.',
      description:
        'Wybrana konfiguracja nie jest już dostępna. Skonfiguruj produkt ponownie albo usuń go z koszyka.',
      removeButtonText: 'Usuń produkt',
      showReconfigureAction: true,
      requiresRemoveConfirmation: true,
    };
  }

  return null;
}

export default function CartItemCard({
  line,
  lineDiscountCents = 0,
  isInteractionDisabled = false,
  onRemove,
  onSetQuantity,
  onIncrementQuantity,
  onDecrementQuantity,
  onReconfigure,
  onKeepWithoutOptions,
}: CartItemCardProps) {
  const blockingIssues = line.issues.filter((issue) => issue.blocking);
  const nonBlockingIssues = line.issues.filter((issue) => !issue.blocking);
  const hasBlockingIssue = blockingIssues.length > 0;
  const [isRemoveConfirmationOpen, setIsRemoveConfirmationOpen] =
    useState(false);
  const lineTotalCents = line.unitPriceCents * line.quantity;
  const hasConfigurationSection =
    line.lineType === 'standard' && line.configurationSummary.length > 0;
  const shouldShowKeepWithoutOptionsAction =
    line.lineType === 'standard' && Boolean(onKeepWithoutOptions);
  const shouldShowReconfigureWithAddedOptionsAction =
    line.lineType === 'standard' &&
    Boolean(onReconfigure) &&
    !hasConfigurationSection &&
    !shouldShowKeepWithoutOptionsAction;
  const shouldRenderReconfigureAction =
    line.lineType === 'standard' &&
    Boolean(onReconfigure) &&
    hasConfigurationSection;
  const blockingOverlayContent = getBlockingOverlayContent(
    blockingIssues,
    {
      allowKeepWithoutOptions: shouldShowKeepWithoutOptionsAction,
      allowReconfigureWithAddedOptions:
        shouldShowReconfigureWithAddedOptionsAction,
    },
  );
  const areLineMutationControlsDisabled =
    isInteractionDisabled || hasBlockingIssue;

  const handleRemove = () => {
    if (isInteractionDisabled) {
      return;
    }

    onRemove(line.lineId);
    toast.info(`${line.productName} usunięty z koszyka`);
  };

  const handleConfirmRemove = () => {
    handleRemove();
  };

  const handleRemoveRequest = () => {
    if (isInteractionDisabled) {
      return;
    }

    if (
      hasBlockingIssue &&
      blockingOverlayContent &&
      !blockingOverlayContent.requiresRemoveConfirmation
    ) {
      handleRemove();
      return;
    }

    setIsRemoveConfirmationOpen(true);
  };

  const handleQuantityCommit = (nextQuantity: number) => {
    if (
      isInteractionDisabled ||
      line.lineType !== 'standard' ||
      !onSetQuantity
    ) {
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
    if (
      isInteractionDisabled ||
      !onDecrementQuantity ||
      line.lineType !== 'standard'
    ) {
      return;
    }

    if (line.quantity <= 1) {
      handleRemoveRequest();
      return;
    }

    onDecrementQuantity(line.lineId);
  };

  const handleReconfigure = () => {
    if (
      isInteractionDisabled ||
      !onReconfigure ||
      line.lineType !== 'standard' ||
      (!hasConfigurationSection && !shouldShowReconfigureWithAddedOptionsAction)
    ) {
      return;
    }

    onReconfigure(line.lineId);
  };

  const handleKeepWithoutOptions = () => {
    if (
      isInteractionDisabled ||
      !onKeepWithoutOptions ||
      line.lineType !== 'standard'
    ) {
      return;
    }

    onKeepWithoutOptions(line.lineId);
  };

  return (
    <>
      <article
        className={styles.cartItemCard}
        data-line-type={line.lineType}
        data-blocking={hasBlockingIssue}
      >
        <div
          className={styles.media}
          aria-hidden={hasBlockingIssue || undefined}
        >
          <Image image={line.product.image} sizes="160px" />
        </div>

        <div
          className={styles.identity}
          aria-hidden={hasBlockingIssue || undefined}
        >
          <span className={styles.brand}>{line.brandName}</span>
          <h2 className={styles.productName}>{line.productName}</h2>
          {line.lineType === 'cpo' ? (
            <p className={styles.cpoBadge}>Egzemplarz CPO</p>
          ) : null}
        </div>

        <div
          className={styles.priceBlock}
          aria-hidden={hasBlockingIssue || undefined}
        >
          <span className={styles.price}>{formatPrice(lineTotalCents)}</span>
          {lineDiscountCents > 0 ? (
            <p className={styles.priceDiscount}>
              Rabat: -{formatPrice(lineDiscountCents)}
            </p>
          ) : null}
        </div>

        {nonBlockingIssues.length > 0 ? (
          <ul
            className={styles.issuesList}
            aria-label="Problemy z pozycją"
            aria-hidden={hasBlockingIssue || undefined}
          >
            {nonBlockingIssues.map((issue) => (
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
            <div
              className={styles.metaRow}
              aria-hidden={hasBlockingIssue || undefined}
            >
              <QuantityStepper
                className={styles.quantityStepper}
                quantity={line.quantity}
                max={DEFAULT_QUANTITY_STEPPER_MAX}
                disabled={areLineMutationControlsDisabled}
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
              <div
                className={styles.configuration}
                aria-hidden={hasBlockingIssue || undefined}
              >
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
          aria-hidden={hasBlockingIssue || undefined}
        >
          {shouldRenderReconfigureAction ? (
            <Button
              type="button"
              text="Edytuj konfigurację"
              variant="secondary"
              focusOutline="black"
              iconUsed="edit"
              disabled={areLineMutationControlsDisabled}
              tabIndex={hasBlockingIssue ? -1 : undefined}
              aria-hidden={hasBlockingIssue || undefined}
              onClick={handleReconfigure}
            />
          ) : null}

          <Button
            type="button"
            text="Usuń z koszyka"
            variant="secondary"
            focusOutline="black"
            iconUsed="trash"
            disabled={areLineMutationControlsDisabled}
            tabIndex={hasBlockingIssue ? -1 : undefined}
            aria-hidden={hasBlockingIssue || undefined}
            onClick={handleRemoveRequest}
          />
        </div>

        {hasBlockingIssue && blockingOverlayContent ? (
          <div className={styles.blockingOverlay}>
            <div className={styles.blockingOverlayInner}>
              <p className={styles.blockingOverlayTitle}>
                {blockingOverlayContent.title}
              </p>
              <p className={styles.blockingOverlayDescription}>
                {blockingOverlayContent.description}
              </p>
              <div className={styles.blockingOverlayActions}>
                {blockingOverlayContent.showReconfigureAction &&
                (shouldRenderReconfigureAction ||
                  shouldShowReconfigureWithAddedOptionsAction) ? (
                  <Button
                    type="button"
                    text="Skonfiguruj ponownie"
                    variant="primary"
                    iconUsed="edit"
                    disabled={isInteractionDisabled}
                    onClick={handleReconfigure}
                  />
                ) : null}
                {blockingOverlayContent.showKeepWithoutOptionsAction &&
                shouldShowKeepWithoutOptionsAction ? (
                  <Button
                    type="button"
                    text={
                      blockingOverlayContent.keepWithoutOptionsButtonText ??
                      'Zachowaj produkt'
                    }
                    variant="primary"
                    iconUsed="arrowRight"
                    disabled={isInteractionDisabled}
                    onClick={handleKeepWithoutOptions}
                  />
                ) : null}
                <Button
                  type="button"
                  text={blockingOverlayContent.removeButtonText}
                  variant={
                    blockingOverlayContent.showReconfigureAction ||
                    blockingOverlayContent.showKeepWithoutOptionsAction
                      ? 'secondary'
                      : 'primary'
                  }
                  focusOutline={
                    blockingOverlayContent.showReconfigureAction ||
                    blockingOverlayContent.showKeepWithoutOptionsAction
                      ? 'black'
                      : undefined
                  }
                  iconUsed="trash"
                  disabled={isInteractionDisabled}
                  onClick={handleRemoveRequest}
                />
              </div>
            </div>
          </div>
        ) : null}
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
