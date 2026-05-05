import { expect, test as setup } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

import {
  E2E_CUSTOMER_AUTH_EMAIL,
  E2E_CUSTOMER_AUTH_STATE_PATH,
} from './constants';

setup('authenticate customer panel user', async ({ page }) => {
  const authSecret = process.env.E2E_AUTH_HELPER_SECRET;

  if (!authSecret) {
    throw new Error(
      'Missing E2E_AUTH_HELPER_SECRET. Set it in .env.e2e.local before running authenticated E2E tests.',
    );
  }

  await mkdir(dirname(E2E_CUSTOMER_AUTH_STATE_PATH), { recursive: true });
  await page.setExtraHTTPHeaders({
    'x-e2e-auth-secret': authSecret,
  });

  const authUrl = new URL('/api/e2e/customer-auth', 'http://localhost');
  authUrl.searchParams.set('email', E2E_CUSTOMER_AUTH_EMAIL);
  authUrl.searchParams.set('returnTo', '/konto-klienta/zamowienia/');

  await page.goto(`${authUrl.pathname}${authUrl.search}`);
  await expect(page).toHaveURL(/\/konto-klienta\/zamowienia\/$/);
  await expect(
    page.getByRole('heading', { name: 'Zamówienia' }),
  ).toBeVisible();

  await page.context().storageState({ path: E2E_CUSTOMER_AUTH_STATE_PATH });
});
