create or replace function public.admin_get_metrics(p_env text default 'live')
returns jsonb language plpgsql stable security definer set search_path = public, saas as $$
declare r jsonb;
begin
  if not public.is_saas_admin(auth.uid()) then raise exception 'forbidden'; end if;
  with subs as (
    select s.*, case
      when s.price_id = 'classique_monthly' then 49.99
      when s.price_id = 'classique_yearly' then 499.9/12
      when s.price_id = 'premium_monthly' then 89.99
      when s.price_id = 'premium_yearly' then 899.9/12
      else 0 end as mrr
    from public.subscriptions s where s.environment = p_env
  ),
  active as (select * from subs where status in ('active','trialing','past_due')),
  days as (select generate_series(current_date - 89, current_date, '1 day')::date d)
  select jsonb_build_object(
    'mrr', coalesce((select sum(mrr) from active where status <> 'past_due'),0),
    'mrr_at_risk', coalesce((select sum(mrr) from active where status = 'past_due' or cancel_at_period_end),0),
    'paying', (select count(*) from active where status <> 'past_due'),
    'past_due', (select count(*) from active where status = 'past_due'),
    'canceled_30d', (select count(*) from subs where status = 'canceled' and updated_at > now() - interval '30 days'),
    'plan_split', coalesce((select jsonb_object_agg(price_id, n) from (select price_id, count(*) n from active group by price_id) x), '{}'::jsonb),
    'mrr_series', (select jsonb_agg(jsonb_build_object('d', d, 'mrr', coalesce((select sum(mrr) from subs where created_at::date <= d and (status <> 'canceled' or updated_at::date > d)),0)) order by d) from days),
    'users_total', (select count(*) from saas.users),
    'access', coalesce((select jsonb_object_agg(coalesce(app_access,'none'), n) from (select app_access, count(*) n from saas.access_state group by 1) x), '{}'::jsonb),
    'beta', (select count(*) from saas.access_state where is_beta_tester),
    'signups_series', (select jsonb_agg(jsonb_build_object('d', d, 'n', (select count(*) from saas.users u where u.created_at::date = d)) order by d) from days),
    'signups_30d', (select count(*) from saas.users where created_at > now() - interval '30 days'),
    'signups_prev_30d', (select count(*) from saas.users where created_at between now() - interval '60 days' and now() - interval '30 days'),
    'active_users_7d', (select count(distinct user_id) from public.rdv where updated_at > now() - interval '7 days'),
    'active_users_30d', (select count(distinct user_id) from public.rdv where updated_at > now() - interval '30 days'),
    'ai_cost_30d', coalesce((select sum(estimated_cost_usd) from public.ai_usage where created_at > now() - interval '30 days'),0),
    'ai_calls_30d', (select count(*) from public.ai_usage where created_at > now() - interval '30 days'),
    'ai_top_functions', coalesce((select jsonb_agg(x) from (select function_name f, count(*) n, round(sum(estimated_cost_usd)::numeric,2) c from public.ai_usage where created_at > now() - interval '30 days' group by 1 order by 3 desc nulls last limit 6) x), '[]'::jsonb),
    'etudes_30d', (select count(*) from public.etudes where created_at > now() - interval '30 days'),
    'docs_30d', (select count(*) from public.documents where created_at > now() - interval '30 days'),
    'rdv_30d', (select count(*) from public.rdv where created_at > now() - interval '30 days'),
    'whatsapp_30d', (select count(*) from public.whatsapp_messages where created_at > now() - interval '30 days'),
    'jobs_failed_7d', (select count(*) from public.background_jobs where status = 'failed' and created_at > now() - interval '7 days'),
    'activity_series', (select jsonb_agg(jsonb_build_object('d', d,
        'etudes', (select count(*) from public.etudes e where e.created_at::date = d),
        'docs', (select count(*) from public.documents x where x.created_at::date = d),
        'rdv', (select count(*) from public.rdv x where x.created_at::date = d)) order by d) from days where d > current_date - 30),
    'top_accounts', coalesce((select jsonb_agg(x) from (
        select u.user_id, u.email, trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) as name,
          (select count(*) from public.rdv r where r.user_id = u.user_id and r.created_at > now() - interval '30 days') rdv,
          (select count(*) from public.etudes e where e.user_id = u.user_id and e.created_at > now() - interval '30 days') etudes,
          (select round(coalesce(sum(estimated_cost_usd),0)::numeric,2) from public.ai_usage a where a.user_id = u.user_id and a.created_at > now() - interval '30 days') ai
        from saas.users u order by 4 desc, 5 desc limit 8) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;