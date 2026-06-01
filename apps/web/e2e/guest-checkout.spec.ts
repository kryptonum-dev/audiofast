import { expect, test } from '@playwright/test';

import { E2E_EMAIL_PREFIXES } from './constants';
import {
  acceptCheckoutRequiredConsents,
  assertPaidOrderByEmail,
  assertPersistedCartIsEmpty,
  buildE2eEmail,
  cleanupCheckoutData,
  fillCheckoutDetails,
  preparePrestigeCheckout,
  submitCheckoutPayment,
} from './utils';

test.describe('guest checkout', () => {
  test('buys the Prestige product and reaches the paid thank-you page', async ({
    page,
  }, testInfo) => {
    const email = buildE2eEmail({
      prefix: E2E_EMAIL_PREFIXES.guestCheckout,
      parallelIndex: testInfo.parallelIndex,
    });

    await cleanupCheckoutData(email);

    try {
      await test.step('add the Prestige product to the cart', async () => {
        await preparePrestigeCheckout(page);
      });

      await test.step('submit checkout details', async () => {
        await fillCheckoutDetails(page, { email });
        await acceptCheckoutRequiredConsents(page);
        await submitCheckoutPayment(page);
      });

      await test.step('confirm paid thank-you state', async () => {
        await expect(page).toHaveURL(/\/podziekowania-za-zakup\/[^/]+\/$/);
        await expect(
          page.getByRole('heading', {
            name: 'Dziękujemy za złożenie zamówienia',
          }),
        ).toBeVisible();
        await expect(page.getByText(/Numer zamówienia:/)).toBeVisible();
        await assertPersistedCartIsEmpty(page);
      });

      await test.step('assert the paid order exists in Supabase', async () => {
        await assertPaidOrderByEmail(email);
      });
    } finally {
      await cleanupCheckoutData(email);
    }
  });
});
