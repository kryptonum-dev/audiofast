import { expect, test } from '@playwright/test';

import { E2E_EMAIL_PREFIXES } from './constants';
import {
  buildE2eEmail,
  cleanupCheckoutData,
  createSupabaseAdminClient,
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
        await page.goto('/produkty/prestige/');

        await expect(
          page.getByRole('heading', {
            name: 'Artesania Audio Prestige',
            exact: true,
          }),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Dodaj do koszyka' }).click();
        await expect(
          page.getByRole('dialog', { name: 'Produkt został dodany' }),
        ).toBeVisible();
        await page.getByRole('link', { name: 'Przejdź do koszyka' }).click();
      });

      await test.step('move from cart to checkout', async () => {
        await expect(
          page.getByRole('heading', { name: 'Podsumowanie' }).first(),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Dalej' }).click();
        await expect(page).toHaveURL(/\/koszyk\/twoje-dane\/$/);
      });

      await test.step('submit checkout details', async () => {
        const checkoutForm = page.locator('#checkout-details-form');

        await checkoutForm.getByLabel('Imię', { exact: true }).fill('Ewa');
        await checkoutForm
          .getByLabel('Nazwisko', { exact: true })
          .fill('Testowa');
        await checkoutForm
          .getByLabel('Telefon', { exact: true })
          .fill('500 600 700');
        await checkoutForm
          .getByLabel('Adres e-mail', { exact: true })
          .fill(email);

        await checkoutForm
          .getByLabel('Kod pocztowy', { exact: true })
          .fill('00-001');
        await checkoutForm
          .getByLabel('Miejscowość', { exact: true })
          .fill('Warszawa');
        await checkoutForm
          .getByLabel('Ulica', { exact: true })
          .fill('Testowa');
        await checkoutForm
          .getByLabel('Numer domu', { exact: true })
          .fill('1');

        await checkoutForm
          .locator('label')
          .filter({ hasText: 'Akceptuję' })
          .click({ position: { x: 12, y: 12 } });
        await page
          .getByRole('button', { name: 'Przejdź do płatności' })
          .click();
      });

      await test.step('confirm paid thank-you state', async () => {
        await expect(page).toHaveURL(/\/podziekowania-za-zakup\/[^/]+\/$/);
        await expect(
          page.getByRole('heading', {
            name: 'Dziękujemy za złożenie zamówienia',
          }),
        ).toBeVisible();
        await expect(page.getByText(/Numer zamówienia:/)).toBeVisible();
      });

      await test.step('assert the paid order exists in Supabase', async () => {
        const supabase = createSupabaseAdminClient();

        await expect
          .poll(async () => {
            const { data, error } = await supabase
              .from('orders')
              .select('id, customer_email, current_status, grand_total_cents')
              .eq('customer_email', email)
              .maybeSingle();

            if (error) {
              throw error;
            }

            return data;
          })
          .toMatchObject({
            customer_email: email,
            current_status: 'paid',
          });

        const { data: order, error } = await supabase
          .from('orders')
          .select('grand_total_cents')
          .eq('customer_email', email)
          .maybeSingle();

        if (error) {
          throw error;
        }

        expect(order?.grand_total_cents).toBeGreaterThan(0);
      });
    } finally {
      await cleanupCheckoutData(email);
    }
  });
});
