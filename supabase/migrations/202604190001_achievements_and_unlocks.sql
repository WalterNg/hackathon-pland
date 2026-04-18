create table if not exists public.achievements (
  key text primary key,
  title text not null,
  nickname text not null,
  description text not null,
  category text not null check (category in ('portfolio_level')),
  metric text not null,
  operator text not null check (operator in ('gte', 'lte')),
  threshold numeric not null,
  tier integer not null check (tier >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.portfolio_achievement_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  achievement_key text not null references public.achievements(key) on delete restrict,
  certificate_id uuid references public.portfolio_snapshot_certificates(id) on delete set null,
  unlocked_at timestamptz not null default timezone('utc', now()),
  snapshot_at timestamptz not null,
  snapshot_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists portfolio_achievement_unlocks_unique_idx
on public.portfolio_achievement_unlocks(user_id, portfolio_id, achievement_key);

create index if not exists portfolio_achievement_unlocks_user_portfolio_idx
on public.portfolio_achievement_unlocks(user_id, portfolio_id, unlocked_at desc);

insert into public.achievements (key, title, nickname, description, category, metric, operator, threshold, tier, is_active)
values
  ('diversified_5_assets', 'Diversification I', 'Seed Sower', 'Hold at least five distinct assets to establish baseline diversification.', 'portfolio_level', 'distinct_assets', 'gte', 5, 1, true),
  ('diversified_10_assets', 'Diversification II', 'Portfolio Gardener', 'Hold at least ten distinct assets to improve risk spread across holdings.', 'portfolio_level', 'distinct_assets', 'gte', 10, 2, true),
  ('diversified_20_assets', 'Diversification III', 'Allocation Master', 'Hold at least twenty distinct assets to reach advanced diversification breadth.', 'portfolio_level', 'distinct_assets', 'gte', 20, 3, true),
  ('rich_10k', 'Rich I', '10K Club', 'Reach a total portfolio value of at least $10,000.', 'portfolio_level', 'total_value_usd', 'gte', 10000, 1, true),
  ('rich_50k', 'Rich II', '50K Whale', 'Reach a total portfolio value of at least $50,000.', 'portfolio_level', 'total_value_usd', 'gte', 50000, 2, true),
  ('rich_100k', 'Rich III', '100K Whale', 'Reach a total portfolio value of at least $100,000.', 'portfolio_level', 'total_value_usd', 'gte', 100000, 3, true),
  ('drawdown_guard_10', 'Drawdown Guard I', 'Capital Keeper', 'Keep maximum drawdown at or below 10%.', 'portfolio_level', 'max_drawdown_percent', 'lte', 10, 1, true),
  ('drawdown_guard_5', 'Drawdown Guard II', 'Capital Guardian', 'Keep maximum drawdown at or below 5%.', 'portfolio_level', 'max_drawdown_percent', 'lte', 5, 2, true),
  ('sharpe_1_0', 'Alpha I', 'Sharpe Hunter', 'Maintain a 30-day Sharpe ratio of at least 1.0.', 'portfolio_level', 'sharpe_ratio_30d', 'gte', 1.0, 1, true),
  ('sharpe_2_0', 'Alpha II', 'Risk-Adjusted Legend', 'Maintain a 30-day Sharpe ratio of at least 2.0.', 'portfolio_level', 'sharpe_ratio_30d', 'gte', 2.0, 2, true)
on conflict (key) do update set
  title = excluded.title,
  nickname = excluded.nickname,
  description = excluded.description,
  category = excluded.category,
  metric = excluded.metric,
  operator = excluded.operator,
  threshold = excluded.threshold,
  tier = excluded.tier,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());
