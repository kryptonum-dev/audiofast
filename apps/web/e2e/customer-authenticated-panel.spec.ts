import { expect, test } from "@playwright/test";

import { readCustomerAuthSeedMetadata } from "./utils";

test.describe("authenticated customer panel", () => {
  test("shows the seeded paid order in the list and detail page", async ({
    page,
  }) => {
    const seededOrder = await readCustomerAuthSeedMetadata();

    await page.goto("/konto-klienta/zamowienia/");

    await expect(page).toHaveURL(/\/konto-klienta\/zamowienia\/$/);
    await expect(
      page.getByRole("heading", { name: "Zamówienia" }),
    ).toBeVisible();
    await expect(page.getByText("Lista zamówień przypisanych")).toBeVisible();
    await expect(
      page.getByText(`Zamówienie ${seededOrder.orderNumber}`),
    ).toBeVisible();
    const seededOrderCard = page.getByRole("link", {
      name: `Zobacz szczegóły zamówienia ${seededOrder.orderNumber}`,
    });

    await expect(seededOrderCard).toContainText("Artesania Audio Prestige");

    await seededOrderCard.click();

    await expect(page).toHaveURL(
      new RegExp(`/konto-klienta/zamowienia/${seededOrder.orderNumber}/$`),
    );
    await expect(
      page.getByRole("heading", {
        name: `Zamówienie ${seededOrder.orderNumber}`,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Podsumowanie zamówienia")).toContainText(
      "Status płatności",
    );
    await expect(page.getByRole("heading", { name: "Produkty" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prestige" })).toBeVisible();
  });
});
