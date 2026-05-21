alter table public.orders
  add column if not exists expected_delivery_from date,
  add column if not exists expected_delivery_to date;

alter table public.orders
  drop constraint if exists orders_expected_delivery_range_chk;

alter table public.orders
  add constraint orders_expected_delivery_range_chk
  check (
    expected_delivery_to is null
    or (
      expected_delivery_from is not null
      and expected_delivery_to >= expected_delivery_from
    )
  );

comment on column public.orders.expected_delivery_from is
  'First expected delivery date shown to operators and customers.';

comment on column public.orders.expected_delivery_to is
  'Optional last expected delivery date when Audiofast provides a delivery window.';
