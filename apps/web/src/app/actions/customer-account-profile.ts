'use server';

import { revalidatePath } from 'next/cache';

import type { CustomerAccountProfileSubmitInput } from '@/src/global/b2c/customer-auth/account-profile-form';
import {
  updateCustomerAccountProfile,
  type UpdateCustomerAccountProfileResult,
} from '@/src/global/b2c/customer-auth/server/customer-account-profile';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

export type UpdateCustomerAccountProfileActionInput =
  CustomerAccountProfileSubmitInput;

export type UpdateCustomerAccountProfileActionResult =
  | {
      ok: true;
      value: Extract<UpdateCustomerAccountProfileResult, { kind: 'updated' }>;
    }
  | {
      ok: false;
      error:
        | Extract<
            UpdateCustomerAccountProfileResult,
            { kind: 'validation_error' | 'not_found' | 'ownership_mismatch' }
          >
        | {
            kind: 'unauthenticated';
          }
        | {
            kind: 'unexpected_error';
          };
    };

function revalidateCustomerAccountProfileViews() {
  revalidatePath('/konto-klienta/dane-konta/');
}

export async function updateCustomerAccountProfileAction(
  input: UpdateCustomerAccountProfileActionInput,
): Promise<UpdateCustomerAccountProfileActionResult> {
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    return {
      ok: false,
      error: { kind: 'unauthenticated' },
    };
  }

  try {
    const result = await updateCustomerAccountProfile({
      authUserId: session.authUser.id,
      input,
      normalizedEmail: session.normalizedEmail,
    });

    if (result.kind === 'updated') {
      revalidateCustomerAccountProfileViews();

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
    console.error('Failed to update customer account profile.', error);

    return {
      ok: false,
      error: { kind: 'unexpected_error' },
    };
  }
}
