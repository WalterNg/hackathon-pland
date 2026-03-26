alter table public.portfolio_ai_recommendations enable row level security;

drop policy if exists portfolio_ai_recommendations_crud_own on public.portfolio_ai_recommendations;
create policy portfolio_ai_recommendations_crud_own on public.portfolio_ai_recommendations
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));
