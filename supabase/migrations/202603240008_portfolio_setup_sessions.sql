CREATE TABLE IF NOT EXISTS public.portfolio_setup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_name text NOT NULL,
  request_mode text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS portfolio_setup_sessions_user_idx ON public.portfolio_setup_sessions(user_id);
CREATE INDEX IF NOT EXISTS portfolio_setup_sessions_expires_idx ON public.portfolio_setup_sessions(expires_at);

ALTER TABLE public.portfolio_setup_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portfolio_setup_sessions_crud_own ON public.portfolio_setup_sessions;
CREATE POLICY portfolio_setup_sessions_crud_own ON public.portfolio_setup_sessions
FOR ALL USING (public.is_owner(user_id)) WITH CHECK (public.is_owner(user_id));

DROP TRIGGER IF EXISTS portfolio_setup_sessions_set_updated_at ON public.portfolio_setup_sessions;
CREATE TRIGGER portfolio_setup_sessions_set_updated_at
BEFORE UPDATE ON public.portfolio_setup_sessions
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
