import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import { OrderInvoiceAvailableTemplate } from '@/src/emails/order-invoice-available-template';
import type { VerifiedAdminOperator } from '@/src/global/b2c/admin/server/auth';
import { sendB2cCustomerTransactionalEmail } from '@/src/global/b2c/customer-transactional-email';
import { buildB2cWithdrawalFormEmailAttachment } from '@/src/global/b2c/legal-documents/withdrawal-form';
import {
  getString,
  isRecord,
  type ParsedOrderInvoiceData,
  parseOrderInvoiceData,
} from '@/src/global/b2c/utils/orders';
import { normalizeOptionalText } from '@/src/global/b2c/utils/text';
import { getTransactionalReplyToEmail } from '@/src/global/email/service';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database, Json } from '@/src/global/supabase/database.types';

type OrderInvoiceRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  | 'current_status'
  | 'customer_email'
  | 'customer_snapshot'
  | 'id'
  | 'invoice_data'
  | 'order_number'
  | 'updated_at'
>;
type OrdersUpdate = Database['public']['Tables']['orders']['Update'];

export type AdminInvoiceEmailStatus = {
  attempted: boolean;
  status: 'sent' | 'failed' | 'not_required';
  withdrawalFormAttached: boolean;
};

export type AdminInvoiceUploadResult = {
  orderId: string;
  orderNumber: string;
  invoice: ParsedOrderInvoiceData;
  updatedAt: string;
  customerEmail: AdminInvoiceEmailStatus;
};

export type AdminInvoiceRemovalResult = {
  orderId: string;
  orderNumber: string;
  removedAt: string;
};

export type AdminInvoiceDocument = {
  body: Blob;
  contentType: string;
  filename: string;
};

export class AdminOrderInvoiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_invoice_payload'
      | 'invoice_not_available'
      | 'invoice_not_attachable'
      | 'order_not_found'
      | 'database_error'
      | 'storage_error',
    public readonly status: number,
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'AdminOrderInvoiceError';
  }
}

const INVOICE_BUCKET =
  process.env.SUPABASE_ORDER_INVOICES_BUCKET ?? 'order-invoices';
const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

function buildInvoiceStoragePath(orderNumber: string) {
  return `orders/${orderNumber}/invoice.pdf`;
}

function buildInvoiceFilename(orderNumber: string) {
  return `faktura-${orderNumber}.pdf`;
}

function normalizeAttachedAt(value: string | null, now: Date) {
  if (!value) {
    return now.toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AdminOrderInvoiceError(
      'Invalid attachedAt timestamp.',
      'invalid_invoice_payload',
      400,
    );
  }

  return parsed.toISOString();
}

export function buildAdminInvoiceDataPayload(args: {
  attachedAt: string;
  currentInvoiceData: Json | null;
  filename: string;
  storagePath: string;
  updatedAt: string;
}): OrdersUpdate {
  const currentInvoice = isRecord(args.currentInvoiceData)
    ? args.currentInvoiceData
    : {};

  return {
    invoice_data: {
      ...currentInvoice,
      attachedAt: args.attachedAt,
      filename: args.filename,
      storagePath: args.storagePath,
    },
    updated_at: args.updatedAt,
  };
}

async function loadOrderInvoiceRow(
  orderNumber: string,
): Promise<OrderInvoiceRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'current_status, customer_email, customer_snapshot, id, invoice_data, order_number, updated_at',
    )
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    throw new AdminOrderInvoiceError(
      'Failed to load the B2C order.',
      'database_error',
      500,
      error,
    );
  }

  if (!data) {
    throw new AdminOrderInvoiceError(
      'The requested B2C order could not be found.',
      'order_not_found',
      404,
    );
  }

  return data as OrderInvoiceRow;
}

async function uploadInvoiceFile(args: {
  content: ArrayBuffer;
  storagePath: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .upload(args.storagePath, Buffer.from(args.content), {
      cacheControl: 'private, max-age=0',
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    throw new AdminOrderInvoiceError(
      'Failed to upload the B2C order invoice.',
      'storage_error',
      500,
      error,
    );
  }
}

async function updateOrderInvoice(args: {
  orderId: string;
  payload: OrdersUpdate;
}): Promise<OrderInvoiceRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .update(args.payload)
    .eq('id', args.orderId)
    .select(
      'current_status, customer_email, customer_snapshot, id, invoice_data, order_number, updated_at',
    )
    .single();

  if (error) {
    throw new AdminOrderInvoiceError(
      'Failed to update B2C order invoice metadata.',
      'database_error',
      500,
      error,
    );
  }

  return data as OrderInvoiceRow;
}

async function removeInvoiceFile(storagePath: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new AdminOrderInvoiceError(
      'Failed to remove the B2C order invoice document.',
      'storage_error',
      500,
      error,
    );
  }
}

function validateInvoiceFile(file: File) {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    throw new AdminOrderInvoiceError(
      'Only PDF invoice files are supported.',
      'invalid_invoice_payload',
      400,
    );
  }

  if (file.size <= 0 || file.size > MAX_INVOICE_BYTES) {
    throw new AdminOrderInvoiceError(
      'Invoice file must be between 1 byte and 10 MB.',
      'invalid_invoice_payload',
      400,
    );
  }
}

