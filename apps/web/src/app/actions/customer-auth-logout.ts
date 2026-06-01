'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createAuthServerClient } from '@/src/global/supabase/server-auth';

export async function logoutCustomerAuthAction() {
  try {
    const supabase = await createAuthServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Failed to sign out customer auth session.', error);
    }
  } catch (error) {
    console.error('Unexpected customer auth logout failure.', error);
  }

  revalidatePath('/koszyk/twoje-dane');
  revalidatePath('/konto-klienta');
  redirect('/konto-klienta/');
}
