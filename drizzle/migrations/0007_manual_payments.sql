create table public.manual_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'EUR',
  method text not null check (method in ('virement','cheque','especes','carte','autre')),
  reference text,
  period_label text,
  paid_at date not null default current_date,
  note text,
  recorded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.manual_payments to authenticated;
grant all on public.manual_payments to service_role;
alter table public.manual_payments enable row level security;
create policy "Admins manage manual payments" on public.manual_payments
  for all to authenticated
  using (public.is_saas_admin(auth.uid()))
  with check (public.is_saas_admin(auth.uid()));
create index manual_payments_user_idx on public.manual_payments(user_id, paid_at desc);