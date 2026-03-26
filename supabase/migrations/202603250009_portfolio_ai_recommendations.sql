create table if not exists public.portfolio_ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  analyzed_at timestamptz not null,
  action text not null,
  confidence integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists portfolio_ai_recommendations_user_idx
  on public.portfolio_ai_recommendations(user_id);

create index if not exists portfolio_ai_recommendations_portfolio_idx
  on public.portfolio_ai_recommendations(portfolio_id);

create index if not exists portfolio_ai_recommendations_analyzed_idx
  on public.portfolio_ai_recommendations(analyzed_at desc);
