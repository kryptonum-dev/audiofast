'use server';

import { revalidatePath } from 'next/cache';

import {
  requestCustomerOrderCancellation,
  type RequestCustomerOrderCancellationResult,
} from '@/src/global/b2c/customer-auth/server/order-cancellation';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

export type RequestCustomerOrderCancellationActionInput = {
  orderNumber: string;
  reason?: string | null;
  customerMessage?: string | null;
};

export type RequestCustomerOrderCancellationActionResult =
  | {
      ok: true;
      value: Extract<
        RequestCustomerOrderCancellationResult,
        { kind: 'created' | 'already_requested' }
      >;
    }
  | {
      ok: false;
      error:
        | Extract<
            RequestCustomerOrderCancellationResult,
            { kind: 'not_eligible' | 'not_found' }
          >
        | {
            kind: 'unauthenticated';
          }
        | {
            kind: 'unexpected_error';
          };
    };

function revalidateCustomerOrderCancellationViews(orderNumber: string) {
  revalidatePath('/konto-klienta/zamowienia/');
  revalidatePath(`/konto-klienta/zamowienia/${orderNumber}/`);
}

export async function requestCustomerOrderCancellationAction({
  customerMessage,
  orderNumber,
  reason,
}: RequestCustomerOrderCancellationActionInput): Promise<RequestCustomerOrderCancellationActionResult> {
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    return {
      ok: false,
      error: { kind: 'unauthenticated' },
    };
  }

  try {
    const result = await requestCustomerOrderCancellation({
      customerMessage,
      normalizedEmail: session.normalizedEmail,
      orderNumber,
      reason,
    });

    if (result.kind === 'created' || result.kind === 'already_requested') {
      revalidateCustomerOrderCancellationViews(orderNumber);

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
    console.error('Failed to request customer order cancellation.', error);

    return {
      ok: false,
      error: { kind: 'unexpected_error' },
    };
  }
}
