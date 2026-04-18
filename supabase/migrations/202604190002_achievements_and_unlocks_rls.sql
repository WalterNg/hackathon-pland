alter table public.achievements enable row level security;
alter table public.portfolio_achievement_unlocks enable row level security;

drop policy if exists achievements_read_all on public.achievements;
create policy achievements_read_all on public.achievements
for select using (true);

drop policy if exists portfolio_achievement_unlocks_crud_own on public.portfolio_achievement_unlocks;
create policy portfolio_achievement_unlocks_crud_own on public.portfolio_achievement_unlocks
for all using (public.is_owner(user_id))
with check (public.is_owner(user_id));
