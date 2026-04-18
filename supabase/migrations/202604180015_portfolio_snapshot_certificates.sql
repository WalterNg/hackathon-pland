create table if not exists public.portfolio_snapshot_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  portfolio_snapshot_id uuid references public.portfolio_snapshots(id) on delete set null,
  certificate_version text not null default 'v1',
  snapshot_at timestamptz not null,
  snapshot_payload jsonb not null,
  snapshot_hash text not null,
  hash_algorithm text not null default 'sha256',
  canonicalization_version text not null default 'portfolio-snapshot-v1',
  anchor_chain text not null default 'ethereum',
  anchor_network text not null default 'sepolia',
  anchor_tx_hash text,
  anchor_block_number bigint,
  anchor_block_hash text,
  anchor_wallet_address text,
  anchor_explorer_url text,
  anchor_status text not null check (anchor_status in ('pending_anchor', 'anchored', 'failed')),
  anchor_error text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'mismatch')),
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists portfolio_snapshot_certificates_user_idx
on public.portfolio_snapshot_certificates(user_id);

create index if not exists portfolio_snapshot_certificates_portfolio_idx
on public.portfolio_snapshot_certificates(portfolio_id, snapshot_at desc);

create index if not exists portfolio_snapshot_certificates_snapshot_idx
on public.portfolio_snapshot_certificates(portfolio_snapshot_id);

create unique index if not exists portfolio_snapshot_certificates_hash_idx
on public.portfolio_snapshot_certificates(user_id, portfolio_id, snapshot_hash);
