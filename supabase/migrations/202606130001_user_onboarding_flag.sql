-- Add onboarding flag to users table
-- has_completed_onboarding: false = needs tour, true = already familiar with app
--
-- Definition of "already onboarded":
--   A user who has created at least one portfolio has clearly used the app before.
--   Everyone else (new signups + registered-but-never-used accounts) gets the tour.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark existing users as onboarded only if they already have a portfolio.
-- Users with no portfolio (new or dormant) will see the tour.
UPDATE public.users u
SET has_completed_onboarding = TRUE
WHERE EXISTS (
  SELECT 1 FROM public.portfolios p WHERE p.user_id = u.id
);
