import { describe, expect, it } from "vitest";

import {
  buildOrderStatusTimeline,
  formatOrderExpectedDeliveryEstimate,
  formatOrderSelectedOption,
  getOrderInvoiceRecipientType,
  isOrderDateOnlyString,
  parseOrderAddressBlock,
  parseOrderDiscountData,
  parseOrderExpectedDeliveryEstimate,
  parseOrderInvoiceData,
  parseOrderItemSnapshot,
  parseOrderShipmentData,
  parseOrderShippingAddressSnapshot,
} from "./orders";

describe("B2C order utilities", () => {
  it("parses address blocks with optional recipient data", () => {
    expect(
      parseOrderAddressBlock(
        {
          companyName: "Audiofast",
          firstName: "Jan",
          lastName: "Kowalski",
          phone: "+48123456789",
          streetName: "Testowa",
          buildingNumber: "10",
          apartmentNumber: "2",
          postalCode: "00-001",
          taxId: "1234567890",
          city: "Warszawa",
          country: "Polska",
        },
        { includeRecipient: true },
      ),
    ).toEqual({
      companyName: "Audiofast",
      recipientName: "Jan Kowalski",
      phone: "+48123456789",
      taxId: "1234567890",
      lines: ["Testowa 10/2", "00-001 Warszawa", "Polska"],
    });
  });

  it("returns an empty shipping address fallback for malformed snapshots", () => {
    expect(parseOrderShippingAddressSnapshot(null)).toEqual({
      companyName: null,
      recipientName: null,
      phone: null,
      taxId: null,
      lines: [],
    });
  });

  it("parses invoice data and recipient type", () => {
    const invoice = {
      attachedAt: "2026-05-06T08:00:00.000Z",
      companyName: "Audiofast sp. z o.o.",
      invoiceAddress: {
        city: "Warszawa",
        country: "Polska",
        postalCode: "00-001",
        street: "Firmowa 1",
      },
      recipientType: "company",
      filename: "audiofast-invoice.pdf",
      storagePath: "orders/AF-2026-00001/invoice.pdf",
      taxId: "1234567890",
    };

    expect(parseOrderInvoiceData(invoice)).toEqual({
      recipientType: "company",
      companyName: "Audiofast sp. z o.o.",
      taxId: "1234567890",
      invoiceAddress: {
        companyName: null,
        recipientName: null,
        phone: null,
        taxId: null,
        lines: ["Firmowa 1", "00-001 Warszawa", "Polska"],
      },
      filename: "audiofast-invoice.pdf",
      storagePath: "orders/AF-2026-00001/invoice.pdf",
      attachedAt: "2026-05-06T08:00:00.000Z",
    });
    expect(getOrderInvoiceRecipientType(invoice)).toBe("company");
  });

  it("parses shipment and discount metadata", () => {
    expect(
      parseOrderShipmentData(
        {
          carrier: "DHL",
          shippedAt: "2026-05-07T08:00:00.000Z",
          trackingNumber: "TRACK123",
          trackingUrl: "https://example.com/track/TRACK123",
        },
        null,
      ),
    ).toEqual({
      carrier: "DHL",
      trackingNumber: "TRACK123",
      trackingUrl: "https://example.com/track/TRACK123",
      shippedAt: "2026-05-07T08:00:00.000Z",
    });

    expect(
      parseOrderDiscountData({
        couponCode: "SALE10",
        discountPercent: 10,
        discountType: "percent_order",
        totalDiscountCents: 1500,
      }),
    ).toEqual({
      couponCode: "SALE10",
      discountType: "percent_order",
      discountValueCents: null,
      discountPercent: 10,
      totalDiscountCents: 1500,
    });
  });

  it("parses and formats expected delivery estimates", () => {
    expect(isOrderDateOnlyString("2026-05-20")).toBe(true);
    expect(isOrderDateOnlyString("2026-02-31")).toBe(false);

    expect(parseOrderExpectedDeliveryEstimate("2026-05-20", null)).toEqual({
      from: "2026-05-20",
      to: null,
    });
    expect(
      parseOrderExpectedDeliveryEstimate("2026-05-20", "2026-05-27"),
    ).toEqual({
      from: "2026-05-20",
      to: "2026-05-27",
    });
    expect(
      parseOrderExpectedDeliveryEstimate("2026-05-20", "2026-05-19"),
    ).toEqual({
      from: "2026-05-20",
      to: null,
    });
    expect(parseOrderExpectedDeliveryEstimate(null, "2026-05-27")).toBeNull();

    expect(
      formatOrderExpectedDeliveryEstimate({
        from: "2026-05-20",
        to: null,
      }),
    ).toBe("20 maja 2026");
    expect(
      formatOrderExpectedDeliveryEstimate({
        from: "2026-05-20",
        to: "2026-05-27",
      }),
    ).toBe("20-27 maja 2026");
    expect(
      formatOrderExpectedDeliveryEstimate({
        from: "2026-05-20",
        to: "2026-06-03",
      }),
    ).toBe("20 maja - 3 czerwca 2026");
  });

  it("formats selected options and item snapshots", () => {
    expect(
      formatOrderSelectedOption({
        groupName: "Kolor",
        parentGroupName: "Model",
        parentValueName: "Pro",
        valueName: "Czarny",
      }),
    ).toBe("Model: Pro / Kolor: Czarny");

    expect(
      parseOrderItemSnapshot(
        {
          archivedAtPurchase: false,
          availabilityStatusAtPurchase: "sold_out",
          model: "Pro",
          selectedOptions: [
            {
              groupName: "Dlugosc",
              numericValue: 2,
              unit: "m",
            },
          ],
        },
        "cpo",
      ),
    ).toEqual({
      details: ["Model: Pro", "Dlugosc: 2m"],
      cpoContext: {
        availabilityStatusAtPurchase: "sold_out",
        archivedAtPurchase: false,
      },
    });
  });

  it("builds status timelines from history and fallback timestamps", () => {
    expect(
      buildOrderStatusTimeline(
        {
          cancelled_at: null,
          completed_at: null,
          created_at: "2026-05-06T08:00:00.000Z",
          current_status: "shipped",
          paid_at: "2026-05-06T08:05:00.000Z",
          returned_at: null,
          shipped_at: "2026-05-07T08:00:00.000Z",
          status_history: [
            {
              actorEmail: "operator@example.com",
              changedAt: "2026-05-06T10:00:00.000Z",
              newStatus: "processing",
              note: "Packed",
              previousStatus: "paid",
              source: "admin",
            },
          ],
          updated_at: "2026-05-07T08:00:00.000Z",
        },
        {
          fallbackSource: (status) =>
            status === "awaiting_payment" || status === "paid"
              ? "system"
              : "admin",
        },
      ),
    ).toEqual([
      expect.objectContaining({
        status: "awaiting_payment",
        source: "system",
      }),
      expect.objectContaining({
        status: "paid",
        source: "system",
      }),
      expect.objectContaining({
        actor: "operator@example.com",
        note: "Packed",
        previousStatus: "paid",
        source: "admin",
        status: "processing",
      }),
      expect.objectContaining({
        status: "shipped",
        source: "admin",
      }),
    ]);
  });

  it("does not show shipped fallback before the order status reaches shipped", () => {
    const timeline = buildOrderStatusTimeline({
      cancelled_at: null,
      completed_at: null,
      created_at: "2026-05-06T08:00:00.000Z",
      current_status: "processing",
      paid_at: "2026-05-06T08:05:00.000Z",
      returned_at: null,
      shipped_at: "2026-05-07T08:00:00.000Z",
      status_history: [],
      updated_at: "2026-05-07T08:00:00.000Z",
    });

    expect(timeline.map((entry) => entry.status)).toEqual([
      "awaiting_payment",
      "paid",
      "processing",
    ]);
  });
});
