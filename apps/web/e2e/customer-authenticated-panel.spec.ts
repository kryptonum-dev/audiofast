import { expect, test } from '@playwright/test';

test.describe('authenticated customer panel', () => {
  test('opens the orders page with a stored Supabase session', async ({
    page,
  }) => {
    await page.goto('/konto-klienta/zamowienia/');

    await expect(page).toHaveURL(/\/konto-klienta\/zamowienia\/$/);
    await expect(
      page.getByRole('heading', { name: 'Zamówienia' }),
    ).toBeVisible();
    await expect(page.getByText('Lista zamówień przypisanych')).toBeVisible();
  });
});
