import 'server-only';

import { createElement } from 'react';

import type { OrderSummaryItem } from '@/src/emails/components/OrderSummary';
import type {
  OrderConfirmationAddressBlock,
  OrderConfirmationInvoiceBlock,
} from '@/src/emails/order-confirmation-template';
import { OrderConfirmationTemplate } from '@/src/emails/order-confirmation-template';
import {
  getTransactionalReplyToEmail,
  sendTransactionalEmail,
} from '@/src/global/email/service';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

type OrdersRow = Database['public']['Tables']['orders']['Row'];
type OrderItemsRow = Database['public']['Tables']['order_items']['Row'];

export type PaymentConfirmationEmailOrderData = Pick<
  OrdersRow,
  | 'customer_email'
  | 'customer_snapshot'
  | 'discount_total_cents'
  | 'grand_total_cents'
  | 'id'
  | 'invoice_data'
  | 'order_number'
  | 'shipping_address_snapshot'
  | 'subtotal_cents'
>;

type PaidOrderEmailItemRow = Pick<
  OrderItemsRow,
  | 'brand_name'
  | 'item_snapshot'
  | 'line_position'
  | 'line_total_cents'
  | 'product_name'
  | 'quantity'
>;

function isRecord(
  value: Json | null | undefined,
): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(
  value: Json | undefined,
  fallback: string | null = null,
): string | null {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getNumber(
  value: Json | undefined,
  fallback: number | null = null,
): number | null {
  return typeof value === 'number' ? value : fallback;
}

function getSelectedOptionLabel(option: Json): string | null {
  if (!isRecord(option)) {
    return null;
  }

  const groupName = getString(option.groupName);
  const valueName = getString(option.valueName);
  const numericValue = getNumber(option.numericValue);
  const unit = getString(option.unit, '');

  let resolvedValue: string | null = valueName;

  if (resolvedValue === null && numericValue !== null) {
    resolvedValue = `${numericValue}${unit ?? ''}`;
  }

  if (groupName === null || resolvedValue === null) {
    return null;
  }

  return `${groupName}: ${resolvedValue}`;
}

function mapOrderItemToSummaryItem(
  item: PaidOrderEmailItemRow,
): OrderSummaryItem {
  const details: string[] = [];

  if (isRecord(item.item_snapshot)) {
    const model = getString(item.item_snapshot.model);
    if (model) {
      details.push(`Model: ${model}`);
    }

    const selectedOptions = item.item_snapshot.selectedOptions;
    if (Array.isArray(selectedOptions)) {
      for (const option of selectedOptions) {
        const label = getSelectedOptionLabel(option);
        if (label) {
          details.push(label);
        }
      }
    }
  }

  return {
    id: `${item.line_position}-${item.product_name}`,
    brandName: item.brand_name,
    productName: item.product_name,
    quantity: item.quantity,
    lineTotalCents: item.line_total_cents,
    details,
  };
}

function buildRecipientName(customerSnapshot: Json): {
  firstName: string;
  fullName: string | null;
} {
  if (!isRecord(customerSnapshot)) {
    return {
      firstName: 'kliencie',
      fullName: null,
    };
  }

  const firstName = getString(customerSnapshot.firstName, 'kliencie')!;
  const lastName = getString(customerSnapshot.lastName, '');
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    firstName,
    fullName: fullName.length > 0 ? fullName : null,
  };
}

