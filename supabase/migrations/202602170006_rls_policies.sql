alter table public.users enable row level security;
alter table public.portfolios enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.portfolio_assets enable row level security;
alter table public.journal_entries enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.risk_limits enable row level security;
alter table public.risk_events enable row level security;
alter table public.portfolio_snapshots enable row level security;

create or replace function public.is_owner(target_user_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() = target_user_id;
$$;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select using (public.is_owner(id));

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update using (public.is_owner(id)) with check (public.is_owner(id));

drop policy if exists portfolios_crud_own on public.portfolios;
create policy portfolios_crud_own on public.portfolios
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists portfolio_transactions_crud_own on public.portfolio_transactions;
create policy portfolio_transactions_crud_own on public.portfolio_transactions
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists portfolio_assets_crud_own on public.portfolio_assets;
create policy portfolio_assets_crud_own on public.portfolio_assets
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists journal_entries_crud_own on public.journal_entries;
create policy journal_entries_crud_own on public.journal_entries
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists risk_profiles_crud_own on public.risk_profiles;
create policy risk_profiles_crud_own on public.risk_profiles
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists risk_limits_crud_own on public.risk_limits;
create policy risk_limits_crud_own on public.risk_limits
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists risk_events_crud_own on public.risk_events;
create policy risk_events_crud_own on public.risk_events
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

drop policy if exists portfolio_snapshots_crud_own on public.portfolio_snapshots;
create policy portfolio_snapshots_crud_own on public.portfolio_snapshots
for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));
