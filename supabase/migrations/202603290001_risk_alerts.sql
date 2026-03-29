create table if not exists public.risk_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  risk_profile_id uuid references public.risk_profiles(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'active' check (status in ('active', 'acknowledged', 'resolved')),
  title text not null,
  message text not null,
  observed_value numeric(30, 12),
  threshold_value numeric(30, 12),
  symbol text,
  signature text not null,
  trigger_count integer not null default 1,
  first_triggered_at timestamptz not null default timezone('utc', now()),
  last_triggered_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists risk_alerts_user_idx on public.risk_alerts(user_id);
create index if not exists risk_alerts_portfolio_idx on public.risk_alerts(portfolio_id);
create index if not exists risk_alerts_status_idx on public.risk_alerts(status, last_triggered_at desc);
create unique index if not exists risk_alerts_active_signature_idx
on public.risk_alerts(user_id, portfolio_id, signature)
where status = 'active';

drop trigger if exists risk_alerts_set_updated_at on public.risk_alerts;
create trigger risk_alerts_set_updated_at
before update on public.risk_alerts
for each row execute procedure public.set_updated_at();

alter table public.risk_alerts enable row level security;

drop policy if exists risk_alerts_crud_own on public.risk_alerts;
create policy risk_alerts_crud_own on public.risk_alerts
for all using (public.is_owner(user_id))
with check (public.is_owner(user_id));