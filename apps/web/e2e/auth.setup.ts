import { expect, test as setup } from "@playwright/test";
import { dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import {
  E2E_CUSTOMER_AUTH_EMAIL,
  E2E_CUSTOMER_AUTH_SEED_PATH,
  E2E_CUSTOMER_AUTH_STATE_PATH,
} from "./constants";
import {
  authenticateE2eCustomer,
  cleanupCheckoutData,
  seedPaidOrderForCustomerEmail,
} from "./utils";

setup("authenticate customer panel user", async ({ page }) => {
  await mkdir(dirname(E2E_CUSTOMER_AUTH_STATE_PATH), { recursive: true });
  await cleanupCheckoutData(E2E_CUSTOMER_AUTH_EMAIL);
  const seededOrder = await seedPaidOrderForCustomerEmail(
    E2E_CUSTOMER_AUTH_EMAIL,
  );
  await writeFile(
    E2E_CUSTOMER_AUTH_SEED_PATH,
    `${JSON.stringify(seededOrder, null, 2)}\n`,
  );

  await authenticateE2eCustomer(page, {
    email: E2E_CUSTOMER_AUTH_EMAIL,
    returnTo: "/konto-klienta/zamowienia/",
  });
  await expect(page).toHaveURL(/\/konto-klienta\/zamowienia\/$/);
  await expect(page.getByRole("heading", { name: "Zamówienia" })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: `Zobacz szczegóły zamówienia ${seededOrder.orderNumber}`,
    }),
  ).toBeVisible();

  await page.context().storageState({ path: E2E_CUSTOMER_AUTH_STATE_PATH });
});
