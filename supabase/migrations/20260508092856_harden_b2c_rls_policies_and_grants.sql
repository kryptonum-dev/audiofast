-- Align B2C customer RLS with the implemented OTP identity model.
-- Customer-facing code authorizes by verified Supabase auth email, while server
-- mutations stay behind the service-role backend where business rules run.

alter table public.customer_profiles force row level security;
alter table public.orders force row level security;
alter table public.order_items force row level security;
alter table public.return_cases force row level security;
alter table public.order_cancellation_requests force row level security;
alter table public.coupons force row level security;

drop policy if exists customer_profiles_select_own on public.customer_profiles;
create policy customer_profiles_select_own
on public.customer_profiles
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
on public.orders
for select
to authenticated
using (
  lower(customer_email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and lower(o.customer_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists return_cases_select_own on public.return_cases;
create policy return_cases_select_own
on public.return_cases
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = return_cases.order_id
      and lower(o.customer_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists order_cancellation_requests_select_own on public.order_cancellation_requests;
create policy order_cancellation_requests_select_own
on public.order_cancellation_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_cancellation_requests.order_id
      and lower(o.customer_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Public read coupons" on public.coupons;
drop policy if exists coupons_no_client_select on public.coupons;
create policy coupons_no_client_select
on public.coupons
for select
to public
using (false);

grant select on table
  public.customer_profiles,
  public.orders,
  public.order_items,
  public.return_cases,
  public.order_cancellation_requests
to authenticated;

revoke select on table
  public.customer_profiles,
  public.orders,
  public.order_items,
  public.return_cases,
  public.order_cancellation_requests,
  public.coupons
from anon;

revoke select on table public.coupons from authenticated;

revoke insert, update, delete, truncate, references, trigger on table
  public.customer_profiles,
  public.orders,
  public.order_items,
  public.return_cases,
  public.order_cancellation_requests,
  public.coupons,
  public.pricing_variants,
  public.pricing_option_groups,
  public.pricing_option_values,
  public.pricing_numeric_rules
from anon, authenticated;

revoke execute on function public.ingest_pricing_json(text, jsonb)
from public, anon, authenticated;

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;

grant execute on function public.ingest_pricing_json(text, jsonb) to service_role;

create index if not exists idx_orders_lower_customer_email_created_at
on public.orders (lower(customer_email), created_at desc);

create index if not exists idx_order_cancellation_requests_resolved_by
on public.order_cancellation_requests (resolved_by);

create index if not exists idx_pricing_numeric_rules_value_id
on public.pricing_numeric_rules (value_id);

create index if not exists idx_pricing_option_groups_parent_value_id
on public.pricing_option_groups (parent_value_id);

drop index if exists public.return_cases_one_open_per_order_idx;

drop trigger if exists trg_order_cancellation_requests_set_updated_at
on public.order_cancellation_requests;

create trigger trg_order_cancellation_requests_set_updated_at
before update on public.order_cancellation_requests
for each row
execute function public.set_updated_at();
