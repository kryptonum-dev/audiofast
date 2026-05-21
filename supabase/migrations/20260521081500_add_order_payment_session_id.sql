alter table public.orders
  add column if not exists payment_session_id text;

alter table public.orders
  drop constraint if exists orders_payment_session_id_key;

alter table public.orders
  add constraint orders_payment_session_id_key unique (payment_session_id);

comment on column public.orders.payment_session_id is
  'Unique provider session id used for Przelewy24 transaction registration and webhook lookup.';
