import { expect, test } from "@playwright/test";

import {
  countCancellationRequestsByOrderId,
  readCustomerAuthSeedMetadata,
} from "./utils";

test.describe("authenticated order cancellation", () => {
  test("submits a customer cancellation request and disables duplicate entry", async ({
    page,
  }) => {
    const seed = await readCustomerAuthSeedMetadata();

    await page.goto(`/konto-klienta/zamowienia/${seed.orderNumber}/`);

    await expect(
      page.getByRole("heading", { name: `Zamówienie ${seed.orderNumber}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Anulowanie zamówienia" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Poproś o anulowanie" }).click();
    await expect(
      page.getByRole("dialog", { name: "Poprosić o anulowanie zamówienia?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Wyślij prośbę" }).click();

    await expect(page.getByText("Oczekuje na decyzję Audiofast")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Poproś o anulowanie" }),
    ).toHaveCount(0);
    await expect
      .poll(() => countCancellationRequestsByOrderId(seed.orderId))
      .toBe(1);
  });
});
