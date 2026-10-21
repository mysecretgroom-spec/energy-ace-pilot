create or replace function public.admin_list_subscriptions(p_env text default 'live')
returns jsonb language plpgsql stable security definer set search_path = public, saas as $$
begin
  if not public.is_saas_admin(auth.uid()) then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(x order by x.updated_at desc) from (
    select s.id, s.user_id, s.price_id, s.status, s.current_period_end, s.cancel_at_period_end,
      s.scheduled_price_id, s.paddle_customer_id, s.created_at, s.updated_at,
      u.email, trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) as name
    from public.subscriptions s left join saas.users u on u.user_id = s.user_id
    where s.environment = p_env) x), '[]'::jsonb);
end $$;
revoke all on function public.admin_list_subscriptions(text) from public, anon;
grant execute on function public.admin_list_subscriptions(text) to authenticated;