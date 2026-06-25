-- Add NFT mint columns to portfolio_snapshot_certificates
-- Old anchor_* columns are kept as-is and can be removed later

ALTER TABLE portfolio_snapshot_certificates
  ADD COLUMN IF NOT EXISTS nft_mint_status  TEXT
    CHECK (nft_mint_status IN ('pending_mint', 'minted', 'failed'))
    DEFAULT 'pending_mint',
  ADD COLUMN IF NOT EXISTS nft_token_id       INTEGER,
  ADD COLUMN IF NOT EXISTS nft_contract_address TEXT,
  ADD COLUMN IF NOT EXISTS nft_tx_hash        TEXT;

COMMENT ON COLUMN portfolio_snapshot_certificates.nft_mint_status    IS 'pending_mint | minted | failed';
COMMENT ON COLUMN portfolio_snapshot_certificates.nft_token_id       IS 'ERC-721 token ID returned by mint()';
COMMENT ON COLUMN portfolio_snapshot_certificates.nft_contract_address IS 'NFT contract address on Sepolia';
COMMENT ON COLUMN portfolio_snapshot_certificates.nft_tx_hash        IS 'Mint transaction hash on Sepolia';
