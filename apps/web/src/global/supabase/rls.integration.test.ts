/**
 * RLS integration tests — proves that the policies installed by the
 * `harden_b2c_rls_and_function_search_path` migration actually isolate
 * customer data across Supabase roles.
 *
 * This suite is intentionally opt-in: it runs against the real Supabase
 * project and creates / deletes real rows (auth users, customer profiles,
 * orders, order items, return cases). It will silently skip unless all
 * three credentials are present in the environment:
 *
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * To run locally:
 *
 *   cd apps/web
 *   SUPABASE_SERVICE_ROLE_KEY=... bun run test -- rls.integration
 *
 * The suite is careful to:
 *   1. Scope every fixture with a unique `testRunId` prefix so parallel or
 *      repeated runs cannot collide with one another or with real data.
 *   2. Tear down every single row (and both auth users) in afterAll, even
 *      when tests fail, via try/finally semantics around the cleanup.
 *   3. Bypass the global MSW handler so real Supabase traffic is allowed
 *      for just this file.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { server } from '@/src/test/msw/server';

import { createAdminClient } from './admin';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasCredentials = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey,
);

const testRunId = `rls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Fixture = {
  authUserId: string;
  profileId: string;
  orderId: string;
  orderItemId: string;
  returnCaseId: string;
  orderNumber: string;
  email: string;
  accessToken: string;
};

describe.skipIf(!hasCredentials)('Supabase RLS (integration)', () => {
  let admin: SupabaseClient<Database>;
  let alice: Fixture;
  let bob: Fixture;

  // Registry of every resource we successfully created, tracked AT THE MOMENT
  // of creation (before any subsequent step can throw). `afterAll` drains this
  // in FK-safe reverse order so a partial-failure fixture cannot orphan rows.
  const createdReturnCaseIds: string[] = [];
  const createdOrderItemIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdProfileIds: string[] = [];
  const createdAuthUserIds: string[] = [];

  const createUserFixture = async (
    label: 'alice' | 'bob',
  ): Promise<Fixture> => {
    const email = `${testRunId}-${label}@audiofast.test`;
    const password = `${testRunId}-${label}-${Math.random().toString(36).slice(2, 10)}`;

    // 1. Create a real auth user via the admin API.
    const { data: userData, error: userError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { rls_integration_test: testRunId },
      });
    if (userError || !userData.user) {
      throw new Error(
        `Failed to create auth user for ${label}: ${userError?.message ?? 'no user returned'}`,
      );
    }
    const authUserId = userData.user.id;
    createdAuthUserIds.push(authUserId);

    // 2. Create the `customer_profiles` bridge row.
    const { data: profile, error: profileError } = await admin
      .from('customer_profiles')
      .insert({
        auth_user_id: authUserId,
        email,
        first_name: label === 'alice' ? 'Alice' : 'Bob',
        last_name: 'Tester',
        phone: '500000000',
        default_shipping_address: {
          line1: 'ul. Testowa 1',
          city: 'Warszawa',
          postal_code: '00-001',
          country: 'PL',
        },
      })
      .select('id')
      .single();
    if (profileError || !profile) {
      throw new Error(
        `Failed to create customer_profiles for ${label}: ${profileError?.message ?? 'no row returned'}`,
      );
    }
    createdProfileIds.push(profile.id);

    // 3. Create an order for this profile.
    const orderNumber = `${testRunId}-${label}-ord`.toUpperCase();
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_profile_id: profile.id,
        customer_email: email,
        current_status: 'awaiting_payment',
        status_history: [
          {
            status: 'awaiting_payment',
            at: new Date().toISOString(),
            source: 'rls_integration_test',
          },
        ],
        payable_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        payment_provider: 'przelewy24',
        customer_snapshot: { email, first_name: 'Alice', last_name: 'Tester' },
        shipping_address_snapshot: {
          line1: 'ul. Testowa 1',
          city: 'Warszawa',
          postal_code: '00-001',
          country: 'PL',
        },
        subtotal_cents: 10_000,
        discount_total_cents: 0,
        grand_total_cents: 10_000,
      })
      .select('id')
      .single();
    if (orderError || !order) {
      throw new Error(
        `Failed to create order for ${label}: ${orderError?.message ?? 'no row returned'}`,
      );
    }
    createdOrderIds.push(order.id);

    // 4. Create one order_items row.
    const { data: orderItem, error: orderItemError } = await admin
      .from('order_items')
      .insert({
        order_id: order.id,
        line_type: 'standard',
        line_position: 1,
        quantity: 1,
        product_key: `${testRunId}-${label}-sku`,
        product_name: `RLS Test Product (${label})`,
        brand_name: 'Audiofast Test',
        unit_price_cents: 10_000,
        line_subtotal_cents: 10_000,
        line_discount_total_cents: 0,
        line_total_cents: 10_000,
        item_snapshot: { test: true },
        is_returnable: true,
      })
      .select('id')
      .single();
    if (orderItemError || !orderItem) {
      throw new Error(
        `Failed to create order_items for ${label}: ${orderItemError?.message ?? 'no row returned'}`,
      );
    }
    createdOrderItemIds.push(orderItem.id);

    // 5. Create a return_cases row so we can test that scope too. The reason
    //    column is prefixed with `testRunId` so the safety-net prefix sweep in
    //    afterAll can scope strictly to this run and never touch rows from a
    //    parallel run.
    const { data: returnCase, error: returnCaseError } = await admin
      .from('return_cases')
      .insert({
        order_id: order.id,
        status: 'open',
        reason: `${testRunId}-return-${label}`,
      })
      .select('id')
      .single();
    if (returnCaseError || !returnCase) {
      throw new Error(
        `Failed to create return_cases for ${label}: ${returnCaseError?.message ?? 'no row returned'}`,
      );
    }
    createdReturnCaseIds.push(returnCase.id);

    // 6. Sign in as this user with the anon key so we get a real access token.
    const anonClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: signInError } =
      await anonClient.auth.signInWithPassword({ email, password });
    if (signInError || !session.session) {
      throw new Error(
        `Failed to sign in ${label}: ${signInError?.message ?? 'no session returned'}`,
      );
    }

    return {
      authUserId,
      profileId: profile.id,
      orderId: order.id,
      orderItemId: orderItem.id,
      returnCaseId: returnCase.id,
      orderNumber,
      email,
      accessToken: session.session.access_token,
    };
  };

  const createAnonClient = () =>
    createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const createUserScopedClient = (accessToken: string) =>
    createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

  beforeAll(async () => {
    // This suite talks to the real Supabase project. MSW is configured with
    // `onUnhandledRequest: 'error'` globally, which breaks real network I/O
    // (and `passthrough()` is explicitly rejected by MSW under that strategy).
    // Vitest runs each test file in its own worker, so closing the MSW server
    // here only affects this file.
    server.close();

    admin = createAdminClient();

    alice = await createUserFixture('alice');
    bob = await createUserFixture('bob');
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;

    const cleanupErrors: unknown[] = [];
    const runStep = async (label: string, fn: () => PromiseLike<unknown>) => {
      try {
        await fn();
      } catch (error) {
        cleanupErrors.push({ label, error });
      }
    };

    // 1. Drain the creation registry in FK-safe reverse order. Every id in
    //    these arrays corresponds to a row we KNOW was created successfully
    //    during this run, regardless of whether `createUserFixture` later
    //    threw. `.in(...)` with an empty array is a no-op, so empty registries
    //    are safe.
    if (createdReturnCaseIds.length > 0) {
      await runStep('return_cases', () =>
        admin.from('return_cases').delete().in('id', createdReturnCaseIds),
      );
    }
    if (createdOrderItemIds.length > 0) {
      await runStep('order_items', () =>
        admin.from('order_items').delete().in('id', createdOrderItemIds),
      );
    }
    if (createdOrderIds.length > 0) {
      await runStep('orders', () =>
        admin.from('orders').delete().in('id', createdOrderIds),
      );
    }
    if (createdProfileIds.length > 0) {
      await runStep('customer_profiles', () =>
        admin.from('customer_profiles').delete().in('id', createdProfileIds),
      );
    }
    for (const authUserId of createdAuthUserIds) {
      await runStep(`auth.users:${authUserId}`, async () => {
        const { error } = await admin.auth.admin.deleteUser(authUserId);
        if (error) throw error;
      });
    }

    // 2. Belt-and-suspenders prefix sweep. If this run (or a previous aborted
    //    run from the same process that crashed before reaching afterAll) ever
    //    managed to insert a row without registering it, the prefix-scoped
    //    cleanup below catches it. Everything is keyed on `testRunId`, so this
    //    cannot touch real production data or other test runs.
    await runStep('sweep:return_cases', () =>
      admin
        .from('return_cases')
        .delete()
        .like('reason', `${testRunId}-return-%`),
    );
    await runStep('sweep:order_items', () =>
      admin
        .from('order_items')
        .delete()
        .like('product_key', `${testRunId}-%-sku`),
    );
    await runStep('sweep:orders', () =>
      admin
        .from('orders')
        .delete()
        .like('order_number', `${testRunId.toUpperCase()}-%`),
    );
    await runStep('sweep:customer_profiles', () =>
      admin
        .from('customer_profiles')
        .delete()
        .like('email', `${testRunId}-%@audiofast.test`),
    );

    if (cleanupErrors.length > 0) {
      // Surface cleanup failures loudly — leftover rows will contaminate
      // future runs. We intentionally do NOT throw here because afterAll
      // should still finish; we just log so the CI log carries the trace.
      console.error('[rls.integration] cleanup errors:', cleanupErrors);
    }
  }, 60_000);

  describe('anon role', () => {
    it('cannot read any orders', async () => {
      const anon = createAnonClient();
      const { data, error } = await anon
        .from('orders')
        .select('id')
        .in('id', [alice.orderId, bob.orderId]);
      // RLS turns this into an empty result set, not an explicit error.
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it('cannot read any customer_profiles', async () => {
      const anon = createAnonClient();
      const { data, error } = await anon
        .from('customer_profiles')
        .select('id')
        .in('id', [alice.profileId, bob.profileId]);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it('cannot read any order_items', async () => {
      const anon = createAnonClient();
      const { data, error } = await anon
        .from('order_items')
        .select('id')
        .in('id', [alice.orderItemId, bob.orderItemId]);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it('cannot read any return_cases', async () => {
      const anon = createAnonClient();
      const { data, error } = await anon
        .from('return_cases')
        .select('id')
        .in('id', [alice.returnCaseId, bob.returnCaseId]);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it('cannot INSERT into orders (write grant revoked)', async () => {
      const anon = createAnonClient();
      const { error } = await anon.from('orders').insert({
        order_number: `${testRunId}-anon-attempt`,
        customer_email: 'anon@audiofast.test',
        current_status: 'awaiting_payment',
        status_history: [],
        payable_until: new Date().toISOString(),
        payment_provider: 'przelewy24',
        customer_snapshot: {},
        shipping_address_snapshot: {},
        subtotal_cents: 0,
        discount_total_cents: 0,
        grand_total_cents: 0,
      });
      // Either the grant layer (permission denied, 42501) or RLS (42501) will
      // reject this; we just require that it FAILS rather than silently
      // succeeding.
      expect(error).not.toBeNull();
    });
  });

  describe('authenticated role (Alice)', () => {
    it('sees exactly her own order and not Bob`s', async () => {
      const aliceClient = createUserScopedClient(alice.accessToken);
      const { data, error } = await aliceClient
        .from('orders')
        .select('id, order_number')
        .in('id', [alice.orderId, bob.orderId]);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
      expect((data ?? [])[0]!.id).toBe(alice.orderId);
    });

    it('sees exactly her own customer_profiles row', async () => {
      const aliceClient = createUserScopedClient(alice.accessToken);
      const { data, error } = await aliceClient
        .from('customer_profiles')
        .select('id, email')
        .in('id', [alice.profileId, bob.profileId]);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
      expect((data ?? [])[0]!.id).toBe(alice.profileId);
      expect((data ?? [])[0]!.email).toBe(alice.email);
    });

    it('sees exactly her own order_items and not Bob`s', async () => {
      const aliceClient = createUserScopedClient(alice.accessToken);
      const { data, error } = await aliceClient
        .from('order_items')
        .select('id, order_id')
        .in('id', [alice.orderItemId, bob.orderItemId]);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
      expect((data ?? [])[0]!.id).toBe(alice.orderItemId);
      expect((data ?? [])[0]!.order_id).toBe(alice.orderId);
    });

    it('sees exactly her own return_cases and not Bob`s', async () => {
      const aliceClient = createUserScopedClient(alice.accessToken);
      const { data, error } = await aliceClient
        .from('return_cases')
        .select('id, order_id')
        .in('id', [alice.returnCaseId, bob.returnCaseId]);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
      expect((data ?? [])[0]!.id).toBe(alice.returnCaseId);
    });

    it('cannot INSERT into orders (authenticated write grant revoked)', async () => {
      const aliceClient = createUserScopedClient(alice.accessToken);
      const { error } = await aliceClient.from('orders').insert({
        order_number: `${testRunId}-alice-attempt`,
        customer_profile_id: alice.profileId,
        customer_email: alice.email,
        current_status: 'awaiting_payment',
        status_history: [],
        payable_until: new Date().toISOString(),
        payment_provider: 'przelewy24',
        customer_snapshot: {},
        shipping_address_snapshot: {},
        subtotal_cents: 0,
        discount_total_cents: 0,
        grand_total_cents: 0,
      });
      // Writes must flow through the service role only. The authenticated
      // role has no INSERT grant after the hardening migration.
      expect(error).not.toBeNull();
    });
  });

  describe('authenticated role (Bob)', () => {
    it('sees exactly his own order and not Alice`s', async () => {
      const bobClient = createUserScopedClient(bob.accessToken);
      const { data, error } = await bobClient
        .from('orders')
        .select('id')
        .in('id', [alice.orderId, bob.orderId]);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
      expect((data ?? [])[0]!.id).toBe(bob.orderId);
    });

    it('sees exactly his own customer_profiles row', async () => {
      const bobClient = createUserScopedClient(bob.accessToken);
      const { data, error } = await bobClient
        .from('customer_profiles')
        .select('id')
        .in('id', [alice.profileId, bob.profileId]);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
      expect((data ?? [])[0]!.id).toBe(bob.profileId);
    });
  });

  describe('service role (admin)', () => {
    it('sees every fixture row across both users', async () => {
      const { data: orders, error: ordersError } = await admin
        .from('orders')
        .select('id')
        .in('id', [alice.orderId, bob.orderId]);
      expect(ordersError).toBeNull();
      expect((orders ?? []).map((r) => r.id).sort()).toEqual(
        [alice.orderId, bob.orderId].sort(),
      );

      const { data: profiles, error: profilesError } = await admin
        .from('customer_profiles')
        .select('id')
        .in('id', [alice.profileId, bob.profileId]);
      expect(profilesError).toBeNull();
      expect((profiles ?? []).map((r) => r.id).sort()).toEqual(
        [alice.profileId, bob.profileId].sort(),
      );
    });
  });
});
