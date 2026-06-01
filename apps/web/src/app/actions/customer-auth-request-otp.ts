'use server';

import { requestCustomerAuthOtp } from '@/src/global/b2c/customer-auth/server/request-otp';
import type { CustomerAuthRequestOtpResult } from '@/src/global/b2c/customer-auth/server/types';

export async function requestCustomerAuthOtpAction(
  email: string,
): Promise<CustomerAuthRequestOtpResult> {
  return requestCustomerAuthOtp({
    email,
  });
}
