create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  base_currency text not null default 'USD',
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table if not exists public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell', 'deposit', 'withdrawal', 'airdrop', 'fee')),
  quantity numeric(30, 12) not null,
  price_usd numeric(30, 12) not null default 0,
  fee_usd numeric(30, 12) not null default 0,
  source text not null default 'manual',
  note text,
  executed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.portfolio_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null,
  quantity numeric(30, 12) not null default 0,
  avg_buy_price_usd numeric(30, 12) not null default 0,
  last_price_usd numeric(30, 12) not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (portfolio_id, symbol)
);

create index if not exists portfolios_user_idx on public.portfolios(user_id);
create index if not exists portfolio_tx_user_idx on public.portfolio_transactions(user_id);
create index if not exists portfolio_tx_portfolio_idx on public.portfolio_transactions(portfolio_id);
create index if not exists portfolio_tx_executed_idx on public.portfolio_transactions(executed_at desc);
create index if not exists portfolio_assets_user_idx on public.portfolio_assets(user_id);

create or replace function public.ensure_single_default_portfolio()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update public.portfolios
    set is_default = false,
        updated_at = timezone('utc', now())
    where user_id = new.user_id
      and id <> new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists portfolios_set_updated_at on public.portfolios;
create trigger portfolios_set_updated_at
before update on public.portfolios
for each row execute procedure public.set_updated_at();

drop trigger if exists portfolio_assets_set_updated_at on public.portfolio_assets;
create trigger portfolio_assets_set_updated_at
before update on public.portfolio_assets
for each row execute procedure public.set_updated_at();

drop trigger if exists portfolios_single_default on public.portfolios;
create trigger portfolios_single_default
before insert or update on public.portfolios
for each row execute procedure public.ensure_single_default_portfolio();
