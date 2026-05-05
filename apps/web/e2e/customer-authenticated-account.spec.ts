import { expect, test } from "@playwright/test";

import {
  preparePrestigeCheckout,
  readCustomerAuthSeedMetadata,
  readCustomerProfileByEmail,
  resetCustomerProfileFromSeed,
} from "./utils";

test.describe("authenticated account details", () => {
  test("saves future checkout defaults without changing historical order snapshots", async ({
    page,
  }) => {
    const seed = await readCustomerAuthSeedMetadata();
    const updatedDefaults = {
      firstName: "Karol",
      lastName: "Konto",
      phone: "502503504",
      postalCode: "22-222",
      city: "Gdansk",
      streetName: "Profilowa",
      buildingNumber: "22",
      apartmentNumber: "4",
      companyName: "Audiofast E2E Sp. z o.o.",
      taxId: "1234567890",
    };

    await resetCustomerProfileFromSeed(seed);
    await page.goto("/konto-klienta/dane-konta/");

    const form = page.getByRole("form", { name: "Formularz danych konta" });

    await expect(
      page.getByRole("heading", { name: "Dane konta" }),
    ).toBeVisible();
    await form
      .getByLabel("Imię", { exact: true })
      .fill(updatedDefaults.firstName);
    await form
      .getByLabel("Nazwisko", { exact: true })
      .fill(updatedDefaults.lastName);
    await form
      .getByLabel("Telefon", { exact: true })
      .fill(updatedDefaults.phone);
    await form
      .getByLabel("Kod pocztowy", { exact: true })
      .fill(updatedDefaults.postalCode);
    await form
      .getByLabel("Miejscowość", { exact: true })
      .fill(updatedDefaults.city);
    await form
      .getByLabel("Ulica", { exact: true })
      .fill(updatedDefaults.streetName);
    await form
      .getByLabel("Numer domu", { exact: true })
      .fill(updatedDefaults.buildingNumber);
    await form
      .getByLabel("Numer mieszkania (opcjonalnie)", { exact: true })
      .fill(updatedDefaults.apartmentNumber);
    await form.getByText("Firma", { exact: true }).click();
    await form
      .getByLabel("Nazwa firmy", { exact: true })
      .fill(updatedDefaults.companyName);
    await form.getByLabel("NIP", { exact: true }).fill(updatedDefaults.taxId);

    await form.getByRole("button", { name: "Zapisz dane konta" }).click();

    await expect
      .poll(async () => {
        const profile = await readCustomerProfileByEmail(seed.email);
        return {
          firstName: profile.first_name,
          lastName: profile.last_name,
          phone: profile.phone,
          shippingAddress: profile.default_shipping_address,
          invoiceData: profile.default_invoice_data,
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
        },
        invoiceData: {
          recipientType: "company",
          companyName: updatedDefaults.companyName,
          taxId: updatedDefaults.taxId,
        },
      });

    await page.goto(`/konto-klienta/zamowienia/${seed.orderNumber}/`);
    await expect(
      page.getByText(`${seed.firstName} ${seed.lastName}`).first(),
    ).toBeVisible();
    await expect(
      page.getByText(seed.shippingAddress.streetName).first(),
    ).toBeVisible();
    await expect(page.getByText(updatedDefaults.streetName)).toHaveCount(0);

    await preparePrestigeCheckout(page);

    const checkoutForm = page.locator("#checkout-details-form");

    await expect(checkoutForm.getByLabel("Imię", { exact: true })).toHaveValue(
      updatedDefaults.firstName,
    );
    await expect(
      checkoutForm.getByLabel("Nazwisko", { exact: true }),
    ).toHaveValue(updatedDefaults.lastName);
    await expect(
      checkoutForm.getByLabel("Telefon", { exact: true }),
    ).toHaveValue(updatedDefaults.phone);
    await expect(
      checkoutForm.locator('input[name="shippingAddress.postalCode"]'),
    ).toHaveValue(updatedDefaults.postalCode);
    await expect(
      checkoutForm.locator('input[name="shippingAddress.city"]'),
    ).toHaveValue(updatedDefaults.city);
    await expect(
      checkoutForm.locator('input[name="shippingAddress.streetName"]'),
    ).toHaveValue(updatedDefaults.streetName);
    await expect(
      checkoutForm.locator('input[name="shippingAddress.buildingNumber"]'),
    ).toHaveValue(updatedDefaults.buildingNumber);
  });
});
