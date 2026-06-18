from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


AnchorStatus = Literal["pending_anchor", "anchored", "failed"]
NftMintStatus = Literal["pending_mint", "minted", "failed"]
VerificationStatus = Literal["unverified", "verified", "mismatch"]
CertifyMode = Literal["manual", "auto_achievement"]


class PortfolioSnapshotCertificateCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    portfolio_id: str | None = Field(default=None, alias="portfolioId")
    portfolio_name: str | None = Field(default=None, alias="portfolioName")
    snapshot_payload: dict[str, Any] | None = Field(default=None, alias="snapshotPayload")
    certify_mode: CertifyMode = Field(default="manual", alias="certifyMode")
    title: str | None = None
    note: str | None = None
    achievement_key: str | None = Field(default=None, alias="achievementKey")

    @model_validator(mode="after")
    def validate_portfolio_reference(self) -> "PortfolioSnapshotCertificateCreateRequest":
        if not self.portfolio_id and not self.portfolio_name:
            raise ValueError("Either portfolioId or portfolioName is required.")
        if self.certify_mode == "manual":
            if not (self.title or "").strip():
                raise ValueError("title is required when certifyMode is manual.")
            if not (self.note or "").strip():
                raise ValueError("note is required when certifyMode is manual.")
        return self


class CanonicalPortfolioSnapshotPayload(BaseModel):
    summary: dict[str, Any]
    metrics: dict[str, Any]
    chart: list[dict[str, Any]]
    assets: list[dict[str, Any]]
    risk_violations: list[dict[str, Any]] = Field(default_factory=list, alias="riskViolations")


class PortfolioSnapshotAnchorResult(BaseModel):
    tx_hash: str = Field(alias="txHash")
    block_number: int = Field(alias="blockNumber")
    block_hash: str = Field(alias="blockHash")
    wallet_address: str = Field(alias="walletAddress")
    explorer_url: str = Field(alias="explorerUrl")


class PortfolioSnapshotCertificateListItem(BaseModel):
    id: str
    portfolio_id: str = Field(alias="portfolioId")
    portfolio_snapshot_id: str | None = Field(default=None, alias="portfolioSnapshotId")
    certificate_version: str = Field(alias="certificateVersion")
    snapshot_at: datetime = Field(alias="snapshotAt")
    snapshot_hash: str = Field(alias="snapshotHash")
    hash_algorithm: str = Field(alias="hashAlgorithm")
    anchor_chain: str = Field(alias="anchorChain")
    anchor_network: str = Field(alias="anchorNetwork")
    anchor_tx_hash: str | None = Field(default=None, alias="anchorTxHash")
    anchor_block_number: int | None = Field(default=None, alias="anchorBlockNumber")
    anchor_explorer_url: str | None = Field(default=None, alias="anchorExplorerUrl")
    anchor_status: AnchorStatus = Field(alias="anchorStatus")
    anchor_error: str | None = Field(default=None, alias="anchorError")
    certify_mode: CertifyMode = Field(alias="certifyMode")
    achievement_key: str | None = Field(default=None, alias="achievementKey")
    title: str
    note: str | None = None
    verification_status: VerificationStatus = Field(alias="verificationStatus")
    verified_at: datetime | None = Field(default=None, alias="verifiedAt")
    created_at: datetime = Field(alias="createdAt")


class PortfolioSnapshotCertificateDetail(PortfolioSnapshotCertificateListItem):
    snapshot_payload: dict[str, Any] = Field(alias="snapshotPayload")
    canonicalization_version: str = Field(alias="canonicalizationVersion")
    anchor_block_hash: str | None = Field(default=None, alias="anchorBlockHash")
    anchor_wallet_address: str | None = Field(default=None, alias="anchorWalletAddress")


class PortfolioSnapshotCertificateVerifyResponse(BaseModel):
    certificate_id: str = Field(alias="certificateId")
    is_valid: bool = Field(alias="isValid")
    verification_status: VerificationStatus = Field(alias="verificationStatus")
    computed_hash: str = Field(alias="computedHash")
    anchored_hash: str = Field(alias="anchoredHash")
    anchor_tx_hash: str | None = Field(default=None, alias="anchorTxHash")
    anchor_explorer_url: str | None = Field(default=None, alias="anchorExplorerUrl")
    verified_at: datetime = Field(alias="verifiedAt")


class PortfolioSnapshotCertificateRecord(BaseModel):
    id: str
    user_id: str
    portfolio_id: str
    portfolio_snapshot_id: str | None = None
    certificate_version: str
    snapshot_at: datetime
    snapshot_payload: dict[str, Any]
    snapshot_hash: str
    hash_algorithm: str
    canonicalization_version: str
    anchor_chain: str
    anchor_network: str
    anchor_tx_hash: str | None = None
    anchor_block_number: int | None = None
    anchor_block_hash: str | None = None
    anchor_wallet_address: str | None = None
    anchor_explorer_url: str | None = None
    anchor_status: AnchorStatus
    anchor_error: str | None = None
    certify_mode: CertifyMode = "manual"
    achievement_key: str | None = None
    title: str = "Certified Snapshot"
    note: str | None = None
    verification_status: VerificationStatus
    verified_at: datetime | None = None
    created_at: datetime
    # NFT mint fields (added in migration 202606170001)
    nft_mint_status: NftMintStatus = "pending_mint"
    nft_token_id: int | None = None
    nft_contract_address: str | None = None
    nft_tx_hash: str | None = None
