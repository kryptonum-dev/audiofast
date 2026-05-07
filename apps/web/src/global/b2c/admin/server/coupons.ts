import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import { parseAdminPagination } from '@/src/global/b2c/admin/server/pagination';
import {
  B2C_COUPON_DISCOUNT_TYPES,
  isFixedCouponDiscountType,
  isPercentCouponDiscountType,
  isProductScopedCouponDiscountType,
  isSupportedCouponDiscountType,
  normalizeCouponCode,
} from '@/src/global/b2c/utils/coupons';
import {
  getBoolean,
  getNumber,
  getString,
  isRecord,
} from '@/src/global/b2c/utils/orders';
import { createAdminClient } from '@/src/global/supabase/admin';
import type { Database } from '@/src/global/supabase/database.types';

type CouponRow = Database['public']['Tables']['coupons']['Row'];
type CouponInsert = Database['public']['Tables']['coupons']['Insert'];
type CouponUpdate = Database['public']['Tables']['coupons']['Update'];

export type AdminCouponDerivedStatus =
  | 'active'
  | 'expired'
  | 'inactive'
  | 'scheduled'
  | 'usage_limit_reached';

const ADMIN_COUPON_DERIVED_STATUSES: AdminCouponDerivedStatus[] = [
  'active',
  'expired',
  'inactive',
  'scheduled',
  'usage_limit_reached',
];

export type AdminCouponDto = {
  id: string;
  code: string;
  isActive: boolean;
  discountType: string;
  discountValueCents: number | null;
  discountPercent: number | null;
  productKeys: string[];
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  derivedStatus: AdminCouponDerivedStatus;
};

export type AdminCouponListResult = {
  coupons: AdminCouponDto[];
  pagination: {
    cursor: string | null;
    limit: number;
    nextCursor: string | null;
    total: number;
  };
};

export class AdminCouponError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_coupon_payload'
      | 'coupon_not_found'
      | 'coupon_code_conflict'
      | 'database_error',
    public readonly status: number,
    public readonly causeError: PostgrestError | Error | null = null,
  ) {
    super(message);
    this.name = 'AdminCouponError';
  }
}

const COUPON_SELECT =
  'code, created_at, discount_percent, discount_type, discount_value_cents, expires_at, id, is_active, product_keys, starts_at, updated_at, usage_count, usage_limit';

function normalizeInteger(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = getNumber(value);

  if (parsed === null || !Number.isInteger(parsed)) {
    throw new AdminCouponError(
      `${fieldName} must be an integer.`,
      'invalid_coupon_payload',
      400,
    );
  }

  return parsed;
}

function normalizeDate(value: unknown, fieldName: string): string | null {
  const raw = getString(value);

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new AdminCouponError(
      `${fieldName} must be a valid date.`,
      'invalid_coupon_payload',
      400,
    );
  }

  return parsed.toISOString();
}

