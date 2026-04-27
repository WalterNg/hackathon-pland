alter table public.portfolio_ai_recommendations
  add column if not exists portfolio_ui_session_id text;

create index if not exists portfolio_ai_recommendations_session_idx
  on public.portfolio_ai_recommendations(user_id, portfolio_id, portfolio_ui_session_id, analyzed_at desc);
