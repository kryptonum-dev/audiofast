import { expect, test } from "@playwright/test";
import { createClient } from "@sanity/client";

import { E2E_EMAIL_PREFIXES } from "./constants";
import {
  acceptCheckoutRequiredConsents,
  assertPaidOrderByEmail,
  buildE2eEmail,
  cleanupCheckoutData,
  fillCheckoutDetails,
  goFromCartToCheckout,
  submitCheckoutPayment,
} from "./utils";

type AvailableCpoProduct = {
  name: string;
  brandName: string | null;
  priceCents: number;
  slug: string;
};

async function findAvailableCpoProduct() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

  if (!projectId || !dataset) {
    throw new Error(
      "Missing Sanity E2E env. Set NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET.",
    );
  }

  const sanity = createClient({
    projectId,
    dataset,
    apiVersion: "2025-01-01",
    useCdn: false,
  });

  return sanity.fetch<AvailableCpoProduct | null>(
    `*[
      _type == "cpoProduct"
      && isArchived != true
      && isSellableOnline == true
      && availabilityStatus == "available"
      && priceCents > 0
    ][0]{
      name,
      brandName,
      priceCents,
      "slug": slug.current
    }`,
  );
}

test.describe("CPO purchase path", () => {
  test("buys an available CPO product when Sanity exposes one", async ({
    page,
  }, testInfo) => {
    const product = await findAvailableCpoProduct();

    if (!product) {
      test.skip(
        true,
        "No buyable CPO product exists in Sanity right now. This test will run automatically once Sanity has an available sellable CPO item.",
      );
      return;
    }

    const email = buildE2eEmail({
      prefix: E2E_EMAIL_PREFIXES.cpoCheckout,
      parallelIndex: testInfo.parallelIndex,
    });

    await cleanupCheckoutData(email);

    try {
      await page.goto(`/certyfikowany-sprzet-uzywany/${product.slug}/`);

      await expect(
        page.getByRole("heading", { name: new RegExp(product.name, "i") }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
      await expect(
        page.getByRole("dialog", { name: "Produkt został dodany" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Kontynuuj zakupy" }).click();
      await expect(
        page.getByRole("button", { name: "Usuń z koszyka" }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Usuń z koszyka" }).click();
      await expect(
        page.getByRole("button", { name: "Dodaj do koszyka" }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
      await page.getByRole("link", { name: "Przejdź do koszyka" }).click();

      await expect(page.getByText("Egzemplarz CPO")).toBeVisible();
      await expect(page.getByText(product.name)).toBeVisible();

      await goFromCartToCheckout(page);
      await fillCheckoutDetails(page, { email });
      await acceptCheckoutRequiredConsents(page);
      await submitCheckoutPayment(page);

      await expect(page).toHaveURL(/\/podziekowania-za-zakup\/[^/]+\/$/);
      await assertPaidOrderByEmail(email);
    } finally {
      await cleanupCheckoutData(email);
    }
  });
});
