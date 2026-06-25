-- Remove unique constraint on portfolio_snapshot_certificates for achievement_key.
-- The portfolio_achievement_unlocks table already has a unique index on
-- (user_id, portfolio_id, achievement_key) which is the correct guard.
-- Keeping the constraint here caused orphan certs when the unlock insert failed,
-- permanently blocking future certify retries.
DROP INDEX IF EXISTS idx_psc_unique_achievement;
