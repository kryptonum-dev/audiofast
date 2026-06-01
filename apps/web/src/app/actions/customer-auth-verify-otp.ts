'use server';

import type { CustomerAuthVerifyOtpResult } from '@/src/global/b2c/customer-auth/server/types';
import { verifyCustomerAuthOtp } from '@/src/global/b2c/customer-auth/server/verify-otp';

export async function verifyCustomerAuthOtpAction(args: {
  email: string;
  code: string;
}): Promise<CustomerAuthVerifyOtpResult> {
  return verifyCustomerAuthOtp(args);
}
