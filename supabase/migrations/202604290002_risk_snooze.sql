-- E2: SNOOZE & ALERT FATIGUE PREVENTION

-- 1. DROP STATUS CONSTRAINT
ALTER TABLE public.risk_alerts
DROP CONSTRAINT IF EXISTS risk_alerts_status_check;

-- 2. ADD SNOOZE COLUMN
ALTER TABLE public.risk_alerts
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- 3. RE-APPLY CONSTRAINT WITH 'SNOOZED' STATUS
ALTER TABLE public.risk_alerts
ADD CONSTRAINT risk_alerts_status_check
CHECK (status IN ('active', 'acknowledged', 'snoozed', 'overridden', 'resolved'));

-- 4. NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                   UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_mode    TEXT NOT NULL DEFAULT 'immediate'
                       CHECK (notification_mode IN ('immediate', 'critical_only', 'digest')),
  quiet_hours_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start    TIME,
  quiet_hours_end      TIME,
  quiet_hours_timezone TEXT DEFAULT 'UTC',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (user_id)
);

-- 5. SECURITY POLICIES
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_crud_own ON public.notification_preferences;

CREATE POLICY notification_preferences_crud_own ON public.notification_preferences
FOR ALL USING (public.is_owner(user_id))
WITH CHECK (public.is_owner(user_id));

