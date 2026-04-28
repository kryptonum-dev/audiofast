'use server';

import { revalidatePath } from 'next/cache';

import {
  requestCustomerOrderReturn,
  type RequestCustomerOrderReturnResult,
} from '@/src/global/b2c/customer-auth/server/order-return';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

export type RequestCustomerOrderReturnActionInput = {
  orderNumber: string;
  reason?: string | null;
};

export type RequestCustomerOrderReturnActionResult =
  | {
      ok: true;
      value: Extract<
        RequestCustomerOrderReturnResult,
        { kind: 'created' | 'already_requested' }
      >;
    }
  | {
      ok: false;
      error:
        | Extract<
            RequestCustomerOrderReturnResult,
            { kind: 'not_eligible' | 'not_found' }
          >
        | {
            kind: 'unauthenticated';
          }
        | {
            kind: 'unexpected_error';
          };
    };

function revalidateCustomerOrderReturnViews(orderNumber: string) {
  revalidatePath('/konto-klienta/zamowienia/');
  revalidatePath(`/konto-klienta/zamowienia/${orderNumber}/`);
}

export async function requestCustomerOrderReturnAction({
  orderNumber,
  reason,
}: RequestCustomerOrderReturnActionInput): Promise<RequestCustomerOrderReturnActionResult> {
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    return {
      ok: false,
      error: { kind: 'unauthenticated' },
    };
  }

  try {
    const result = await requestCustomerOrderReturn({
      normalizedEmail: session.normalizedEmail,
      orderNumber,
      reason,
    });

    if (result.kind === 'created' || result.kind === 'already_requested') {
      revalidateCustomerOrderReturnViews(orderNumber);

      return {
        ok: true,
        value: result,
      };
    }

    return {
      ok: false,
      error: result,
    };
  } catch (error) {
    console.error('Failed to request customer order return.', error);

    return {
      ok: false,
      error: { kind: 'unexpected_error' },
    };
  }
}
