-- Drop deprecated anchor_* columns from portfolio_snapshot_certificates.
-- Anchor hash anchoring is superseded by the NFT minting flow.

ALTER TABLE portfolio_snapshot_certificates
  DROP COLUMN IF EXISTS anchor_chain,
  DROP COLUMN IF EXISTS anchor_network,
  DROP COLUMN IF EXISTS anchor_tx_hash,
  DROP COLUMN IF EXISTS anchor_block_number,
  DROP COLUMN IF EXISTS anchor_block_hash,
  DROP COLUMN IF EXISTS anchor_wallet_address,
  DROP COLUMN IF EXISTS anchor_explorer_url,
  DROP COLUMN IF EXISTS anchor_status,
  DROP COLUMN IF EXISTS anchor_error;
