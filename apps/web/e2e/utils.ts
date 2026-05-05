import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { E2E_CUSTOMER_AUTH_SEED_PATH, E2E_EMAIL_DOMAIN } from "./constants";

type CheckoutDetails = {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  postalCode?: string;
  city?: string;
  streetName?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
};

export type SeededCustomerOrder = {
  email: string;
  orderId: string;
  orderNumber: string;
  profileId: string;
  firstName: string;
  lastName: string;
  phone: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    phone: string;
    streetName: string;
    buildingNumber: string;
    apartmentNumber: string | null;
    postalCode: string;
    city: string;
    country: "PL";
  };
};

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase E2E env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.e2e.local.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function buildE2eEmail(args: { prefix: string; parallelIndex: number }) {
  const uniqueId = `${Date.now()}-${args.parallelIndex}`;

  return `${args.prefix}-${uniqueId}@${E2E_EMAIL_DOMAIN}`;
}

function assertSupabaseOk(error: unknown, context: string) {
  if (error) {
    throw new Error(`${context}: ${JSON.stringify(error)}`);
  }
}

export async function cleanupOrdersForEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_email", email);

  if (ordersError) {
    throw ordersError;
  }

  const orderIds = orders.map((order) => order.id);

  if (orderIds.length > 0) {
    assertSupabaseOk(
      (await supabase.from("order_items").delete().in("order_id", orderIds))
        .error,
      `Failed to delete order_items for ${email}`,
    );
    assertSupabaseOk(
      (
        await supabase
          .from("order_cancellation_requests")
          .delete()
          .in("order_id", orderIds)
      ).error,
      `Failed to delete order_cancellation_requests for ${email}`,
    );
    assertSupabaseOk(
      (await supabase.from("return_cases").delete().in("order_id", orderIds))
        .error,
      `Failed to delete return_cases for ${email}`,
    );
    assertSupabaseOk(
      (await supabase.from("orders").delete().in("id", orderIds)).error,
      `Failed to delete orders for ${email}`,
    );
  }
}

export async function cleanupCustomerProfileByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  assertSupabaseOk(
    (await supabase.from("customer_profiles").delete().eq("email", email))
      .error,
    `Failed to delete customer_profile for ${email}`,
  );
}

export async function cleanupCheckoutData(email: string) {
  await cleanupOrdersForEmail(email);
  await cleanupCustomerProfileByEmail(email);
}

export async function seedPaidOrderForCustomerEmail(
  email: string,
): Promise<SeededCustomerOrder> {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const payableUntil = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const orderNumber = `AF-E2E-${Date.now().toString(36).toUpperCase()}`;
  const firstName = "Ewa";
  const lastName = "Klientka";
  const phone = "500 600 700";
  const shippingAddress = {
    firstName,
    lastName,
    phone,
    streetName: "Panelowa",
    buildingNumber: "7",
    apartmentNumber: "5",
    postalCode: "00-007",
    city: "Warszawa",
    country: "PL" as const,
  };

  const { data: profile, error: profileError } = await supabase
    .from("customer_profiles")
    .insert({
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      default_shipping_address: shippingAddress,
      default_invoice_data: null,
    })
    .select("id")
    .single();

  assertSupabaseOk(
    profileError,
    `Failed to seed customer_profile for ${email}`,
  );
  if (!profile) {
    throw new Error(`Failed to seed customer_profile for ${email}: no row.`);
  }

  const customerSnapshot = {
    email,
    firstName,
    lastName,
    phone,
  };
  const statusHistory = [
    {
      status: "awaiting_payment",
      changedAt: nowIso,
      source: "system",
    },
    {
      status: "paid",
      changedAt: nowIso,
      source: "system",
    },
  ];

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      current_status: "paid",
      customer_email: email,
      customer_profile_id: profile.id,
      customer_snapshot: customerSnapshot,
      shipping_address_snapshot: shippingAddress,
      subtotal_cents: 124900,
      discount_total_cents: 0,
      grand_total_cents: 124900,
      payable_until: payableUntil,
      paid_at: nowIso,
      payment_verified_at: nowIso,
      payment_reference: `e2e-${orderNumber.toLowerCase()}`,
      payment_provider: "e2e",
      status_history: statusHistory,
      profile_persistence: {
        shouldEnsureProfileAfterSuccessfulPayment: true,
        shouldStoreCheckoutDefaultsAfterSuccessfulPayment: false,
        authUserIdAtCheckout: null,
        reason: "create_profile_without_defaults",
      },
    })
    .select("id")
    .single();

  assertSupabaseOk(orderError, `Failed to seed paid order for ${email}`);
  if (!order) {
    throw new Error(`Failed to seed paid order for ${email}: no row.`);
  }

  assertSupabaseOk(
    (
      await supabase.from("order_items").insert({
        order_id: order.id,
        line_position: 1,
        line_type: "standard",
        product_key: "prestige",
        product_name: "Prestige",
        brand_name: "Artesania Audio",
        quantity: 1,
        unit_price_cents: 124900,
        line_subtotal_cents: 124900,
        line_discount_total_cents: 0,
        line_total_cents: 124900,
        is_returnable: true,
        item_snapshot: {
          productImage: null,
          model: "Prestige",
          selectedOptions: [
            {
              groupName: "Wariant testowy",
              inputType: "select",
              valueName: "E2E",
              numericValue: null,
              unit: null,
              parentGroupName: null,
              parentValueName: null,
            },
          ],
        },
      })
    ).error,
    `Failed to seed order_items for ${email}`,
  );

  return {
    email,
    orderId: order.id,
    orderNumber,
    profileId: profile.id,
    firstName,
    lastName,
    phone,
    shippingAddress,
  };
}

