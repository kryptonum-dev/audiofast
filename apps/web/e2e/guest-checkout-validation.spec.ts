import { expect, test } from "@playwright/test";

import { E2E_EMAIL_PREFIXES } from "./constants";
import {
  buildE2eEmail,
  cleanupCheckoutData,
  countCheckoutOrdersByEmail,
  preparePrestigeCheckout,
} from "./utils";

test.describe("guest checkout validation", () => {
  test("blocks incomplete checkout details without creating an order", async ({
    page,
  }, testInfo) => {
    const email = buildE2eEmail({
      prefix: E2E_EMAIL_PREFIXES.checkoutValidation,
      parallelIndex: testInfo.parallelIndex,
    });

    await cleanupCheckoutData(email);

    try {
      await test.step("prepare a cart with the Prestige product", async () => {
        await preparePrestigeCheckout(page);
      });

      await test.step("submit only the email field", async () => {
        const checkoutForm = page.locator("#checkout-details-form");

        await checkoutForm
          .getByLabel("Adres e-mail", { exact: true })
          .fill(email);
        await page
          .getByRole("button", { name: "Przejdź do płatności" })
          .click();
      });

      await test.step("show validation errors and stay on checkout", async () => {
        await expect(page).toHaveURL(/\/koszyk\/twoje-dane\/$/);
        await expect(page.getByText("Podaj imię.")).toBeVisible();
        await expect(page.getByText("Podaj nazwisko.")).toBeVisible();
        await expect(page.getByText("Podaj numer telefonu.")).toBeVisible();
        await expect(page.getByText("Podaj kod pocztowy.")).toBeVisible();
        await expect(page.getByText("Podaj miejscowość.")).toBeVisible();
        await expect(page.getByText("Podaj nazwę ulicy.")).toBeVisible();
        await expect(page.getByText("Podaj numer domu.")).toBeVisible();
        await expect(
          page.getByText(
            "Musisz zaakceptować regulamin i politykę prywatności.",
          ),
        ).toBeVisible();
      });

      await test.step("assert no order was created", async () => {
        await expect.poll(() => countCheckoutOrdersByEmail(email)).toBe(0);
      });
    } finally {
      await cleanupCheckoutData(email);
    }
  });
});
