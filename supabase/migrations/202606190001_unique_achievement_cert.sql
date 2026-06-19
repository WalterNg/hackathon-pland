-- Prevent duplicate certificates for the same achievement per user/portfolio
CREATE UNIQUE INDEX IF NOT EXISTS idx_psc_unique_achievement
ON portfolio_snapshot_certificates(user_id, portfolio_id, achievement_key)
WHERE achievement_key IS NOT NULL;
