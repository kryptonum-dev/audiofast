"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  requestCustomerOrderReturnAction,
  type RequestCustomerOrderReturnActionResult,
} from "@/src/app/actions/customer-order-return";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import { formatCustomerOrderDateTime } from "@/src/global/b2c/customer-auth/orders-formatting";
import type { CustomerOrderDetail } from "@/src/global/b2c/customer-auth/server/order-detail";

import styles from "./styles.module.scss";

type OrderRefundSectionProps = {
  order: CustomerOrderDetail;
};

function getActionErrorMessage(
  result: Extract<RequestCustomerOrderReturnActionResult, { ok: false }>,
): string {
  switch (result.error.kind) {
    case "not_eligible":
      return "Nie można już poprosić o zwrot tego zamówienia. Status lub warunki zwrotu zmieniły się od czasu załadowania strony.";
    case "not_found":
      return "Nie możemy odnaleźć tego zamówienia dla zalogowanego adresu e-mail.";
    case "unauthenticated":
      return "Sesja wygasła. Zaloguj się ponownie, aby poprosić o zwrot zamówienia.";
    case "unexpected_error":
    default:
      return "Nie udało się wysłać prośby o zwrot. Spróbuj ponownie za chwilę.";
  }
}

function renderOptionalValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Brak danych";
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd>{renderOptionalValue(value)}</dd>
    </div>
  );
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
        clipPath="url(#return-clock-icon)"
      >
        <path d="M3 12a9 9 0 1 0 18.001 0A9 9 0 0 0 3 12" />
        <path d="M12 7v5l3 3" />
      </g>
      <defs>
        <clipPath id="return-clock-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function ReturnCompletedIcon() {
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
        clipPath="url(#return-completed-icon)"
      >
        <path d="M8.812 4.793 12 3l8 4.5V16m-2.282 1.784L12 21l-8-4.5v-9l2.223-1.25M14.547 10.57l5.457-3.07M12 12v9M12 12 4 7.5M16 5.25l-4.35 2.447M9.086 9.139 8 9.75M3 3l18 18" />
      </g>
      <defs>
        <clipPath id="return-completed-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function ReturnClosedIcon() {
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
        clipPath="url(#return-closed-icon)"
      >
        <path d="M5 5l14 14M19 5 5 19" />
        <path d="M3 12a9 9 0 1 0 18.001 0A9 9 0 0 0 3 12" />
      </g>
      <defs>
        <clipPath id="return-closed-icon">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function getReturnStatusCopy(status: string | null) {
  if (status === "completed") {
    return {
      icon: <ReturnCompletedIcon />,
      label: "Status zwrotu",
      tone: "accepted",
      value: "Zwrot potwierdzony",
    };
  }

  if (status === "closed_without_return") {
    return {
      icon: <ReturnClosedIcon />,
      label: "Status zwrotu",
      tone: "denied",
      value: "Zgłoszenie zamknięte",
    };
  }

  return {
    icon: <ClockIcon />,
    label: "Status zwrotu",
    tone: "pending",
    value: "Oczekuje na obsługę Audiofast",
  };
}

