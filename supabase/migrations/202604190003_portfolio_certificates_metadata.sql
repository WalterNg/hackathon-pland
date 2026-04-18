alter table public.portfolio_snapshot_certificates
  add column if not exists certify_mode text not null default 'manual' check (certify_mode in ('manual', 'auto_achievement')),
  add column if not exists achievement_key text references public.achievements(key) on delete set null,
  add column if not exists title text not null default 'Certified Snapshot',
  add column if not exists note text;

create index if not exists portfolio_snapshot_certificates_achievement_key_idx
on public.portfolio_snapshot_certificates(achievement_key);
