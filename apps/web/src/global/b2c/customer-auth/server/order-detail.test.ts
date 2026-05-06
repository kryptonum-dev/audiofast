import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/src/global/supabase/admin";

import {
  createCustomerOrderInvoiceSignedUrl,
  loadCustomerOrderForPanel,
} from "./order-detail";

vi.mock("@/src/global/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const BASE_ORDER_ROW = {
  cancelled_at: null,
  completed_at: null,
  created_at: "2026-04-24T10:00:00.000Z",
  current_status: "paid",
  customer_email: "jan@example.com",
  customer_snapshot: {
    firstName: "Jan",
    lastName: "Kowalski",
    email: "jan@example.com",
    phone: "+48123123123",
  },
  discount_total_cents: 30_00,
  grand_total_cents: 200_00,
  id: "order-1",
  invoice_data: {
    recipientType: "company",
    companyName: "Audio Test Sp. z o.o.",
    taxId: "1234567890",
    invoiceAddress: {
      streetName: "Testowa",
      buildingNumber: "1",
      apartmentNumber: null,
      postalCode: "00-001",
      city: "Warszawa",
      country: "PL",
    },
    storagePath: "invoices/AF-2026-00001.pdf",
    attachedAt: "2026-04-25T10:00:00.000Z",
  },
  order_number: "AF-2026-00001",
  paid_at: "2026-04-24T10:05:00.000Z",
  payable_until: "2026-04-24T10:15:00.000Z",
  payment_reference: "p24-123",
  payment_verified_at: "2026-04-24T10:05:00.000Z",
  returned_at: null,
  shipment_data: null,
  shipped_at: null,
  shipping_address_snapshot: {
    firstName: "Jan",
    lastName: "Kowalski",
    phone: "+48123123123",
    streetName: "Dostawcza",
    buildingNumber: "2",
    apartmentNumber: "3",
    postalCode: "00-002",
    city: "Kraków",
    country: "PL",
  },
  status_history: [
    {
      status: "awaiting_payment",
      changedAt: "2026-04-24T10:00:00.000Z",
      source: "system",
    },
    {
      status: "paid",
      changedAt: "2026-04-24T10:05:00.000Z",
      source: "system",
    },
  ],
  subtotal_cents: 230_00,
  used_discount: {
    couponCode: "AUDIO30",
    discountType: "fixed_order",
    discountValueCents: 30_00,
    discountPercent: null,
    totalDiscountCents: 30_00,
  },
  updated_at: "2026-04-24T10:05:00.000Z",
};

const ORDER_ITEMS = [
  {
    brand_name: "Brand B",
    created_at: "2026-04-24T10:00:00.000Z",
    id: "item-2",
    is_returnable: true,
    item_snapshot: {
      model: null,
      selectedOptions: [],
    },
    line_discount_total_cents: 0,
    line_position: 2,
    line_subtotal_cents: 30_00,
    line_total_cents: 30_00,
    line_type: "standard",
    order_id: "order-1",
    product_key: "/produkty/b/",
    product_name: "Product B",
    quantity: 1,
    unit_price_cents: 30_00,
    updated_at: "2026-04-24T10:00:00.000Z",
  },
  {
    brand_name: "Brand A",
    created_at: "2026-04-24T10:00:00.000Z",
    id: "item-1",
    is_returnable: true,
    item_snapshot: {
      model: "Reference",
      selectedOptions: [
        {
          groupName: "Kolor",
          inputType: "select",
          valueName: "Czarny",
          numericValue: null,
          unit: null,
          parentGroupName: null,
          parentValueName: null,
        },
      ],
      productImage: {
        id: "image-abc-100x100-webp",
        preview: null,
        alt: null,
        naturalWidth: 100,
        naturalHeight: 100,
        hotspot: null,
        crop: null,
      },
    },
    line_discount_total_cents: 30_00,
    line_position: 1,
    line_subtotal_cents: 200_00,
    line_total_cents: 170_00,
    line_type: "standard",
    order_id: "order-1",
    product_key: "/produkty/a/",
    product_name: "Product A",
    quantity: 1,
    unit_price_cents: 200_00,
    updated_at: "2026-04-24T10:00:00.000Z",
  },
];

