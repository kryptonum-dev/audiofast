import { expect, test } from "@playwright/test";

import { E2E_EMAIL_PREFIXES } from "./constants";
import {
  acceptCheckoutRequiredConsents,
  assertPaidOrderByEmail,
  buildE2eEmail,
  cleanupCheckoutData,
  fillCheckoutDetails,
  preparePrestigeCheckout,
  readSingleStoredCartLine,
  submitCheckoutPayment,
  updatePricingVariantBasePrice,
} from "./utils";

test.describe("cart revalidation drift", () => {
  test("blocks first checkout submit when product pricing changes, then accepts refreshed totals", async ({
    page,
  }, testInfo) => {
    const email = buildE2eEmail({
      prefix: E2E_EMAIL_PREFIXES.priceDrift,
      parallelIndex: testInfo.parallelIndex,
    });
    let variantId: string | null = null;
    let originalBasePriceCents: number | null = null;

    await cleanupCheckoutData(email);

    try {
      await preparePrestigeCheckout(page);

      const line = await readSingleStoredCartLine(page);
      variantId = line.configurationSelection?.variantId ?? null;
      originalBasePriceCents = line.unitPriceCents;

      if (!variantId || originalBasePriceCents === null) {
        throw new Error("Prestige cart line did not expose variant pricing.");
      }

      await fillCheckoutDetails(page, { email });
      await acceptCheckoutRequiredConsents(page);

      await updatePricingVariantBasePrice(
        variantId,
        originalBasePriceCents + 1234,
      );

      await submitCheckoutPayment(page);

      await expect(page.getByText("Ceny zostały zaktualizowane")).toBeVisible();
      await expect(page).toHaveURL(/\/koszyk\/twoje-dane\/$/);

      await submitCheckoutPayment(page);

      await expect(page).toHaveURL(/\/podziekowania-za-zakup\/[^/]+\/$/);
      await assertPaidOrderByEmail(email);
    } finally {
      if (variantId && originalBasePriceCents !== null) {
        await updatePricingVariantBasePrice(variantId, originalBasePriceCents);
      }

      await cleanupCheckoutData(email);
    }
  });
});