function ReturnRequestModal({
  isOpen,
  isPending,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const { handleSubmit, register, reset } = useForm<{ reason: string }>({
    defaultValues: {
      reason: "",
    },
  });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && !isPending) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isPending, onClose]);

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  if (!isOpen) {
    return null;
  }

  const handleReturnSubmit = handleSubmit((data) => {
    onSubmit(data.reason);
  });

  return (
    <div
      className={styles.modalOverlay}
      onClick={isPending ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-request-title"
      aria-describedby="return-request-description"
    >
      <form
        className={styles.returnModal}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleReturnSubmit}
      >
        <div className={styles.modalIconWrapper}>
          <ClockIcon />
        </div>

        <h2 className={styles.modalTitle} id="return-request-title">
          Poprosić o rozpoczęcie zwrotu?
        </h2>
        <p className={styles.modalMessage} id="return-request-description">
          Możesz dodać krótki powód zwrotu. Status zamówienia nie zmieni się
          automatycznie, dopóki obsługa zwrotu nie zostanie zakończona.
        </p>

        <div className={styles.modalField}>
          <Input
            textarea
            label="Powód zwrotu (opcjonalnie)"
            register={register("reason")}
            errors=""
            placeholder="Np. produkt nie spełnia oczekiwań lub zamówiłem inny model."
            rows={4}
            disabled={isPending}
          />
        </div>

        <div className={styles.modalActions}>
          <Button
            className={styles.cancelButton}
            onClick={onClose}
            type="button"
            variant="secondary"
            disabled={isPending}
          >
            Wróć
          </Button>
          <Button
            className={styles.confirmButton}
            type="submit"
            iconUsed="arrowRight"
            isLoading={isPending}
            disabled={isPending}
          >
            Wyślij prośbę
          </Button>
        </div>
      </form>
    </div>
  );
}

function getReturnDateCopy(
  returnCase: CustomerOrderDetail["returnCases"][number],
) {
  if (returnCase.status === "completed") {
    return {
      label: "Potwierdzono",
      value:
        returnCase.completedAt ?? returnCase.updatedAt ?? returnCase.createdAt,
    };
  }

  if (returnCase.status === "closed_without_return") {
    return {
      label: "Zamknięto",
      value:
        returnCase.closedAt ?? returnCase.updatedAt ?? returnCase.createdAt,
    };
  }

  return {
    label: "Zgłoszono",
    value: returnCase.createdAt,
  };
}

export default function OrderRefundSection({ order }: OrderRefundSectionProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canRequestReturn = order.actions.canRequestReturn && !isPending;
  const hasReturnCases = order.returnCases.length > 0;

  const handleSubmitReturn = (reason: string) => {
    startTransition(async () => {
      const result = await requestCustomerOrderReturnAction({
        orderNumber: order.orderNumber,
        reason,
      });

      if (result.ok) {
        setIsModalOpen(false);
        toast.success(
          result.value.kind === "already_requested"
            ? "Prośba o zwrot była już wysłana. Odświeżamy status zamówienia."
            : "Prośba o zwrot została wysłana do Audiofast.",
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
      <h2>Zwrot zamówienia</h2>

      {hasReturnCases ? (
        <div className={styles.returnCases}>
          {order.returnCases.map((returnCase) => {
            const returnStatusCopy = getReturnStatusCopy(returnCase.status);
            const returnDateCopy = getReturnDateCopy(returnCase);

            return (
              <div
                className={styles.returnCase}
                data-tone={returnStatusCopy.tone}
                key={`${returnCase.createdAt}-${returnCase.status}`}
              >
                <div
                  className={styles.returnStatus}
                  data-tone={returnStatusCopy.tone}
                >
                  <span className={styles.returnStatusIcon}>
                    {returnStatusCopy.icon}
                  </span>
                  <div>
                    <span>{returnStatusCopy.label}</span>
                    <strong>{returnStatusCopy.value}</strong>
                  </div>
                </div>
                <dl className={styles.inlineDetails}>
                  <DetailRow label="Powód" value={returnCase.reason} />
                  <DetailRow
                    label={returnDateCopy.label}
                    value={formatCustomerOrderDateTime(returnDateCopy.value)}
                  />
                </dl>
              </div>
            );
          })}
        </div>
      ) : null}

      {!order.activeReturnCase ? (
        <div className={styles.actionItem}>
          <p>{order.actions.returnMessage}</p>
          {order.actions.canRequestReturn ? (
            <Button
              type="button"
              variant="secondary"
              iconUsed="arrowRight"
              isLoading={isPending}
              disabled={!canRequestReturn}
              className={styles.actionButton}
              onClick={() => setIsModalOpen(true)}
            >
              Zgłoś zwrot
            </Button>
          ) : null}
        </div>
      ) : null}

      <ReturnRequestModal
        isOpen={isModalOpen}
        isPending={isPending}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitReturn}
      />
    </section>
  );
}
