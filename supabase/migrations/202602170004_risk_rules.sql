create table if not exists public.risk_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  name text not null,
  max_daily_loss_usd numeric(30, 12),
  max_position_size_pct numeric(10, 4),
  max_leverage numeric(10, 4),
  max_drawdown_pct numeric(10, 4),
  risk_per_trade_pct numeric(10, 4),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.risk_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  risk_profile_id uuid references public.risk_profiles(id) on delete cascade,
  limit_type text not null,
  limit_value numeric(30, 12) not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (risk_profile_id, limit_type)
);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  risk_profile_id uuid references public.risk_profiles(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists risk_profiles_user_idx on public.risk_profiles(user_id);
create index if not exists risk_limits_user_idx on public.risk_limits(user_id);
create index if not exists risk_events_user_idx on public.risk_events(user_id);
create index if not exists risk_events_occurred_idx on public.risk_events(occurred_at desc);

drop trigger if exists risk_profiles_set_updated_at on public.risk_profiles;
create trigger risk_profiles_set_updated_at
before update on public.risk_profiles
for each row execute procedure public.set_updated_at();
