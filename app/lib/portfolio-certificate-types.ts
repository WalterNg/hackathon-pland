export type PortfolioSnapshotCertificateVerificationStatus = "unverified" | "verified" | "mismatch";
export type PortfolioSnapshotCertificateCertifyMode = "manual" | "auto_achievement";
export type NftMintStatus = "pending_mint" | "minted" | "failed";

export type PortfolioSnapshotCertificate = {
  id: string;
  portfolioId: string;
  portfolioSnapshotId: string | null;
  certificateVersion: string;
  snapshotAt: string;
  snapshotHash: string;
  hashAlgorithm: string;
  certifyMode: PortfolioSnapshotCertificateCertifyMode;
  achievementKey: string | null;
  title: string;
  note: string | null;
  verificationStatus: PortfolioSnapshotCertificateVerificationStatus;
  verifiedAt: string | null;
  createdAt: string;
  nftMintStatus: NftMintStatus;
  nftTokenId: number | null;
  nftContractAddress: string | null;
  nftTxHash: string | null;
};

export type PortfolioSnapshotCertificateDetail = PortfolioSnapshotCertificate & {
  snapshotPayload: Record<string, unknown>;
  canonicalizationVersion: string;
};

export type CertificatePublicVerifyResult = {
  certificateId: string;
  title: string;
  achievementKey: string | null;
  snapshotAt: string;
  snapshotHash: string;
  nftMintStatus: NftMintStatus;
  nftTokenId: number | null;
  nftTxHash: string | null;
  nftContractAddress: string | null;
  externalUrl: string;
  snapshotPayload: Record<string, unknown> | null;
};

export type PortfolioSnapshotCertificateVerificationResult = {
  certificateId: string;
  isValid: boolean;
  verificationStatus: PortfolioSnapshotCertificateVerificationStatus;
  computedHash: string;
  storedHash: string;
  verifiedAt: string;
};
