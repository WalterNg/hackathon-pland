create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  snapshot_at timestamptz not null,
  nav_usd numeric(30, 12) not null default 0,
  total_exposure_usd numeric(30, 12) not null default 0,
  unrealized_pnl_usd numeric(30, 12) not null default 0,
  realized_pnl_usd numeric(30, 12) not null default 0,
  drawdown_pct numeric(10, 4),
  win_rate numeric(10, 4),
  total_trades integer not null default 0,
  open_positions integer not null default 0,
  risk_score numeric(10, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, portfolio_id, snapshot_at)
);

create index if not exists portfolio_snapshots_user_idx on public.portfolio_snapshots(user_id);
create index if not exists portfolio_snapshots_portfolio_idx on public.portfolio_snapshots(portfolio_id);
create index if not exists portfolio_snapshots_snapshot_idx on public.portfolio_snapshots(snapshot_at desc);
