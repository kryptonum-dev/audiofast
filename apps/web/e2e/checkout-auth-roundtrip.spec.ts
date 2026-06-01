import { expect, test } from "@playwright/test";

import { E2E_CUSTOMER_AUTH_EMAIL } from "./constants";
import {
  authenticateE2eCustomer,
  preparePrestigeCheckout,
  readCustomerAuthSeedMetadata,
} from "./utils";

test.describe("customer auth roundtrips", () => {
  test("returns a logged-out customer to the protected order detail after login", async ({
    page,
  }) => {
    const seededOrder = await readCustomerAuthSeedMetadata();
    const detailPath = `/konto-klienta/zamowienia/${seededOrder.orderNumber}/`;

    await page.goto(detailPath);

    await expect(page).toHaveURL(
      new RegExp(
        `/konto-klienta/\\?returnTo=${encodeURIComponent(detailPath)}`,
      ),
    );
    await expect(
      page.getByRole("heading", { name: "Logowanie do konta" }),
    ).toBeVisible();

    await authenticateE2eCustomer(page, {
      email: E2E_CUSTOMER_AUTH_EMAIL,
      returnTo: detailPath,
    });

    await expect(page).toHaveURL(
      new RegExp(`/konto-klienta/zamowienia/${seededOrder.orderNumber}/$`),
    );
    await expect(
      page.getByRole("heading", {
        name: `Zamówienie ${seededOrder.orderNumber}`,
      }),
    ).toBeVisible();
  });

  test("keeps the cart when a checkout customer logs in from the checkout page", async ({
    page,
  }) => {
    await preparePrestigeCheckout(page);

    const checkoutForm = page.locator("#checkout-details-form");
    const loginLink = page.getByRole("link", {
      name: /Masz już konto\? Zaloguj się/i,
    });

    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute(
      "href",
      /\/konto-klienta\/?\?returnTo=%2Fkoszyk%2Ftwoje-dane%2F/,
    );

    await loginLink.click();
    await expect(
      page.getByRole("heading", { name: "Logowanie do konta" }),
    ).toBeVisible();

    await authenticateE2eCustomer(page, {
      email: E2E_CUSTOMER_AUTH_EMAIL,
      returnTo: "/koszyk/twoje-dane/",
    });

    await expect(page).toHaveURL(/\/koszyk\/twoje-dane\/$/);
    await expect(
      page.getByRole("heading", { name: "Koszyk (1)" }),
    ).toBeVisible();
    await expect(page.getByText("Prestige").first()).toBeVisible();
    await expect(
      checkoutForm.getByLabel("Adres e-mail", { exact: true }),
    ).toHaveValue(E2E_CUSTOMER_AUTH_EMAIL);
    await expect(
      checkoutForm.getByLabel("Adres e-mail", { exact: true }),
    ).not.toBeEditable();
    await expect(
      page.getByRole("link", { name: /Masz już konto\? Zaloguj się/i }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Zapisz te dane do kolejnych zamówień"),
    ).toBeVisible();
    await expect(
      page.getByLabel(/Wyrażam zgodę na przetwarzanie moich danych osobowych/),
    ).toHaveCount(0);
  });
});
