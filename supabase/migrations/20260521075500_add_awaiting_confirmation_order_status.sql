alter table public.orders
  drop constraint if exists orders_current_status_chk;

alter table public.orders
  add constraint orders_current_status_chk
  check (
    current_status = any (
      array[
        'awaiting_payment'::text,
        'awaiting_confirmation'::text,
        'paid'::text,
        'processing'::text,
        'shipped'::text,
        'completed'::text,
        'cancelled'::text,
        'returned'::text
      ]
    )
  );

update public.orders
set current_status = 'awaiting_confirmation'
where current_status = 'paid'
  and paid_at is not null;

create or replace function public.admin_accept_order_cancellation(
  p_order_number text,
  p_request_id uuid,
  p_admin_note text,
  p_resolved_at timestamptz,
  p_resolved_by text,
  p_actor jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_request public.order_cancellation_requests%rowtype;
  v_updated_order public.orders%rowtype;
  v_updated_request public.order_cancellation_requests%rowtype;
  v_history jsonb;
  v_history_entry jsonb;
begin
  select *
  into v_order
  from public.orders
  where order_number = p_order_number
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  select *
  into v_request
  from public.order_cancellation_requests
  where id = p_request_id
    and order_id = v_order.id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'cancellation_request_not_found');
  end if;

  if v_request.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'case_not_open');
  end if;

  if v_order.current_status not in ('awaiting_confirmation', 'paid', 'processing') then
    return jsonb_build_object('ok', false, 'error', 'cancellation_not_eligible');
  end if;

  v_history := case
    when jsonb_typeof(v_order.status_history::jsonb) = 'array'
      then v_order.status_history::jsonb
    else '[]'::jsonb
  end;
  v_history_entry := jsonb_build_object(
    'actorEmail', p_actor ->> 'email',
    'actorId', p_actor ->> 'id',
    'actorName', p_actor ->> 'name',
    'changedAt', to_char(p_resolved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'note', p_admin_note,
    'previousStatus', v_order.current_status,
    'source', 'admin',
    'status', 'cancelled'
  );

  update public.orders
  set
    cancelled_at = p_resolved_at,
    current_status = 'cancelled',
    status_history = v_history || jsonb_build_array(v_history_entry),
    updated_at = p_resolved_at
  where id = v_order.id
  returning * into v_updated_order;

  update public.order_cancellation_requests
  set
    admin_note = p_admin_note,
    resolved_at = p_resolved_at,
    resolved_by = p_resolved_by,
    status = 'accepted',
    updated_at = p_resolved_at
  where id = v_request.id
  returning * into v_updated_request;

  return jsonb_build_object(
    'ok', true,
    'previousStatus', v_order.current_status,
    'order', to_jsonb(v_updated_order),
    'cancellationRequest', to_jsonb(v_updated_request)
  );
end;
$$;
