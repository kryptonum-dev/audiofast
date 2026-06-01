import 'server-only';

import { createClient, type SanityClient } from '@sanity/client';
import { revalidatePath, revalidateTag } from 'next/cache';

import { extractCartProductSlug } from '@/src/global/b2c/cart/cart-product-key';
import { getCpoProductBuyability } from '@/src/global/b2c/utils/buyability';
import { createAdminClient } from '@/src/global/supabase/admin';

import type { CheckoutOrderDraft } from '../order-draft';

type CpoAvailabilityStatus =
  | 'available'
  | 'on_hold'
  | 'sold_out'
  | 'manually_unavailable';

type CpoAvailabilitySnapshot = {
  _id: string;
  _rev: string;
  slug?: string | null;
  isArchived?: boolean | null;
  isSellableOnline?: boolean | null;
  priceCents?: number | null;
  availabilityStatus?: CpoAvailabilityStatus | string | null;
  holdUntil?: string | null;
  holdOrderNumber?: string | null;
  holdPaymentSessionId?: string | null;
  soldOrderNumber?: string | null;
};

type CpoOrderItemRow = {
  product_key: string;
};

type CpoHeldOrderRow = {
  current_status: string;
  payable_until: string | null;
};

export type CpoAvailabilityFailureCode =
  | 'missing_write_token'
  | 'not_available'
  | 'write_conflict'
  | 'write_failed';

export class CpoAvailabilityError extends Error {
  constructor(
    message: string,
    public readonly code: CpoAvailabilityFailureCode,
    public readonly productKeys: string[] = [],
    public readonly causeError: unknown = null,
  ) {
    super(message);
    this.name = 'CpoAvailabilityError';
  }
}

const cpoAvailabilityProjection = `
  _id,
  _rev,
  "slug": slug.current,
  isArchived,
  isSellableOnline,
  priceCents,
  availabilityStatus,
  holdUntil,
  holdOrderNumber,
  holdPaymentSessionId,
  soldOrderNumber
`;

const queryCpoAvailabilityBySlugs = `
  *[
    _type == "cpoProduct" &&
    !(_id in path("drafts.**")) &&
    slug.current in $slugs
  ] {
    ${cpoAvailabilityProjection}
  }
`;

const queryCpoAvailabilityBySlug = `
  *[
    _type == "cpoProduct" &&
    !(_id in path("drafts.**")) &&
    slug.current == $slug
  ][0] {
    ${cpoAvailabilityProjection}
  }
`;

function createSanityWriteClient(): SanityClient {
  const token = process.env.SANITY_API_WRITE_TOKEN?.trim();
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();

  if (!token) {
    throw new CpoAvailabilityError(
      'SANITY_API_WRITE_TOKEN is required to update CPO availability.',
      'missing_write_token',
    );
  }

  if (!projectId) {
    throw new CpoAvailabilityError(
      'NEXT_PUBLIC_SANITY_PROJECT_ID is required to update CPO availability.',
      'write_failed',
    );
  }

  return createClient({
    projectId,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-02-10',
    token,
    useCdn: false,
    perspective: 'published',
  });
}

function hasSanityWriteToken(): boolean {
  return !!process.env.SANITY_API_WRITE_TOKEN?.trim();
}

function uniqueCpoProductKeys(orderDraft: CheckoutOrderDraft): string[] {
  return Array.from(
    new Set(
      orderDraft.items
        .filter((item) => item.lineType === 'cpo')
        .map((item) => item.productKey)
        .filter((productKey) => productKey.trim().length > 0),
    ),
  );
}

function isCpoBuyable(product: CpoAvailabilitySnapshot): boolean {
  return getCpoProductBuyability({
    isArchived: product.isArchived,
    isSellableOnline: product.isSellableOnline,
    priceCents: product.priceCents,
    availabilityStatus: product.availabilityStatus,
  }).isBuyable;
}

function parseTime(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(value);
}

function isHoldOwnedByOrder(
  product: CpoAvailabilitySnapshot,
  args: {
    orderNumber: string;
    paymentSessionId?: string | null;
  },
): boolean {
  return (
    product.holdOrderNumber === args.orderNumber ||
    (!!args.paymentSessionId &&
      product.holdPaymentSessionId === args.paymentSessionId)
  );
}