export async function readCustomerAuthSeedMetadata() {
  return JSON.parse(
    await readFile(E2E_CUSTOMER_AUTH_SEED_PATH, "utf8"),
  ) as SeededCustomerOrder;
}

export async function authenticateE2eCustomer(
  page: Page,
  args: { email: string; returnTo: string },
) {
  const authSecret = process.env.E2E_AUTH_HELPER_SECRET;

  if (!authSecret) {
    throw new Error(
      "Missing E2E_AUTH_HELPER_SECRET. Set it in .env.e2e.local before running authenticated E2E tests.",
    );
  }

  await page.setExtraHTTPHeaders({
    "x-e2e-auth-secret": authSecret,
  });

  const authUrl = new URL("/api/e2e/customer-auth", "http://localhost");
  authUrl.searchParams.set("email", args.email);
  authUrl.searchParams.set("returnTo", args.returnTo);

  await page.goto(`${authUrl.pathname}${authUrl.search}`);
}

export async function addPrestigeProductToCart(page: Page) {
  await page.goto("/produkty/prestige/");

  await expect(
    page.getByRole("heading", {
      name: "Artesania Audio Prestige",
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await expect(
    page.getByRole("dialog", { name: "Produkt został dodany" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Przejdź do koszyka" }).click();
}

export async function goFromCartToCheckout(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Podsumowanie" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Dalej" })).toBeEnabled();
  await page.getByRole("button", { name: "Dalej" }).click();
  await expect(page).toHaveURL(/\/koszyk\/twoje-dane\/$/);
}

export async function preparePrestigeCheckout(page: Page) {
  await addPrestigeProductToCart(page);
  await goFromCartToCheckout(page);
}

export async function fillCheckoutDetails(
  page: Page,
  details: CheckoutDetails,
) {
  const checkoutForm = page.locator("#checkout-details-form");

  await checkoutForm
    .getByLabel("Imię", { exact: true })
    .fill(details.firstName ?? "Ewa");
  await checkoutForm
    .getByLabel("Nazwisko", { exact: true })
    .fill(details.lastName ?? "Testowa");
  await checkoutForm
    .getByLabel("Telefon", { exact: true })
    .fill(details.phone ?? "500 600 700");
  await checkoutForm
    .getByLabel("Adres e-mail", { exact: true })
    .fill(details.email);

  await checkoutForm
    .getByLabel("Kod pocztowy", { exact: true })
    .fill(details.postalCode ?? "00-001");
  await checkoutForm
    .getByLabel("Miejscowość", { exact: true })
    .fill(details.city ?? "Warszawa");
  await checkoutForm
    .getByLabel("Ulica", { exact: true })
    .fill(details.streetName ?? "Testowa");
  await checkoutForm
    .getByLabel("Numer domu", { exact: true })
    .fill(details.buildingNumber ?? "1");

  if (details.apartmentNumber) {
    await checkoutForm
      .getByLabel("Numer mieszkania (opcjonalnie)", { exact: true })
      .fill(details.apartmentNumber);
  }
}

export async function acceptCheckoutRequiredConsents(page: Page) {
  await page
    .locator("#checkout-details-form label")
    .filter({ hasText: "Akceptuję" })
    .click({ position: { x: 12, y: 12 } });
}

export async function submitCheckoutPayment(page: Page) {
  await page.getByRole("button", { name: "Przejdź do płatności" }).click();
}

export async function assertPaidOrderByEmail(email: string) {
  const supabase = createSupabaseAdminClient();

  await expect
    .poll(async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_email, current_status, grand_total_cents")
        .eq("customer_email", email)
        .limit(2);

      if (error) {
        throw error;
      }

      return data;
    })
    .toHaveLength(1);

  const { data, error } = await supabase
    .from("orders")
    .select("customer_email, current_status, grand_total_cents")
    .eq("customer_email", email)
    .single();

  if (error) {
    throw error;
  }

  expect(data).toMatchObject({
    customer_email: email,
    current_status: "paid",
  });
  expect(data.grand_total_cents).toBeGreaterThan(0);
}

export async function readCustomerProfileByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("email, first_name, last_name, phone, default_shipping_address")
    .eq("email", email)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function countCheckoutOrdersByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_email", email);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
