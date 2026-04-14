import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import type { CartState } from '@/src/global/b2c/cart/types';

import styles from './styles.module.scss';

type CouponFormValues = {
  code: string;
};

type CartCouponCardProps = {
  cart: CartState;
  onApplyCoupon: (code: string) => void;
  onClearCoupon: () => void;
};

export default function CartCouponCard({
  cart,
  onApplyCoupon,
  onClearCoupon,
}: CartCouponCardProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CouponFormValues>({
    defaultValues: {
      code: cart.coupon?.code ?? '',
    },
  });

  useEffect(() => {
    reset({
      code: cart.coupon?.code ?? '',
    });
  }, [cart.coupon?.code, reset]);

  const handleApplyCoupon = ({ code }: CouponFormValues) => {
    const nextCode = code.trim();

    onApplyCoupon(nextCode);
  };

  const handleClearCoupon = () => {
    reset({
      code: '',
    });
    onClearCoupon();
  };

  const couponMessage = cart.coupon
    ? cart.coupon.isValid
      ? 'Kod został zastosowany.'
      : cart.coupon.message
    : 'Możesz użyć jednego kodu rabatowego na zamówienie.';

  return (
    <section className={styles.sidebarCard}>
      <h2 className={styles.sidebarHeading}>Kod rabatowy</h2>

      <form
        className={styles.couponForm}
        onSubmit={handleSubmit(handleApplyCoupon)}
      >
        <div className={styles.couponField}>
          <Input
            name="code"
            placeholder="Wpisz kod"
            register={register('code', {
              required: {
                value: true,
                message: 'Wpisz kod rabatowy.',
              },
              validate: (value) =>
                value.trim().length > 0 || 'Wpisz kod rabatowy.',
            })}
            errors={errors.code?.message ?? ''}
          />
        </div>

        <div className={styles.couponActions}>
          <Button
            type="submit"
            text="Zastosuj"
            variant="secondary"
            iconUsed="submit"
            className={styles.couponButton}
          />

          {cart.coupon ? (
            <button
              type="button"
              className={styles.textAction}
              onClick={handleClearCoupon}
              aria-label="Usuń kod rabatowy"
            >
              Usuń kod rabatowy
            </button>
          ) : null}
        </div>
      </form>

      {couponMessage ? (
        <p
          className={styles.couponMessage}
          data-valid={cart.coupon?.isValid ?? false}
        >
          {couponMessage}
        </p>
      ) : null}
    </section>
  );
}
