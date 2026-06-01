-- Keep auth helper calls as initplans in B2C RLS policies.

drop policy if exists customer_profiles_select_own on public.customer_profiles;
create policy customer_profiles_select_own
on public.customer_profiles
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or lower(email) = lower((select auth.email()))
);

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own
on public.orders
for select
to authenticated
using (
  lower(customer_email) = lower((select auth.email()))
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
      and lower(o.customer_email) = lower((select auth.email()))
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
      and lower(o.customer_email) = lower((select auth.email()))
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
      and lower(o.customer_email) = lower((select auth.email()))
  )
);
