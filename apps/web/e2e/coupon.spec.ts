import { expect, test } from "@playwright/test";

import { E2E_EMAIL_PREFIXES } from "./constants";
import {
  acceptCheckoutRequiredConsents,
  buildE2eEmail,
  cleanupCheckoutData,
  cleanupCouponByCode,
  fillCheckoutDetails,
  preparePrestigeCheckout,
  readLatestOrderByEmail,
  seedFixedOrderCoupon,
  setCouponActive,
  submitCheckoutPayment,
} from "./utils";

test.describe("cart coupons", () => {
  test("applies a valid coupon and persists the discount on the paid order", async ({
    page,
  }, testInfo) => {
    const email = buildE2eEmail({
      prefix: E2E_EMAIL_PREFIXES.couponCheckout,
      parallelIndex: testInfo.parallelIndex,
    });
    const couponCode = `P1-${Date.now().toString(36).toUpperCase()}`;

    await cleanupCheckoutData(email);
    await seedFixedOrderCoupon({
      code: couponCode,
      discountValueCents: 5000,
    });

    try {
      await preparePrestigeCheckout(page);
      await page.getByRole("link", { name: "Zmień koszyk" }).click();

      await page.getByPlaceholder("Wpisz kod").fill(couponCode);
      await page.getByRole("button", { name: "Zastosuj" }).click();

      await expect(page.getByText(couponCode, { exact: true })).toBeVisible();
      await expect(
        page.getByText("Rabat", { exact: true }).first(),
      ).toBeVisible();

      await page.getByRole("button", { name: "Dalej" }).click();
      await expect(page).toHaveURL(/\/koszyk\/twoje-dane\/$/);
      await expect(
        page.getByText(`Kod rabatowy (${couponCode})`, { exact: true }),
      ).toBeVisible();

      await fillCheckoutDetails(page, { email });
      await acceptCheckoutRequiredConsents(page);
      await submitCheckoutPayment(page);

      await expect(page).toHaveURL(/\/podziekowania-za-zakup\/[^/]+\/$/);

      await expect
        .poll(async () => {
          const order = await readLatestOrderByEmail(email);
          return {
            currentStatus: order.current_status,
            discountTotalCents: order.discount_total_cents,
            usedDiscount: order.used_discount,
          };
        })
        .toMatchObject({
          currentStatus: "paid",
          discountTotalCents: 5000,
          usedDiscount: {
            couponCode,
            totalDiscountCents: 5000,
          },
        });
    } finally {
      await cleanupCheckoutData(email);
      await cleanupCouponByCode(couponCode);
    }
  });

  test("removes a persisted coupon when the coupon is invalidated", async ({
    page,
  }) => {
    const couponCode = `P1-OFF-${Date.now().toString(36).toUpperCase()}`;

    await seedFixedOrderCoupon({
      code: couponCode,
      discountValueCents: 3000,
    });

    try {
      await preparePrestigeCheckout(page);
      await page.getByRole("link", { name: "Zmień koszyk" }).click();

      await page.getByPlaceholder("Wpisz kod").fill(couponCode);
      await page.getByRole("button", { name: "Zastosuj" }).click();
      await expect(page.getByText(couponCode, { exact: true })).toBeVisible();

      await setCouponActive(couponCode, false);
      await page.reload();

      await expect(
        page.getByText("Kod zmienił się po odświeżeniu strony."),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Ten kod jest już nieaktywny, więc usunęliśmy go z koszyka.",
        ),
      ).toBeVisible();
      await expect(page.getByText(couponCode, { exact: true })).toHaveCount(0);
    } finally {
      await cleanupCouponByCode(couponCode);
    }
  });
});
