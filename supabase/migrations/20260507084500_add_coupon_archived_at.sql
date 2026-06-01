alter table public.coupons
add column if not exists archived_at timestamptz null;

alter table public.coupons
drop constraint if exists coupons_code_key;

drop index if exists public.coupons_code_key;

create unique index if not exists coupons_code_unarchived_key
on public.coupons (lower(code))
where archived_at is null;
