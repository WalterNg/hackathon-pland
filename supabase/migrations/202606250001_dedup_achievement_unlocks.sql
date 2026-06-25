-- Deduplicate portfolio_achievement_unlocks and enforce unique constraint
-- Root cause: race condition allowed concurrent inserts before unique index was in place.
-- Strategy: for each (user_id, portfolio_id, achievement_key) group, keep the oldest unlock
--           (lowest unlocked_at), delete the rest along with their orphan certificates.

-- Step 1: Delete orphan certificates linked only to duplicate unlocks
DELETE FROM public.portfolio_snapshot_certificates
WHERE id IN (
  SELECT u.certificate_id
  FROM public.portfolio_achievement_unlocks u
  WHERE u.certificate_id IS NOT NULL
    AND u.id IN (
      -- Identify duplicate rows: all but the oldest per group
      SELECT id FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, portfolio_id, achievement_key
            ORDER BY unlocked_at ASC, id ASC
          ) AS rn
        FROM public.portfolio_achievement_unlocks
      ) ranked
      WHERE rn > 1
    )
    -- Only delete the cert if no other unlock still references it
    AND NOT EXISTS (
      SELECT 1 FROM public.portfolio_achievement_unlocks other
      WHERE other.certificate_id = u.certificate_id
        AND other.id NOT IN (
          SELECT id FROM (
            SELECT
              id,
              ROW_NUMBER() OVER (
                PARTITION BY user_id, portfolio_id, achievement_key
                ORDER BY unlocked_at ASC, id ASC
              ) AS rn
            FROM public.portfolio_achievement_unlocks
          ) ranked2
          WHERE rn > 1
        )
    )
);

-- Step 2: Delete the duplicate unlock rows (keep oldest per group)
DELETE FROM public.portfolio_achievement_unlocks
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, portfolio_id, achievement_key
        ORDER BY unlocked_at ASC, id ASC
      ) AS rn
    FROM public.portfolio_achievement_unlocks
  ) ranked
  WHERE rn > 1
);

-- Step 3: Re-create the unique index (may have failed on original migration if duplicates existed)
DROP INDEX IF EXISTS public.portfolio_achievement_unlocks_unique_idx;

CREATE UNIQUE INDEX portfolio_achievement_unlocks_unique_idx
ON public.portfolio_achievement_unlocks(user_id, portfolio_id, achievement_key);
