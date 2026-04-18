alter table public.portfolio_snapshot_certificates enable row level security;

drop policy if exists portfolio_snapshot_certificates_crud_own on public.portfolio_snapshot_certificates;
create policy portfolio_snapshot_certificates_crud_own on public.portfolio_snapshot_certificates
for all using (public.is_owner(user_id))
with check (public.is_owner(user_id));
