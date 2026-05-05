import { createClient } from '@supabase/supabase-js';

import { E2E_EMAIL_DOMAIN } from './constants';

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase E2E env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.e2e.local.',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function buildE2eEmail(args: {
  prefix: string;
  parallelIndex: number;
}) {
  const uniqueId = `${Date.now()}-${args.parallelIndex}`;

  return `${args.prefix}-${uniqueId}@${E2E_EMAIL_DOMAIN}`;
}

export async function cleanupCheckoutData(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .eq('customer_email', email);

  if (ordersError) {
    throw ordersError;
  }

  const orderIds = orders.map((order) => order.id);

  if (orderIds.length > 0) {
    await supabase.from('order_items').delete().in('order_id', orderIds);
    await supabase
      .from('order_cancellation_requests')
      .delete()
      .in('order_id', orderIds);
    await supabase.from('return_cases').delete().in('order_id', orderIds);
    await supabase.from('orders').delete().in('id', orderIds);
  }

  await supabase.from('customer_profiles').delete().eq('email', email);
}

export async function countCheckoutOrdersByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_email', email);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