function shouldKeepExpiredHoldForOrder(
  order: CpoHeldOrderRow | null,
  now: Date,
): boolean {
  if (!order) {
    return false;
  }

  if (order.current_status !== 'awaiting_payment') {
    return (
      order.current_status !== 'cancelled' &&
      order.current_status !== 'returned'
    );
  }

  const payableUntil = parseTime(order.payable_until);

  return !Number.isNaN(payableUntil) && payableUntil > now.getTime();
}

async function loadHeldOrder(
  orderNumber: string | null | undefined,
): Promise<CpoHeldOrderRow | null> {
  if (!orderNumber) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('current_status, payable_until')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadCpoAvailabilityBySlugs(
  client: SanityClient,
  slugs: string[],
): Promise<Map<string, CpoAvailabilitySnapshot>> {
  if (slugs.length === 0) {
    return new Map();
  }

  const products = await client.fetch<CpoAvailabilitySnapshot[]>(
    queryCpoAvailabilityBySlugs,
    { slugs },
  );

  return new Map(
    products
      .filter((product) => product.slug)
      .map((product) => [product.slug as string, product]),
  );
}

async function loadCpoAvailabilityBySlug(
  client: SanityClient,
  slug: string,
): Promise<CpoAvailabilitySnapshot | null> {
  return client.fetch<CpoAvailabilitySnapshot | null>(
    queryCpoAvailabilityBySlug,
    { slug },
  );
}

function invalidateCpoAvailabilityCache(slug: string | null | undefined): void {
  try {
    revalidateTag('cpoProduct', { expire: 0 });
    revalidatePath('/certyfikowany-sprzet-uzywany/');

    if (slug) {
      revalidatePath(slug);

      const productSlug = extractCartProductSlug(slug);
      if (productSlug) {
        revalidateTag(`cpoProduct:${productSlug}`, { expire: 0 });
      }
    }
  } catch (error) {
    console.error('Failed to revalidate CPO availability cache.', {
      slug,
      error,
    });
  }
}

async function patchCpoAsAvailable(args: {
  client: SanityClient;
  product: CpoAvailabilitySnapshot;
  changedAt: string;
}): Promise<void> {
  await args.client
    .patch(args.product._id)
    .ifRevisionId(args.product._rev)
    .set({
      availabilityStatus: 'available',
      availabilityUpdatedAt: args.changedAt,
    })
    .unset(['holdUntil', 'holdOrderNumber', 'holdPaymentSessionId'])
    .commit();

  invalidateCpoAvailabilityCache(args.product.slug);
}

export async function releaseExpiredCpoHoldBySlug(
  slug: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!hasSanityWriteToken()) {
    return false;
  }

  const client = createSanityWriteClient();
  const product = await loadCpoAvailabilityBySlug(client, slug);

  if (!product || product.availabilityStatus !== 'on_hold') {
    return false;
  }

  const holdUntil = parseTime(product.holdUntil);

  if (Number.isNaN(holdUntil) || holdUntil > now.getTime()) {
    return false;
  }

  const heldOrder = await loadHeldOrder(product.holdOrderNumber);

  if (shouldKeepExpiredHoldForOrder(heldOrder, now)) {
    return false;
  }

  await patchCpoAsAvailable({
    client,
    product,
    changedAt: now.toISOString(),
  });

  return true;
}

