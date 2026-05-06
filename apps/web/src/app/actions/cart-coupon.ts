'use server';

import type {
  CartCouponDefinition,
} from '@/src/global/b2c/cart/types';
import {
  mapCouponRowToDefinition,
  normalizeCouponCode,
  type CouponDefinitionRow,
} from '@/src/global/b2c/utils/coupons';
import type { Database } from '@/src/global/supabase/database.types';
import { createClient as createServerClient } from '@/src/global/supabase/server';

type CouponRow = Pick<
  Database['public']['Tables']['coupons']['Row'],
  | 'id'
  | 'code'
  | 'is_active'
  | 'discount_type'
  | 'discount_value_cents'
  | 'discount_percent'
  | 'product_keys'
  | 'usage_limit'
  | 'usage_count'
  | 'starts_at'
  | 'expires_at'
> &
  CouponDefinitionRow;

export type LookupCouponDefinitionResult =
  | {
      status: 'found';
      coupon: CartCouponDefinition;
    }
  | {
      status: 'not_found';
      code: string;
      message: string;
    }
  | {
      status: 'error';
      code: string;
      message: string;
    };

const COUPON_LOOKUP_ERROR_MESSAGE =
  'Nie udało się zweryfikować kodu rabatowego. Spróbuj ponownie.';
export async function lookupCouponDefinition(
  code: string,
): Promise<LookupCouponDefinitionResult> {
  const normalizedCode = normalizeCouponCode(code);

  if (!normalizedCode) {
    return {
      status: 'error',
      code: '',
      message: 'Wpisz kod rabatowy.',
    };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('coupons')
      .select(
        `
          id,
          code,
          is_active,
          discount_type,
          discount_value_cents,
          discount_percent,
          product_keys,
          usage_limit,
          usage_count,
          starts_at,
          expires_at
        `,
      )
      .ilike('code', normalizedCode)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch coupon definition.', error);

      return {
        status: 'error',
        code: normalizedCode,
        message: COUPON_LOOKUP_ERROR_MESSAGE,
      };
    }

    if (!data) {
      return {
        status: 'not_found',
        code: normalizedCode,
        message: 'Kod rabatowy nie istnieje.',
      };
    }

    const coupon = mapCouponRowToDefinition(data, normalizedCode);

    if (!coupon) {
      console.error('Received malformed coupon definition.', {
        couponId: data.id,
        discountType: data.discount_type,
      });

      return {
        status: 'error',
        code: normalizedCode,
        message: COUPON_LOOKUP_ERROR_MESSAGE,
      };
    }

    return {
      status: 'found',
      coupon,
    };
  } catch (error) {
    console.error('Unexpected coupon lookup failure.', error);

    return {
      status: 'error',
      code: normalizedCode,
      message: COUPON_LOOKUP_ERROR_MESSAGE,
    };
  }
}
