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
  const couponDetailsId = useId();
  const [couponCode, setCouponCode] = useState('');
  const [isCouponDetailsVisible, setIsCouponDetailsVisible] = useState(false);
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
    setIsCouponDetailsVisible(false);
    setValidationError(null);
    onClearCoupon();
    toast.info('Kod rabatowy został usunięty.');
  };

  const isCouponBusy = isApplyingCoupon || isRevalidatingCoupon;
  const fieldError = validationError ?? inputError;
  const fallbackInvalidCouponMessage =
    cart.coupon && !cart.coupon.isValid ? cart.coupon.message : null;
  const activeCoupon = cart.coupon?.isValid ? cart.coupon : null;
  const activeCouponSummaryLabel = (() => {
    if (!activeCoupon) {
      return null;
    }

    switch (activeCoupon.discountType) {
      case 'percent_order':
        return 'Kupon procentowy na całe zamówienie';
      case 'fixed_order':
        return 'Kupon kwotowy na całe zamówienie';
      case 'percent_product':
        return 'Kupon procentowy na wybrane produkty';
      case 'fixed_product':
        return 'Kupon kwotowy na wybrane produkty';
      default:
        return null;
    }
  })();
  const activeCouponProductNames = activeCoupon?.productKeys
    ? Array.from(
        new Set(
          cart.lines
            .filter((line) =>
              activeCoupon.productKeys?.includes(line.productKey),
            )
            .map((line) => line.productName),
        ),
      )
    : [];
  const visibleCouponProductNames = activeCouponProductNames.slice(0, 2);
  const hiddenCouponProductCount = Math.max(
    0,
    activeCouponProductNames.length - visibleCouponProductNames.length,
  );

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
          <div
            className={styles.couponChipWrapper}
            data-tooltip-visible={isCouponDetailsVisible}
            onMouseLeave={() => setIsCouponDetailsVisible(false)}
          >
            <div className={styles.couponChip}>
              <div
                className={styles.couponChipInfo}
                tabIndex={0}
                aria-describedby={couponDetailsId}
                onMouseEnter={() => setIsCouponDetailsVisible(true)}
                onFocus={() => setIsCouponDetailsVisible(true)}
                onBlur={() => setIsCouponDetailsVisible(false)}
              >
                <span className={styles.couponChipCode}>
                  {activeCoupon.code}
                </span>
              </div>
              <button
                type="button"
                className={styles.couponChipRemoveButton}
                onClick={handleClearCoupon}
                disabled={isCouponBusy}
                aria-label={`Usuń kod rabatowy ${activeCoupon.code}`}
              >
                <CloseIcon />
              </button>
            </div>

            <div
              id={couponDetailsId}
              role="tooltip"
              className={styles.couponChipTooltip}
              aria-hidden={!isCouponDetailsVisible}
              onMouseEnter={() => setIsCouponDetailsVisible(true)}
            >
              {activeCouponSummaryLabel ? (
                <p className={styles.couponChipTooltipHeading}>
                  {activeCouponSummaryLabel}
                </p>
              ) : null}
              {visibleCouponProductNames.length > 0 ? (
                <div className={styles.couponChipTooltipProducts}>
                  <span className={styles.couponChipTooltipLabel}>
                    Produkty
                  </span>
                  <ul
                    className={styles.couponChipTooltipList}
                    aria-label={`Produkty objęte kodem ${activeCoupon.code}`}
                  >
                    {visibleCouponProductNames.map((productName) => (
                      <li
                        key={productName}
                        className={styles.couponChipTooltipListItem}
                      >
                        {productName}
                      </li>
                    ))}
                    {hiddenCouponProductCount > 0 ? (
                      <li className={styles.couponChipTooltipListItem}>
                        +{hiddenCouponProductCount}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
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
