-- Backfill lower-tier achievement certs + unlocks that were never created
-- due to the non-atomic cert/unlock insertion bug.

DO $$
DECLARE
  pair RECORD;
  ref  RECORD;
  new_cert_id uuid;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('diversified_10_assets', 'diversified_5_assets',  'Diversification I', 'Hold at least five distinct assets to establish baseline diversification.',  '{"metric":"distinct_assets","operator":"gte","threshold":5,"observedValue":5}'::jsonb),
      ('diversified_20_assets', 'diversified_10_assets', 'Diversification II', 'Hold at least ten distinct assets to improve risk spread across holdings.',  '{"metric":"distinct_assets","operator":"gte","threshold":10,"observedValue":10}'::jsonb),
      ('rich_50k',              'rich_10k',              'Rich I',             'Reach a total portfolio value of at least $10,000.',                         '{"metric":"total_value_usd","operator":"gte","threshold":10000,"observedValue":10000}'::jsonb),
      ('rich_100k',             'rich_50k',              'Rich II',            'Reach a total portfolio value of at least $50,000.',                         '{"metric":"total_value_usd","operator":"gte","threshold":50000,"observedValue":50000}'::jsonb),
      ('drawdown_guard_5',      'drawdown_guard_10',     'Drawdown Guard I',   'Keep maximum drawdown at or below 10%.',                                     '{"metric":"max_drawdown_percent","operator":"lte","threshold":10,"observedValue":5}'::jsonb),
      ('sharpe_2_0',            'sharpe_1_0',            'Alpha I',            'Maintain a 30-day Sharpe ratio of at least 1.0.',                           '{"metric":"sharpe_ratio_30d","operator":"gte","threshold":1.0,"observedValue":1.0}'::jsonb)
    ) AS t(higher_key, lower_key, lower_title, lower_description, lower_metadata)
  LOOP
    FOR ref IN
      SELECT DISTINCT ON (psc.user_id, psc.portfolio_id)
        psc.user_id,
        psc.portfolio_id,
        psc.snapshot_payload,
        psc.snapshot_hash,
        psc.snapshot_at,
        psc.portfolio_snapshot_id,
        psc.certificate_version,
        psc.hash_algorithm,
        psc.canonicalization_version
      FROM portfolio_snapshot_certificates psc
      WHERE psc.achievement_key = pair.higher_key
        AND EXISTS (
          SELECT 1 FROM portfolio_achievement_unlocks pau
          WHERE pau.user_id = psc.user_id
            AND pau.portfolio_id = psc.portfolio_id
            AND pau.achievement_key = pair.higher_key
        )
        AND NOT EXISTS (
          SELECT 1 FROM portfolio_achievement_unlocks pau2
          WHERE pau2.user_id = psc.user_id
            AND pau2.portfolio_id = psc.portfolio_id
            AND pau2.achievement_key = pair.lower_key
        )
      ORDER BY psc.user_id, psc.portfolio_id, psc.created_at DESC
    LOOP
      INSERT INTO portfolio_snapshot_certificates (
        user_id, portfolio_id, portfolio_snapshot_id,
        certificate_version, snapshot_at, snapshot_payload, snapshot_hash,
        hash_algorithm, canonicalization_version,
        anchor_chain, anchor_network, anchor_status,
        certify_mode, achievement_key, title, note, verification_status
      )
      VALUES (
        ref.user_id, ref.portfolio_id, ref.portfolio_snapshot_id,
        ref.certificate_version, ref.snapshot_at, ref.snapshot_payload, ref.snapshot_hash,
        ref.hash_algorithm, ref.canonicalization_version,
        'ethereum', 'sepolia', 'pending_anchor',
        'auto_achievement', pair.lower_key,
        pair.lower_title, pair.lower_description,
        'unverified'
      )
      RETURNING id INTO new_cert_id;

      INSERT INTO portfolio_achievement_unlocks (
        user_id, portfolio_id, achievement_key, certificate_id,
        unlocked_at, snapshot_at, snapshot_hash, metadata
      )
      VALUES (
        ref.user_id, ref.portfolio_id,
        pair.lower_key,
        new_cert_id,
        NOW(),
        ref.snapshot_at,
        ref.snapshot_hash,
        pair.lower_metadata
      )
      ON CONFLICT DO NOTHING;

      RAISE NOTICE 'Backfilled % for user % portfolio %', pair.lower_key, ref.user_id, ref.portfolio_id;
    END LOOP;
  END LOOP;
END $$;
