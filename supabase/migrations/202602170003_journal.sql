create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  pair text not null,
  side text not null check (side in ('long', 'short', 'spot')),
  size numeric(30, 12) not null default 0,
  leverage numeric(10, 4) not null default 1,
  entry_price numeric(30, 12),
  exit_price numeric(30, 12),
  stop_loss numeric(30, 12),
  take_profit numeric(30, 12),
  pnl_usd numeric(30, 12),
  pnl_percent numeric(10, 4),
  strategy text,
  confidence smallint check (confidence between 1 and 10),
  emotion text,
  notes text,
  tags text[] not null default '{}',
  executed_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists journal_entries_user_idx on public.journal_entries(user_id);
create index if not exists journal_entries_portfolio_idx on public.journal_entries(portfolio_id);
create index if not exists journal_entries_executed_idx on public.journal_entries(executed_at desc);
create index if not exists journal_entries_pair_idx on public.journal_entries(pair);
create index if not exists journal_entries_strategy_idx on public.journal_entries(strategy);

drop trigger if exists journal_entries_set_updated_at on public.journal_entries;
create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute procedure public.set_updated_at();
