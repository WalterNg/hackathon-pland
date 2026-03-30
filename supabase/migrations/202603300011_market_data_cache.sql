create table if not exists public.market_symbols (
  symbol text primary key,
  base_asset text not null,
  quote_asset text not null,
  status text not null default 'TRADING',
  is_spot_trading_allowed boolean not null default true,
  source text not null default 'seed',
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.market_prices (
  symbol text primary key references public.market_symbols(symbol) on delete cascade,
  price_usd numeric(30, 12) not null default 0,
  source text not null default 'seed',
  fetched_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '5 minutes'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists market_symbols_synced_idx on public.market_symbols(last_synced_at desc);
create index if not exists market_prices_expires_idx on public.market_prices(expires_at desc);

drop trigger if exists market_symbols_set_updated_at on public.market_symbols;
create trigger market_symbols_set_updated_at
before update on public.market_symbols
for each row execute procedure public.set_updated_at();

drop trigger if exists market_prices_set_updated_at on public.market_prices;
create trigger market_prices_set_updated_at
before update on public.market_prices
for each row execute procedure public.set_updated_at();

alter table public.market_symbols enable row level security;
alter table public.market_prices enable row level security;

drop policy if exists market_symbols_readonly_service on public.market_symbols;
drop policy if exists market_prices_readonly_service on public.market_prices;

insert into public.market_symbols (symbol, base_asset, quote_asset, status, is_spot_trading_allowed, source, last_synced_at)
values
  ('BTCUSDT', 'BTC', 'USDT', 'TRADING', true, 'seed', timezone('utc', now())),
  ('ETHUSDT', 'ETH', 'USDT', 'TRADING', true, 'seed', timezone('utc', now())),
  ('BNBUSDT', 'BNB', 'USDT', 'TRADING', true, 'seed', timezone('utc', now())),
  ('SOLUSDT', 'SOL', 'USDT', 'TRADING', true, 'seed', timezone('utc', now())),
  ('DOGEUSDT', 'DOGE', 'USDT', 'TRADING', true, 'seed', timezone('utc', now()))
on conflict (symbol) do nothing;
