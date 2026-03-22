CREATE TABLE IF NOT EXISTS public.portfolio_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'binance',
  connection_mode text NOT NULL DEFAULT 'binance_connected',
  is_read_only boolean NOT NULL DEFAULT true,
  sync_status text NOT NULL DEFAULT 'inactive',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (portfolio_id)
);

CREATE INDEX IF NOT EXISTS portfolio_connections_user_idx ON public.portfolio_connections(user_id);
CREATE INDEX IF NOT EXISTS portfolio_connections_portfolio_idx ON public.portfolio_connections(portfolio_id);

ALTER TABLE public.portfolio_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portfolio_connections_crud_own ON public.portfolio_connections;
CREATE POLICY portfolio_connections_crud_own ON public.portfolio_connections
FOR ALL USING (public.is_owner(user_id)) WITH CHECK (public.is_owner(user_id));

DROP TRIGGER IF EXISTS portfolio_connections_set_updated_at ON public.portfolio_connections;
CREATE TRIGGER portfolio_connections_set_updated_at
BEFORE UPDATE ON public.portfolio_connections
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