function normalizeProductKeys(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new AdminCouponError(
      'productKeys must be an array.',
      'invalid_coupon_payload',
      400,
    );
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function getCouponDraft(args: {
  existing?: CouponRow;
  input: unknown;
  mode: 'create' | 'update';
}): CouponInsert {
  if (!isRecord(args.input)) {
    throw new AdminCouponError(
      'Coupon payload must be an object.',
      'invalid_coupon_payload',
      400,
    );
  }

  if ('usageCount' in args.input || 'usage_count' in args.input) {
    throw new AdminCouponError(
      'usage_count is managed by paid orders and cannot be edited.',
      'invalid_coupon_payload',
      400,
    );
  }

  const existing = args.existing;
  const rawCode =
    getString(args.input.code) ??
    (args.mode === 'update' && existing ? existing.code : null);
  const code = rawCode ? normalizeCouponCode(rawCode) : null;
  const discountType =
    getString(args.input.discountType) ??
    getString(args.input.discount_type) ??
    (args.mode === 'update' && existing ? existing.discount_type : null);

  if (!code) {
    throw new AdminCouponError(
      'code is required.',
      'invalid_coupon_payload',
      400,
    );
  }

  if (!discountType || !isSupportedCouponDiscountType(discountType)) {
    throw new AdminCouponError(
      `discountType must be one of ${B2C_COUPON_DISCOUNT_TYPES.join(', ')}.`,
      'invalid_coupon_payload',
      400,
    );
  }

  const discountValueCents =
    'discountValueCents' in args.input || 'discount_value_cents' in args.input
      ? normalizeInteger(
          args.input.discountValueCents ?? args.input.discount_value_cents,
          'discountValueCents',
        )
      : (existing?.discount_value_cents ?? null);
  const discountPercent =
    'discountPercent' in args.input || 'discount_percent' in args.input
      ? normalizeInteger(
          args.input.discountPercent ?? args.input.discount_percent,
          'discountPercent',
        )
      : (existing?.discount_percent ?? null);
  const productKeys =
    'productKeys' in args.input || 'product_keys' in args.input
      ? normalizeProductKeys(args.input.productKeys ?? args.input.product_keys)
      : (existing?.product_keys ?? []);
  const usageLimit =
    'usageLimit' in args.input || 'usage_limit' in args.input
      ? normalizeInteger(
          args.input.usageLimit ?? args.input.usage_limit,
          'usageLimit',
        )
      : (existing?.usage_limit ?? null);
  const startsAt =
    'startsAt' in args.input || 'starts_at' in args.input
      ? normalizeDate(args.input.startsAt ?? args.input.starts_at, 'startsAt')
      : (existing?.starts_at ?? null);
  const expiresAt =
    'expiresAt' in args.input || 'expires_at' in args.input
      ? normalizeDate(
          args.input.expiresAt ?? args.input.expires_at,
          'expiresAt',
        )
      : (existing?.expires_at ?? null);
  const isActive =
    getBoolean(args.input.isActive) ??
    getBoolean(args.input.is_active) ??
    existing?.is_active ??
    true;
  const usageCount = existing?.usage_count ?? 0;

  if (isFixedCouponDiscountType(discountType)) {
    if (discountValueCents === null || discountValueCents <= 0) {
      throw new AdminCouponError(
        'Fixed coupons require discountValueCents greater than 0.',
        'invalid_coupon_payload',
        400,
      );
    }
  } else if (
    discountPercent === null ||
    discountPercent <= 0 ||
    discountPercent > 100
  ) {
    throw new AdminCouponError(
      'Percent coupons require discountPercent between 1 and 100.',
      'invalid_coupon_payload',
      400,
    );
  }

  if (
    isProductScopedCouponDiscountType(discountType) &&
    productKeys.length === 0
  ) {
    throw new AdminCouponError(
      'Product-scoped coupons require at least one product key.',
      'invalid_coupon_payload',
      400,
    );
  }

  if (usageLimit !== null && usageLimit < usageCount) {
    throw new AdminCouponError(
      'usageLimit cannot be lower than current usageCount.',
      'invalid_coupon_payload',
      400,
    );
  }

  if (startsAt && expiresAt && Date.parse(startsAt) >= Date.parse(expiresAt)) {
    throw new AdminCouponError(
      'startsAt must be before expiresAt.',
      'invalid_coupon_payload',
      400,
    );
  }

  return {
    code,
    discount_percent: isPercentCouponDiscountType(discountType)
      ? discountPercent
      : null,
    discount_type: discountType,
    discount_value_cents: isFixedCouponDiscountType(discountType)
      ? discountValueCents
      : null,
    expires_at: expiresAt,
    is_active: isActive,
    product_keys: productKeys.length > 0 ? productKeys : null,
    starts_at: startsAt,
    usage_limit: usageLimit,
  };
}

export function getAdminCouponDerivedStatus(
  row: Pick<
    CouponRow,
    'expires_at' | 'is_active' | 'starts_at' | 'usage_count' | 'usage_limit'
  >,
  now: Date,
): AdminCouponDerivedStatus {
  if (!row.is_active) {
    return 'inactive';
  }

  if (row.starts_at && Date.parse(row.starts_at) > now.getTime()) {
    return 'scheduled';
  }

  if (row.expires_at && Date.parse(row.expires_at) <= now.getTime()) {
    return 'expired';
  }

  if (row.usage_limit !== null && row.usage_count >= row.usage_limit) {
    return 'usage_limit_reached';
  }

  return 'active';
}

function mapCoupon(row: CouponRow, now: Date): AdminCouponDto {
  return {
    id: row.id,
    code: row.code,
    isActive: row.is_active,
    discountType: row.discount_type,
    discountValueCents: row.discount_value_cents,
    discountPercent: row.discount_percent,
    productKeys: row.product_keys ?? [],
    usageLimit: row.usage_limit,
    usageCount: row.usage_count,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    derivedStatus: getAdminCouponDerivedStatus(row, now),
  };
}

async function ensureCouponCodeAvailable(args: {
  code: string;
  excludingCouponId?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('coupons')
    .select('id')
    .ilike('code', args.code)
    .maybeSingle();

  if (error) {
    throw new AdminCouponError(
      'Failed to check coupon code uniqueness.',
      'database_error',
      500,
      error,
    );
  }

  if (data && data.id !== args.excludingCouponId) {
    throw new AdminCouponError(
      'Coupon code already exists.',
      'coupon_code_conflict',
      409,
    );
  }
}

async function loadCouponRow(couponId: string): Promise<CouponRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('coupons')
    .select(COUPON_SELECT)
    .eq('id', couponId)
    .maybeSingle();

  if (error) {
    throw new AdminCouponError(
      'Failed to load the B2C coupon.',
      'database_error',
      500,
      error,
    );
  }

  if (!data) {
    throw new AdminCouponError(
      'The requested B2C coupon could not be found.',
      'coupon_not_found',
      404,
    );
  }

  return data as CouponRow;
}

export async function loadAdminCoupons(args: {
  now?: Date;
  searchParams: URLSearchParams;
}): Promise<AdminCouponListResult> {
  const now = args.now ?? new Date();
  const pagination = parseAdminPagination(args.searchParams);
  const offset = Number.parseInt(pagination.cursor ?? '0', 10);
  const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const rangeEnd = safeOffset + pagination.limit - 1;
  const q = getString(args.searchParams.get('q'));
  const isActive = args.searchParams.get('isActive');
  const discountType = getString(args.searchParams.get('discountType'));
  const derivedStatus = getString(args.searchParams.get('derivedStatus'));

  if (
    derivedStatus &&
    !ADMIN_COUPON_DERIVED_STATUSES.includes(
      derivedStatus as AdminCouponDerivedStatus,
    )
  ) {
    throw new AdminCouponError(
      'Unknown coupon derivedStatus filter.',
      'invalid_coupon_payload',
      400,
    );
  }

  const supabase = createAdminClient();
  let query = supabase
    .from('coupons')
    .select(COUPON_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (q) {
    query = query.ilike('code', `%${normalizeCouponCode(q)}%`);
  }

  if (isActive === 'true' || isActive === '1') {
    query = query.eq('is_active', true);
  } else if (isActive === 'false' || isActive === '0') {
    query = query.eq('is_active', false);
  }

  if (discountType) {
    if (!isSupportedCouponDiscountType(discountType)) {
      throw new AdminCouponError(
        'Unknown coupon discountType filter.',
        'invalid_coupon_payload',
        400,
      );
    }

    query = query.eq('discount_type', discountType);
  }

  if (!derivedStatus) {
    query = query.range(safeOffset, rangeEnd);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new AdminCouponError(
      'Failed to load B2C coupons.',
      'database_error',
      500,
      error,
    );
  }

  const mappedCoupons = ((data ?? []) as CouponRow[]).map((row) =>
    mapCoupon(row, now),
  );
  const filteredCoupons = derivedStatus
    ? mappedCoupons.filter((coupon) => coupon.derivedStatus === derivedStatus)
    : mappedCoupons;
  const coupons = derivedStatus
    ? filteredCoupons.slice(safeOffset, rangeEnd + 1)
    : filteredCoupons;
  const total = derivedStatus
    ? filteredCoupons.length
    : (count ?? coupons.length);
  const nextOffset = safeOffset + coupons.length;

  return {
    coupons,
    pagination: {
      cursor: safeOffset > 0 ? String(safeOffset) : null,
      limit: pagination.limit,
      nextCursor: nextOffset < total ? String(nextOffset) : null,
      total,
    },
  };
}

export async function loadAdminCoupon(args: {
  couponId: string;
  now?: Date;
}): Promise<AdminCouponDto> {
  return mapCoupon(await loadCouponRow(args.couponId), args.now ?? new Date());
}

export async function createAdminCoupon(args: {
  input: unknown;
  now?: Date;
}): Promise<AdminCouponDto> {
  const now = args.now ?? new Date();
  const draft = getCouponDraft({
    input: args.input,
    mode: 'create',
  });

  await ensureCouponCodeAvailable({ code: draft.code });

  const timestamp = now.toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('coupons')
    .insert({
      ...draft,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select(COUPON_SELECT)
    .single();

  if (error) {
    throw new AdminCouponError(
      'Failed to create the B2C coupon.',
      'database_error',
      500,
      error,
    );
  }

  return mapCoupon(data as CouponRow, now);
}

export async function updateAdminCoupon(args: {
  couponId: string;
  input: unknown;
  now?: Date;
}): Promise<AdminCouponDto> {
  const now = args.now ?? new Date();
  const existing = await loadCouponRow(args.couponId);
  const draft = getCouponDraft({
    existing,
    input: args.input,
    mode: 'update',
  });

  if (draft.code !== existing.code) {
    await ensureCouponCodeAvailable({
      code: draft.code,
      excludingCouponId: existing.id,
    });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('coupons')
    .update({
      ...draft,
      updated_at: now.toISOString(),
    } satisfies CouponUpdate)
    .eq('id', args.couponId)
    .select(COUPON_SELECT)
    .single();

  if (error) {
    throw new AdminCouponError(
      'Failed to update the B2C coupon.',
      'database_error',
      500,
      error,
    );
  }

  return mapCoupon(data as CouponRow, now);
}

export const adminCouponTesting = {
  getCouponDraft,
  getDerivedStatus: getAdminCouponDerivedStatus,
};