function buildShippingAddressBlock(
  shippingSnapshot: Json,
): OrderConfirmationAddressBlock {
  if (!isRecord(shippingSnapshot)) {
    return {
      heading: 'Adres dostawy',
      recipientName: 'Dane dostawy niedostępne',
      phone: null,
      lines: [],
    };
  }

  const firstName = getString(shippingSnapshot.firstName, '');
  const lastName = getString(shippingSnapshot.lastName, '');
  const streetName = getString(shippingSnapshot.streetName, '');
  const buildingNumber = getString(shippingSnapshot.buildingNumber, '');
  const apartmentNumber = getString(shippingSnapshot.apartmentNumber, '');
  const postalCode = getString(shippingSnapshot.postalCode, '');
  const city = getString(shippingSnapshot.city, '');
  const phone = getString(shippingSnapshot.phone);

  const streetLine = [streetName, buildingNumber]
    .filter(Boolean)
    .join(' ')
    .trim();
  const apartmentSuffix = apartmentNumber ? ` / ${apartmentNumber}` : '';

  return {
    heading: 'Adres dostawy',
    recipientName:
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      'Dane odbiorcy niedostępne',
    phone,
    lines: [
      `${streetLine}${apartmentSuffix}`.trim(),
      [postalCode, city].filter(Boolean).join(' ').trim(),
      'Polska',
    ].filter(Boolean),
  };
}

function buildInvoiceBlock(
  invoiceData: Json | null,
): OrderConfirmationInvoiceBlock | null {
  if (!isRecord(invoiceData)) {
    return null;
  }

  if (getString(invoiceData.recipientType) !== 'company') {
    return null;
  }

  const companyName = getString(invoiceData.companyName);
  if (!companyName) {
    return null;
  }

  const taxId = getString(invoiceData.taxId);
  const invoiceAddress = isRecord(invoiceData.invoiceAddress)
    ? invoiceData.invoiceAddress
    : null;

  const streetName = invoiceAddress
    ? getString(invoiceAddress.streetName, '')
    : '';
  const buildingNumber = invoiceAddress
    ? getString(invoiceAddress.buildingNumber, '')
    : '';
  const apartmentNumber = invoiceAddress
    ? getString(invoiceAddress.apartmentNumber, '')
    : '';
  const postalCode = invoiceAddress
    ? getString(invoiceAddress.postalCode, '')
    : '';
  const city = invoiceAddress ? getString(invoiceAddress.city, '') : '';

  const streetLine = [streetName, buildingNumber]
    .filter(Boolean)
    .join(' ')
    .trim();
  const apartmentSuffix = apartmentNumber ? ` / ${apartmentNumber}` : '';

  return {
    companyName,
    taxId,
    lines: [
      `${streetLine}${apartmentSuffix}`.trim(),
      [postalCode, city].filter(Boolean).join(' ').trim(),
      'Polska',
    ].filter(Boolean),
  };
}

async function loadPaidOrderEmailItems(
  orderId: string,
): Promise<PaidOrderEmailItemRow[]> {
  const supabase = createAdminClient();
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select(
      'brand_name, item_snapshot, line_position, line_total_cents, product_name, quantity',
    )
    .eq('order_id', orderId)
    .order('line_position', { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  return items ?? [];
}

export async function sendCheckoutPaymentConfirmationEmail(args: {
  order: PaymentConfirmationEmailOrderData;
}): Promise<void> {
  const order = args.order;
  const items = await loadPaidOrderEmailItems(order.id);
  const recipient = buildRecipientName(order.customer_snapshot);
  const subject = `Audiofast | Potwierdzenie zamówienia ${order.order_number}`;
  const emailResult = await sendTransactionalEmail({
    to: {
      email: order.customer_email,
      name: recipient.fullName ?? undefined,
    },
    subject,
    replyTo: getTransactionalReplyToEmail(),
    saveToSentItems: true,
    react: createElement(OrderConfirmationTemplate, {
      customerFirstName: recipient.firstName,
      customerEmail: order.customer_email,
      orderNumber: order.order_number,
      items: items.map(mapOrderItemToSummaryItem),
      subtotalCents: order.subtotal_cents,
      discountTotalCents: order.discount_total_cents,
      grandTotalCents: order.grand_total_cents,
      shippingAddress: buildShippingAddressBlock(
        order.shipping_address_snapshot,
      ),
      invoiceDetails: buildInvoiceBlock(order.invoice_data),
      loginUrl: 'https://audiofast.pl/konto-klienta/',
    }),
  });

  if (!emailResult.success) {
    throw new Error(
      emailResult.error ??
        `Failed to send checkout payment confirmation email for order ${order.order_number}.`,
    );
  }
}
