import { expect, test } from "@playwright/test";

import {
  acceptCheckoutRequiredConsents,
  preparePrestigeCheckout,
  readCustomerAuthSeedMetadata,
  readCustomerProfileByEmail,
  submitCheckoutPayment,
} from "./utils";

test.describe("authenticated checkout", () => {
  test("prefills customer defaults and saves updated defaults for later orders", async ({
    page,
  }) => {
    const seededOrder = await readCustomerAuthSeedMetadata();
    const checkoutForm = page.locator("#checkout-details-form");
    const updatedDefaults = {
      firstName: "Adam",
      lastName: "Profilowy",
      phone: "501502503",
      postalCode: "11-111",
      city: "Krakow",
      streetName: "Zapisana",
      buildingNumber: "12",
      apartmentNumber: "8",
    };

    await test.step("open checkout as the authenticated seeded customer", async () => {
      await preparePrestigeCheckout(page);

      await expect(
        checkoutForm.getByLabel("Adres e-mail", { exact: true }),
      ).toHaveValue(seededOrder.email);
      await expect(
        checkoutForm.getByLabel("Adres e-mail", { exact: true }),
      ).not.toBeEditable();
      await expect(
        checkoutForm.getByLabel("Imię", { exact: true }),
      ).toHaveValue(seededOrder.firstName);
      await expect(
        checkoutForm.getByLabel("Nazwisko", { exact: true }),
      ).toHaveValue(seededOrder.lastName);
      await expect(
        checkoutForm.getByLabel("Telefon", { exact: true }),
      ).toHaveValue(seededOrder.phone);
      await expect(
        checkoutForm.getByLabel("Ulica", { exact: true }),
      ).toHaveValue(seededOrder.shippingAddress.streetName);
      await expect(
        page.getByText("Zapisz te dane do kolejnych zamówień"),
      ).toBeVisible();
    });

    await test.step("submit changed details with profile persistence enabled", async () => {
      await checkoutForm
        .getByLabel("Imię", { exact: true })
        .fill(updatedDefaults.firstName);
      await checkoutForm
        .getByLabel("Nazwisko", { exact: true })
        .fill(updatedDefaults.lastName);
      await checkoutForm
        .getByLabel("Telefon", { exact: true })
        .fill(updatedDefaults.phone);
      await checkoutForm
        .getByLabel("Kod pocztowy", { exact: true })
        .fill(updatedDefaults.postalCode);
      await checkoutForm
        .getByLabel("Miejscowość", { exact: true })
        .fill(updatedDefaults.city);
      await checkoutForm
        .getByLabel("Ulica", { exact: true })
        .fill(updatedDefaults.streetName);
      await checkoutForm
        .getByLabel("Numer domu", { exact: true })
        .fill(updatedDefaults.buildingNumber);
      await checkoutForm
        .getByLabel("Numer mieszkania (opcjonalnie)", { exact: true })
        .fill(updatedDefaults.apartmentNumber);

      await page
        .locator("#checkout-details-form label")
        .filter({ hasText: "Zapisz te dane do kolejnych zamówień" })
        .click({ position: { x: 12, y: 12 } });
      await acceptCheckoutRequiredConsents(page);
      await submitCheckoutPayment(page);

      await expect(page).toHaveURL(/\/podziekowania-za-zakup\/[^/]+\/$/);
      await expect(
        page.getByRole("heading", {
          name: "Dziękujemy za złożenie zamówienia",
        }),
      ).toBeVisible();
    });

    await test.step("assert the customer profile was updated in Supabase", async () => {
      await expect
        .poll(async () => {
          const profile = await readCustomerProfileByEmail(seededOrder.email);
          return {
            firstName: profile.first_name,
            lastName: profile.last_name,
            phone: profile.phone,
            shippingAddress: profile.default_shipping_address,
          };
        })
        .toMatchObject({
          firstName: updatedDefaults.firstName,
          lastName: updatedDefaults.lastName,
          phone: updatedDefaults.phone,
          shippingAddress: {
            firstName: updatedDefaults.firstName,
            lastName: updatedDefaults.lastName,
            phone: updatedDefaults.phone,
            postalCode: updatedDefaults.postalCode,
            city: updatedDefaults.city,
            streetName: updatedDefaults.streetName,
            buildingNumber: updatedDefaults.buildingNumber,
            apartmentNumber: updatedDefaults.apartmentNumber,
            country: "PL",
          },
        });
    });

    await test.step("open a later checkout and verify the updated defaults prefill", async () => {
      await preparePrestigeCheckout(page);

      await expect(
        checkoutForm.getByLabel("Adres e-mail", { exact: true }),
      ).toHaveValue(seededOrder.email);
      await expect(
        checkoutForm.getByLabel("Imię", { exact: true }),
      ).toHaveValue(updatedDefaults.firstName);
      await expect(
        checkoutForm.getByLabel("Nazwisko", { exact: true }),
      ).toHaveValue(updatedDefaults.lastName);
      await expect(
        checkoutForm.getByLabel("Telefon", { exact: true }),
      ).toHaveValue(updatedDefaults.phone);
      await expect(
        checkoutForm.getByLabel("Kod pocztowy", { exact: true }),
      ).toHaveValue(updatedDefaults.postalCode);
      await expect(
        checkoutForm.getByLabel("Miejscowość", { exact: true }),
      ).toHaveValue(updatedDefaults.city);
      await expect(
        checkoutForm.getByLabel("Ulica", { exact: true }),
      ).toHaveValue(updatedDefaults.streetName);
      await expect(
        checkoutForm.getByLabel("Numer domu", { exact: true }),
      ).toHaveValue(updatedDefaults.buildingNumber);
      await expect(
        checkoutForm.getByLabel("Numer mieszkania (opcjonalnie)", {
          exact: true,
        }),
      ).toHaveValue(updatedDefaults.apartmentNumber);
    });
  });
});