export async function reserveCpoItemsForOrder(args: {
  orderDraft: CheckoutOrderDraft;
  orderNumber: string;
  paymentSessionId: string;
  now?: Date;
}): Promise<void> {
  const productKeys = uniqueCpoProductKeys(args.orderDraft);

  if (productKeys.length === 0) {
    return;
  }

  const client = createSanityWriteClient();
  const now = args.now ?? new Date();
  await Promise.all(
    productKeys.map((productKey) =>
      releaseExpiredCpoHoldBySlug(productKey, now),
    ),
  );

  const productsBySlug = await loadCpoAvailabilityBySlugs(client, productKeys);
  const unavailableProductKeys = productKeys.filter((productKey) => {
    const product = productsBySlug.get(productKey);

    return !product || !isCpoBuyable(product);
  });

  if (unavailableProductKeys.length > 0) {
    throw new CpoAvailabilityError(
      'One or more CPO products are no longer available.',
      'not_available',
      unavailableProductKeys,
    );
  }

  const transaction = client.transaction();
  const changedAt = now.toISOString();

  for (const productKey of productKeys) {
    const product = productsBySlug.get(productKey);

    if (!product) {
      continue;
    }

    transaction.patch(product._id, (patch) =>
      patch
        .ifRevisionId(product._rev)
        .set({
          availabilityStatus: 'on_hold',
          holdUntil: args.orderDraft.payableUntil,
          holdOrderNumber: args.orderNumber,
          holdPaymentSessionId: args.paymentSessionId,
          availabilityUpdatedAt: changedAt,
        })
        .unset(['soldOrderNumber']),
    );
  }

  try {
    await transaction.commit();
  } catch (error) {
    throw new CpoAvailabilityError(
      'Failed to reserve CPO products for the checkout order.',
      'write_conflict',
      productKeys,
      error,
    );
  }

  productKeys.forEach(invalidateCpoAvailabilityCache);
}

export async function releaseCpoReservationsForOrder(args: {
  orderDraft: CheckoutOrderDraft;
  orderNumber: string;
  paymentSessionId: string;
  now?: Date;
}): Promise<void> {
  const productKeys = uniqueCpoProductKeys(args.orderDraft);

  if (productKeys.length === 0) {
    return;
  }

  const client = createSanityWriteClient();
  const productsBySlug = await loadCpoAvailabilityBySlugs(client, productKeys);
  const changedAt = (args.now ?? new Date()).toISOString();

  await Promise.all(
    productKeys.map(async (productKey) => {
      const product = productsBySlug.get(productKey);

      if (
        !product ||
        product.availabilityStatus !== 'on_hold' ||
        !isHoldOwnedByOrder(product, args)
      ) {
        return;
      }

      await patchCpoAsAvailable({
        client,
        product,
        changedAt,
      });
    }),
  );
}

async function loadCpoOrderItemProductKeys(orderId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('product_key')
    .eq('order_id', orderId)
    .eq('line_type', 'cpo');

  if (error) {
    throw error;
  }

  return Array.from(
    new Set(
      ((data ?? []) as CpoOrderItemRow[])
        .map((item) => item.product_key)
        .filter((productKey) => productKey.trim().length > 0),
    ),
  );
}

export async function markCpoItemsSoldForOrder(args: {
  orderId: string;
  orderNumber: string;
  paymentSessionId: string | null;
  soldAt: string;
}): Promise<void> {
  const productKeys = await loadCpoOrderItemProductKeys(args.orderId);

  if (productKeys.length === 0) {
    return;
  }

  const client = createSanityWriteClient();
  const productsBySlug = await loadCpoAvailabilityBySlugs(client, productKeys);

  await Promise.all(
    productKeys.map(async (productKey) => {
      const product = productsBySlug.get(productKey);

      if (!product) {
        return;
      }

      if (
        product.availabilityStatus === 'sold_out' &&
        product.soldOrderNumber === args.orderNumber
      ) {
        return;
      }

      if (
        product.availabilityStatus !== 'on_hold' ||
        (!isHoldOwnedByOrder(product, args) && product.holdOrderNumber)
      ) {
        console.error('CPO product was not held by the paid order.', {
          orderId: args.orderId,
          orderNumber: args.orderNumber,
          productKey,
          availabilityStatus: product.availabilityStatus,
          holdOrderNumber: product.holdOrderNumber,
        });
        return;
      }

      await client
        .patch(product._id)
        .ifRevisionId(product._rev)
        .set({
          availabilityStatus: 'sold_out',
          soldOrderNumber: args.orderNumber,
          availabilityUpdatedAt: args.soldAt,
        })
        .unset(['holdUntil', 'holdOrderNumber', 'holdPaymentSessionId'])
        .commit();

      invalidateCpoAvailabilityCache(product.slug);
    }),
  );
}