function getCustomerName(row: OrderInvoiceRow): string | undefined {
  if (!isRecord(row.customer_snapshot)) {
    return undefined;
  }

  const firstName = getString(row.customer_snapshot.firstName);
  const lastName = getString(row.customer_snapshot.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return fullName.length > 0 ? fullName : undefined;
}

async function sendInvoiceEmail(args: {
  fileBase64: string;
  order: OrderInvoiceRow;
}): Promise<AdminInvoiceEmailStatus> {
  const invoice = parseOrderInvoiceData(args.order.invoice_data);
  const withdrawalForm = await buildB2cWithdrawalFormEmailAttachment({
    invoice,
  });
  const attachments = [
    {
      contentBytes: args.fileBase64,
      contentType: 'application/pdf',
      name: buildInvoiceFilename(args.order.order_number),
    },
  ];

  if (withdrawalForm) {
    attachments.push(withdrawalForm);
  }

  try {
    await sendB2cCustomerTransactionalEmail({
      attachments,
      react: OrderInvoiceAvailableTemplate({
        includesWithdrawalForm: withdrawalForm !== null,
        orderNumber: args.order.order_number,
      }),
      replyTo: getTransactionalReplyToEmail(),
      subject: `Faktura do zamówienia ${args.order.order_number}`,
      to: {
        email: args.order.customer_email,
        name: getCustomerName(args.order),
      },
    });

    return {
      attempted: true,
      status: 'sent',
      withdrawalFormAttached: withdrawalForm !== null,
    };
  } catch (error) {
    console.error('Failed to send B2C order invoice email.', {
      error,
      orderId: args.order.id,
      orderNumber: args.order.order_number,
    });

    return {
      attempted: true,
      status: 'failed',
      withdrawalFormAttached: withdrawalForm !== null,
    };
  }
}

export async function attachAdminOrderInvoice(args: {
  actor: VerifiedAdminOperator;
  attachedAt?: string | null;
  file: File;
  now?: Date;
  orderNumber: string;
}): Promise<AdminInvoiceUploadResult> {
  void args.actor;
  validateInvoiceFile(args.file);

  const now = args.now ?? new Date();
  const order = await loadOrderInvoiceRow(args.orderNumber);

  if (order.current_status === 'awaiting_payment') {
    throw new AdminOrderInvoiceError(
      'Invoices can only be attached after the order is paid.',
      'invoice_not_attachable',
      409,
    );
  }

  const content = await args.file.arrayBuffer();
  const attachedAt = normalizeAttachedAt(
    normalizeOptionalText(args.attachedAt),
    now,
  );
  const storagePath = buildInvoiceStoragePath(order.order_number);
  const updatedAt = now.toISOString();

  await uploadInvoiceFile({
    content,
    storagePath,
  });

  const updatedOrder = await updateOrderInvoice({
    orderId: order.id,
    payload: buildAdminInvoiceDataPayload({
      attachedAt,
      currentInvoiceData: order.invoice_data,
      filename: args.file.name,
      storagePath,
      updatedAt,
    }),
  });
  const customerEmail = await sendInvoiceEmail({
    fileBase64: Buffer.from(content).toString('base64'),
    order: updatedOrder,
  });

  return {
    orderId: updatedOrder.id,
    orderNumber: updatedOrder.order_number,
    invoice: parseOrderInvoiceData(updatedOrder.invoice_data),
    updatedAt: updatedOrder.updated_at,
    customerEmail,
  };
}

export async function loadAdminOrderInvoiceDocument(args: {
  orderNumber: string;
}): Promise<AdminInvoiceDocument> {
  const order = await loadOrderInvoiceRow(args.orderNumber);
  const invoice = parseOrderInvoiceData(order.invoice_data);

  if (!invoice.storagePath) {
    throw new AdminOrderInvoiceError(
      'Invoice document is not available for this order.',
      'invoice_not_available',
      404,
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .download(invoice.storagePath);

  if (error || !data) {
    throw new AdminOrderInvoiceError(
      'Invoice document could not be downloaded.',
      'storage_error',
      502,
      error ?? null,
    );
  }

  return {
    body: data,
    contentType: data.type || 'application/pdf',
    filename: buildInvoiceFilename(order.order_number),
  };
}

export async function removeAdminOrderInvoice(args: {
  now?: Date;
  orderNumber: string;
}): Promise<AdminInvoiceRemovalResult> {
  const removedAt = (args.now ?? new Date()).toISOString();
  const order = await loadOrderInvoiceRow(args.orderNumber);
  const invoice = parseOrderInvoiceData(order.invoice_data);

  if (!invoice.storagePath) {
    throw new AdminOrderInvoiceError(
      'Invoice document is not available for this order.',
      'invoice_not_available',
      404,
    );
  }

  await removeInvoiceFile(invoice.storagePath);
  const currentInvoice = isRecord(order.invoice_data) ? order.invoice_data : {};
  const updatedOrder = await updateOrderInvoice({
    orderId: order.id,
    payload: {
      invoice_data: {
        ...currentInvoice,
        attachedAt: null,
        filename: null,
        storagePath: null,
      },
      updated_at: removedAt,
    },
  });

  return {
    orderId: updatedOrder.id,
    orderNumber: updatedOrder.order_number,
    removedAt,
  };
}
