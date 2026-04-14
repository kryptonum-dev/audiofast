import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/src/components/ui/Button';
import Error from '@/src/components/ui/Error';
import inputStyles from '@/src/components/ui/Input/styles.module.scss';
import type { CartCouponRevalidationNotice } from '@/src/global/b2c/cart/cart-context';
import type { CartState } from '@/src/global/b2c/cart/types';

import styles from './styles.module.scss';

type CartCouponCardProps = {
  cart: CartState;
  onApplyCoupon: (code: string) => Promise<void>;
  onClearCoupon: () => void;
  isApplyingCoupon?: boolean;
  isRevalidatingCoupon?: boolean;
  inputError?: string | null;
  statusNotice?: CartCouponRevalidationNotice | null;
  canRetryStatus?: boolean;
  onRetryStatus?: () => Promise<void>;
  onInputChange?: () => void;
};

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M18 6L6 18M6 6l12 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function CartCouponCard({
  cart,
  onApplyCoupon,
  onClearCoupon,
  isApplyingCoupon = false,
  isRevalidatingCoupon = false,
  inputError = null,
  statusNotice = null,
  canRetryStatus = false,
  onRetryStatus,
  onInputChange,
}: CartCouponCardProps) {
  const inputId = useId();
  const [couponCode, setCouponCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const lastAppliedCouponCodeRef = useRef(
    cart.coupon?.isValid ? cart.coupon.code : null,
  );

  useEffect(() => {
    if (cart.coupon?.code) {
      setCouponCode('');
      setValidationError(null);
    }
  }, [cart.coupon?.code]);

  useEffect(() => {
    const currentAppliedCouponCode = cart.coupon?.isValid
      ? cart.coupon.code
      : null;

    if (
      currentAppliedCouponCode &&
      currentAppliedCouponCode !== lastAppliedCouponCodeRef.current
    ) {
      toast.success('Kod rabatowy został zastosowany.');
    }

    lastAppliedCouponCodeRef.current = currentAppliedCouponCode;
  }, [cart.coupon?.code, cart.coupon?.isValid]);

  const handleApplyCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextCode = couponCode.trim();

    if (!nextCode) {
      setValidationError('Wpisz kod rabatowy.');
      return;
    }

    setValidationError(null);
    setCouponCode(nextCode);
    await onApplyCoupon(nextCode);
  };

  const handleClearCoupon = () => {
    setCouponCode('');
    setValidationError(null);
    onClearCoupon();
    toast.info('Kod rabatowy został usunięty.');
  };

  const isCouponBusy = isApplyingCoupon || isRevalidatingCoupon;
  const fieldError = validationError ?? inputError;
  const fallbackInvalidCouponMessage =
    cart.coupon && !cart.coupon.isValid ? cart.coupon.message : null;
  const activeCoupon = cart.coupon?.isValid ? cart.coupon : null;

  return (
    <section className={styles.sidebarCard}>
      <h2 className={styles.sidebarHeading}>Kod rabatowy</h2>

      <form className={styles.couponForm} onSubmit={handleApplyCoupon}>
        <div className={styles.couponField}>
          <label
            className={inputStyles.input}
            htmlFor={inputId}
            aria-invalid={!!fieldError}
          >
            <input
              id={inputId}
              name="code"
              type="text"
              value={couponCode}
              placeholder="Wpisz kod"
              disabled={isCouponBusy}
              autoComplete="off"
              onChange={(event) => {
                setCouponCode(event.target.value);
                if (validationError) {
                  setValidationError(null);
                }
                onInputChange?.();
              }}
            />
            <Error>{fieldError}</Error>
          </label>
        </div>

        {activeCoupon ? (
          <button
            type="button"
            className={styles.couponChip}
            onClick={handleClearCoupon}
            disabled={isCouponBusy}
            aria-label={`Usuń kod rabatowy ${activeCoupon.code}`}
          >
            <span className={styles.couponChipCode}>{activeCoupon.code}</span>
            <span className={styles.couponChipIcon}>
              <CloseIcon />
            </span>
          </button>
        ) : null}

        <div className={styles.couponActions}>
          <Button
            type="submit"
            text={isCouponBusy ? 'Sprawdzanie...' : 'Zastosuj'}
            variant="secondary"
            iconUsed="submit"
            className={styles.couponButton}
            disabled={isCouponBusy}
          />
        </div>
      </form>

      {statusNotice || fallbackInvalidCouponMessage ? (
        <div
          className={styles.couponStatus}
          data-tone={statusNotice?.tone ?? 'warning'}
        >
          {statusNotice ? (
            <>
              <p className={styles.couponStatusTitle}>{statusNotice.title}</p>
              <p className={styles.couponStatusDescription}>
                {statusNotice.description}
              </p>
            </>
          ) : (
            <p className={styles.couponStatusDescription}>
              {fallbackInvalidCouponMessage}
            </p>
          )}

          {canRetryStatus && onRetryStatus ? (
            <button
              type="button"
              className={styles.textAction}
              onClick={() => void onRetryStatus()}
              disabled={isCouponBusy}
            >
              Spróbuj ponownie
            </button>
          ) : null}
        </div>
      ) : null}

      <p className={styles.couponMessage}>
        Możesz użyć jednego kodu rabatowego na zamówienie.
      </p>
    </section>
  );
}
