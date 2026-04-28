'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  requestCustomerOrderCancellationAction,
  type RequestCustomerOrderCancellationActionResult,
} from '@/src/app/actions/customer-order-cancellation';
import Button from '@/src/components/ui/Button';
import ConfirmationModal from '@/src/components/ui/ConfirmationModal';
import type { CustomerOrderDetail } from '@/src/global/b2c/customer-auth/server/order-detail';

import styles from './styles.module.scss';

type OrderCancellationSectionProps = {
  order: CustomerOrderDetail;
};

function getActionErrorMessage(
  result: Extract<RequestCustomerOrderCancellationActionResult, { ok: false }>,
): string {
  switch (result.error.kind) {
    case 'not_eligible':
      return 'Nie można już poprosić o anulowanie tego zamówienia. Status zamówienia zmienił się od czasu załadowania strony.';
    case 'not_found':
      return 'Nie możemy odnaleźć tego zamówienia dla zalogowanego adresu e-mail.';
    case 'unauthenticated':
      return 'Sesja wygasła. Zaloguj się ponownie, aby poprosić o anulowanie zamówienia.';
    case 'unexpected_error':
    default:
      return 'Nie udało się wysłać prośby o anulowanie. Spróbuj ponownie za chwilę.';
  }
}

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        clipPath="url(#cancellation-clock-icon)"
      >
        <path d="M3 12a9 9 0 1 0 18.001 0A9 9 0 0 0 3 12" />
        <path d="M12 7v5l3 3" />
      </g>
      <defs>
        <clipPath id="cancellation-clock-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function CancelledIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        clipPath="url(#cancellation-cancelled-icon)"
      >
        <path d="M9.88 9.878a3 3 0 1 0 4.243 4.243m.58-3.425a3 3 0 0 0-1.412-1.405" />
        <path d="M10 6h9a2 2 0 0 1 2 2v8c0 .294-.064.574-.178.825M18 18H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1M18 12h.01M6 12h.01M3 3l18 18" />
      </g>
      <defs>
        <clipPath id="cancellation-cancelled-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function getRequestStatusCopy(status: string | null) {
  if (status === 'open') {
    return {
      icon: <ClockIcon />,
      label: 'Status prośby',
      value: 'Oczekuje na decyzję Audiofast',
      tone: 'pending',
    };
  }

  if (status === 'rejected') {
    return {
      icon: <CancelledIcon />,
      label: 'Status prośby',
      value: 'Odrzucona',
      tone: 'cancelled',
    };
  }

  return {
    icon: <CancelledIcon />,
    label: 'Status prośby',
    value: 'Zaakceptowana',
    tone: 'accepted',
  };
}

export default function OrderCancellationSection({
  order,
}: OrderCancellationSectionProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const requestStatus = order.cancellationRequest?.status ?? null;
  const statusCopy = getRequestStatusCopy(requestStatus);
  const canRequestCancellation = order.actions.canCancel && !isPending;

  const handleConfirm = () => {
    setIsModalOpen(false);

    startTransition(async () => {
      const result = await requestCustomerOrderCancellationAction({
        orderNumber: order.orderNumber,
      });

      if (result.ok) {
        toast.success(
          result.value.kind === 'already_requested'
            ? 'Prośba o anulowanie była już wysłana. Odświeżamy status zamówienia.'
            : 'Prośba o anulowanie została wysłana do Audiofast.',
        );
        router.refresh();
        return;
      }

      toast.error(getActionErrorMessage(result));
      router.refresh();
    });
  };

  return (
    <section className={styles.section}>
      <h2>Anulowanie zamówienia</h2>
      <div className={styles.actionItem}>
        <p>{order.actions.cancelMessage}</p>

        {order.cancellationRequest ? (
          <div className={styles.requestStatus} data-tone={statusCopy.tone}>
            <span className={styles.requestStatusIcon}>{statusCopy.icon}</span>
            <div>
              <span>{statusCopy.label}</span>
              <strong>{statusCopy.value}</strong>
            </div>
          </div>
        ) : null}

        {order.actions.canCancel ? (
          <Button
            type="button"
            variant="secondary"
            iconUsed="trash"
            isLoading={isPending}
            disabled={!canRequestCancellation}
            className={styles.actionButton}
            onClick={() => setIsModalOpen(true)}
          >
            Poproś o anulowanie
          </Button>
        ) : null}
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirm}
        title="Poprosić o anulowanie zamówienia?"
        message="Sprawdzimy, czy zamówienie można jeszcze zatrzymać. Do czasu potwierdzenia status zamówienia nie zostanie zmieniony."
        confirmText="Wyślij prośbę"
        cancelText="Wróć"
      />
    </section>
  );
}