function setupSupabaseMock(args: {
  orderRow?: unknown;
  orderError?: unknown;
  items?: unknown[];
  returnCase?: unknown;
  returnCases?: unknown[];
  cancellationRequest?: unknown;
  cancellationRequests?: unknown[];
  signedUrl?: string;
}) {
  const ordersMaybeSingleMock = vi.fn().mockResolvedValue({
    data: args.orderRow === undefined ? BASE_ORDER_ROW : args.orderRow,
    error: args.orderError ?? null,
  });
  const ordersIlikeMock = vi.fn(() => ({
    maybeSingle: ordersMaybeSingleMock,
  }));
  const ordersEqMock = vi.fn(() => ({
    ilike: ordersIlikeMock,
  }));
  const ordersSelectMock = vi.fn(() => ({
    eq: ordersEqMock,
  }));

  const itemsOrderMock = vi.fn().mockResolvedValue({
    data: args.items ?? ORDER_ITEMS,
    error: null,
  });
  const itemsEqMock = vi.fn(() => ({
    order: itemsOrderMock,
  }));
  const itemsSelectMock = vi.fn(() => ({
    eq: itemsEqMock,
  }));

  const returnCasesData =
    args.returnCases ?? (args.returnCase ? [args.returnCase] : []);
  const returnCaseOrderMock = vi.fn().mockResolvedValue({
    data: returnCasesData,
    error: null,
  });
  const returnCaseOrderIdEqMock = vi.fn(() => ({
    order: returnCaseOrderMock,
  }));
  const returnCasesSelectMock = vi.fn(() => ({
    eq: returnCaseOrderIdEqMock,
  }));

  const cancellationRequestsData =
    args.cancellationRequests ??
    (args.cancellationRequest ? [args.cancellationRequest] : []);
  const cancellationRequestOrderMock = vi.fn().mockResolvedValue({
    data: cancellationRequestsData,
    error: null,
  });
  const cancellationRequestEqMock = vi.fn(() => ({
    order: cancellationRequestOrderMock,
  }));
  const cancellationRequestsSelectMock = vi.fn(() => ({
    eq: cancellationRequestEqMock,
  }));

  const createSignedUrlMock = vi.fn().mockResolvedValue({
    data: { signedUrl: args.signedUrl ?? "https://signed.example/invoice.pdf" },
    error: null,
  });
  const storageFromMock = vi.fn(() => ({
    createSignedUrl: createSignedUrlMock,
  }));
  const fromMock = vi.fn((table: string) => {
    if (table === "orders") {
      return { select: ordersSelectMock };
    }
    if (table === "order_items") {
      return { select: itemsSelectMock };
    }
    if (table === "return_cases") {
      return { select: returnCasesSelectMock };
    }
    if (table === "order_cancellation_requests") {
      return { select: cancellationRequestsSelectMock };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  vi.mocked(createAdminClient).mockReturnValue({
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  } as never);

  return {
    cancellationRequestsSelectMock,
    createSignedUrlMock,
    fromMock,
    itemsSelectMock,
    ordersEqMock,
    ordersIlikeMock,
    returnCasesSelectMock,
    storageFromMock,
  };
}

describe("loadCustomerOrderForPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads an owned order detail using order-time snapshots", async () => {
    const supabase = setupSupabaseMock({});

    const result = await loadCustomerOrderForPanel({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-24T11:00:00.000Z"),
    });

    expect(supabase.ordersEqMock).toHaveBeenCalledWith(
      "order_number",
      "AF-2026-00001",
    );
    expect(supabase.ordersIlikeMock).toHaveBeenCalledWith(
      "customer_email",
      "jan@example.com",
    );
    expect(supabase.itemsSelectMock).toHaveBeenCalledWith("*");
    expect(supabase.returnCasesSelectMock).toHaveBeenCalledWith("*");
    expect(result.kind).toBe("found");

    if (result.kind !== "found") {
      throw new Error("Expected order detail to be found.");
    }

    expect(result.order.orderNumber).toBe("AF-2026-00001");
    expect(result.order.customer.fullName).toBe("Jan Kowalski");
    expect(result.order.shippingAddress.lines).toEqual([
      "Dostawcza 2/3",
      "00-002 Kraków",
      "PL",
    ]);
    expect(result.order.invoice.downloadHref).toBe(
      "/konto-klienta/zamowienia/AF-2026-00001/faktura/",
    );
    expect(result.order.items.map((item) => item.id)).toEqual([
      "item-1",
      "item-2",
    ]);
    expect(result.order.items[0]?.details).toContain("Model: Reference");
    expect(result.order.discount?.couponCode).toBe("AUDIO30");
    expect(result.order.actions.canCancel).toBe(true);
  });

  it("hides missing or non-owned order details without loading related rows", async () => {
    const supabase = setupSupabaseMock({
      orderRow: null,
    });

    const result = await loadCustomerOrderForPanel({
      orderNumber: "AF-2026-00099",
      normalizedEmail: "ewa@example.com",
      now: new Date("2026-04-24T11:00:00.000Z"),
    });

    expect(result).toEqual({ kind: "not_found" });
    expect(supabase.ordersEqMock).toHaveBeenCalledWith(
      "order_number",
      "AF-2026-00099",
    );
    expect(supabase.ordersIlikeMock).toHaveBeenCalledWith(
      "customer_email",
      "ewa@example.com",
    );
    expect(supabase.itemsSelectMock).not.toHaveBeenCalled();
    expect(supabase.returnCasesSelectMock).not.toHaveBeenCalled();
    expect(supabase.cancellationRequestsSelectMock).not.toHaveBeenCalled();
  });

  it("hides expired awaiting-payment details", async () => {
    const supabase = setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: "awaiting_payment",
        paid_at: null,
        payable_until: "2026-04-24T10:15:00.000Z",
      },
    });

    const result = await loadCustomerOrderForPanel({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-24T11:00:00.000Z"),
    });

    expect(result).toEqual({ kind: "not_found" });
    expect(supabase.itemsSelectMock).not.toHaveBeenCalled();
    expect(supabase.returnCasesSelectMock).not.toHaveBeenCalled();
  });

  it("falls back to timestamp fields when timeline history entries are invalid", async () => {
    setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: "processing",
        paid_at: null,
        status_history: [
          null,
          { changedAt: "2026-04-24T10:30:00.000Z" },
          { status: "processing" },
        ],
        updated_at: "2026-04-24T10:30:00.000Z",
      },
    });

    const result = await loadCustomerOrderForPanel({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-24T11:00:00.000Z"),
    });

    expect(result.kind).toBe("found");

    if (result.kind !== "found") {
      throw new Error("Expected order detail to be found.");
    }

    expect(result.order.timeline).toEqual([
      expect.objectContaining({
        changedAt: "2026-04-24T10:00:00.000Z",
        status: "awaiting_payment",
      }),
      expect.objectContaining({
        changedAt: "2026-04-24T10:30:00.000Z",
        status: "processing",
      }),
    ]);
  });

  it("summarizes completed return cases separately from the main order status", async () => {
    setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: "shipped",
        invoice_data: {
          recipientType: "private",
        },
        shipped_at: "2026-04-24T10:30:00.000Z",
      },
      returnCase: {
        closed_at: null,
        completed_at: "2026-04-28T08:00:00.000Z",
        created_at: "2026-04-27T08:00:00.000Z",
        id: "return-case-1",
        reason: "Za duże.",
        status: "completed",
        updated_at: "2026-04-28T08:00:00.000Z",
      },
    });

    const result = await loadCustomerOrderForPanel({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-28T11:00:00.000Z"),
    });

    expect(result.kind).toBe("found");

    if (result.kind !== "found") {
      throw new Error("Expected order detail to be found.");
    }

    expect(result.order.currentStatus).toBe("shipped");
    expect(result.order.activeReturnCase).toEqual({
      closedAt: null,
      completedAt: "2026-04-28T08:00:00.000Z",
      createdAt: "2026-04-27T08:00:00.000Z",
      reason: "Za duże.",
      status: "completed",
      updatedAt: "2026-04-28T08:00:00.000Z",
    });
    expect(result.order.returnCases).toEqual([
      {
        closedAt: null,
        completedAt: "2026-04-28T08:00:00.000Z",
        createdAt: "2026-04-27T08:00:00.000Z",
        reason: "Za duże.",
        status: "completed",
        updatedAt: "2026-04-28T08:00:00.000Z",
      },
    ]);
    expect(result.order.actions.canRequestReturn).toBe(false);
  });

  it("keeps closed return cases visible without blocking a new eligible request", async () => {
    setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: "shipped",
        invoice_data: {
          recipientType: "private",
        },
        shipped_at: "2026-04-24T10:30:00.000Z",
      },
      returnCase: {
        closed_at: "2026-04-28T08:00:00.000Z",
        completed_at: null,
        created_at: "2026-04-27T08:00:00.000Z",
        id: "return-case-1",
        reason: "Nie pasuje.",
        status: "closed_without_return",
        updated_at: "2026-04-28T08:00:00.000Z",
      },
    });

    const result = await loadCustomerOrderForPanel({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-28T11:00:00.000Z"),
    });

    expect(result.kind).toBe("found");

    if (result.kind !== "found") {
      throw new Error("Expected order detail to be found.");
    }

    expect(result.order.activeReturnCase).toBeNull();
    expect(result.order.returnCases).toEqual([
      {
        closedAt: "2026-04-28T08:00:00.000Z",
        completedAt: null,
        createdAt: "2026-04-27T08:00:00.000Z",
        reason: "Nie pasuje.",
        status: "closed_without_return",
        updatedAt: "2026-04-28T08:00:00.000Z",
      },
    ]);
    expect(result.order.actions.canRequestReturn).toBe(true);
  });

  it("maps shipment tracking URL from order shipment metadata", async () => {
    setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        shipment_data: {
          carrier: "DHL",
          shippedAt: "2026-04-24T10:45:00.000Z",
          trackingNumber: "1234567890",
          trackingUrl:
            "https://www.dhl.com/pl-pl/home/tracking/tracking-parcel.html?tracking-id=1234567890",
        },
        shipped_at: "2026-04-24T10:30:00.000Z",
      },
    });

    const result = await loadCustomerOrderForPanel({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-24T11:00:00.000Z"),
    });

    expect(result.kind).toBe("found");

    if (result.kind !== "found") {
      throw new Error("Expected order detail to be found.");
    }

    expect(result.order.shipment).toEqual({
      carrier: "DHL",
      shippedAt: "2026-04-24T10:45:00.000Z",
      trackingNumber: "1234567890",
      trackingUrl:
        "https://www.dhl.com/pl-pl/home/tracking/tracking-parcel.html?tracking-id=1234567890",
    });
  });

  it("keeps rejected cancellation requests visible without blocking a new eligible request", async () => {
    setupSupabaseMock({
      cancellationRequest: {
        admin_note: "Zamówienie jest już w pakowaniu.",
        customer_message: null,
        id: "request-1",
        reason: "changed_mind",
        requested_at: "2026-04-27T08:00:00.000Z",
        resolved_at: "2026-04-28T08:00:00.000Z",
        status: "rejected",
      },
      orderRow: {
        ...BASE_ORDER_ROW,
        current_status: "processing",
        updated_at: "2026-04-27T09:00:00.000Z",
      },
    });

    const result = await loadCustomerOrderForPanel({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-28T11:00:00.000Z"),
    });

    expect(result.kind).toBe("found");

    if (result.kind !== "found") {
      throw new Error("Expected order detail to be found.");
    }

    expect(result.order.cancellationRequest).toEqual({
      adminNote: "Zamówienie jest już w pakowaniu.",
      reason: "changed_mind",
      requestedAt: "2026-04-27T08:00:00.000Z",
      resolvedAt: "2026-04-28T08:00:00.000Z",
      status: "rejected",
    });
    expect(result.order.cancellationRequests).toEqual([
      {
        adminNote: "Zamówienie jest już w pakowaniu.",
        reason: "changed_mind",
        requestedAt: "2026-04-27T08:00:00.000Z",
        resolvedAt: "2026-04-28T08:00:00.000Z",
        status: "rejected",
      },
    ]);
    expect(result.order.actions.canCancel).toBe(true);
    expect(result.order.actions.cancelMessage).toContain("odrzucił");
  });
});

describe("createCustomerOrderInvoiceSignedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs the stored invoice path only after the order passes ownership checks", async () => {
    const supabase = setupSupabaseMock({
      signedUrl: "https://signed.example/AF-2026-00001.pdf",
    });

    const signedUrl = await createCustomerOrderInvoiceSignedUrl({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-24T11:00:00.000Z"),
    });

    expect(signedUrl).toBe("https://signed.example/AF-2026-00001.pdf");
    expect(supabase.storageFromMock).toHaveBeenCalledWith("order-invoices");
    expect(supabase.createSignedUrlMock).toHaveBeenCalledWith(
      "invoices/AF-2026-00001.pdf",
      60,
    );
  });

  it("does not create a signed URL when the invoice document is not attached", async () => {
    const supabase = setupSupabaseMock({
      orderRow: {
        ...BASE_ORDER_ROW,
        invoice_data: {
          ...BASE_ORDER_ROW.invoice_data,
          attachedAt: null,
          storagePath: null,
        },
      },
    });

    const signedUrl = await createCustomerOrderInvoiceSignedUrl({
      orderNumber: "AF-2026-00001",
      normalizedEmail: "jan@example.com",
      now: new Date("2026-04-24T11:00:00.000Z"),
    });

    expect(signedUrl).toBeNull();
    expect(supabase.storageFromMock).not.toHaveBeenCalled();
    expect(supabase.createSignedUrlMock).not.toHaveBeenCalled();
  });
});
