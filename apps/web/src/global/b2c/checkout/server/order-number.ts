import { createAdminClient } from '@/src/global/supabase/admin';

const ORDER_NUMBER_PREFIX = 'AF';

function padOrderSequence(value: number): string {
  return value.toString().padStart(5, '0');
}

function extractOrderSequence(
  orderNumber: string,
  year: number,
): number | null {
  const prefix = `${ORDER_NUMBER_PREFIX}-${year}-`;

  if (!orderNumber.startsWith(prefix)) {
    return null;
  }

  const rawSequence = orderNumber.slice(prefix.length);
  const sequence = Number.parseInt(rawSequence, 10);

  return Number.isFinite(sequence) ? sequence : null;
}

export async function generateNextCheckoutOrderNumber(
  now: Date = new Date(),
): Promise<string> {
  const supabase = createAdminClient();
  const year = now.getUTCFullYear();
  const prefix = `${ORDER_NUMBER_PREFIX}-${year}-`;

  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .like('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const lastSequence =
    (data?.order_number
      ? extractOrderSequence(data.order_number, year)
      : null) ?? 0;

  return `${prefix}${padOrderSequence(lastSequence + 1)}`;
}
