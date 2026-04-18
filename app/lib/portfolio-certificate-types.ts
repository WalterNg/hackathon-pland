export type PortfolioSnapshotCertificateStatus = "pending_anchor" | "anchored" | "failed";
export type PortfolioSnapshotCertificateVerificationStatus = "unverified" | "verified" | "mismatch";
export type PortfolioSnapshotCertificateCertifyMode = "manual" | "auto_achievement";

export type PortfolioSnapshotCertificate = {
  id: string;
  portfolioId: string;
  portfolioSnapshotId: string | null;
  certificateVersion: string;
  snapshotAt: string;
  snapshotHash: string;
  hashAlgorithm: string;
  anchorChain: string;
  anchorNetwork: string;
  anchorTxHash: string | null;
  anchorBlockNumber: number | null;
  anchorExplorerUrl: string | null;
  anchorStatus: PortfolioSnapshotCertificateStatus;
  anchorError: string | null;
  certifyMode: PortfolioSnapshotCertificateCertifyMode;
  achievementKey: string | null;
  title: string;
  note: string | null;
  verificationStatus: PortfolioSnapshotCertificateVerificationStatus;
  verifiedAt: string | null;
  createdAt: string;
};

export type PortfolioSnapshotCertificateDetail = PortfolioSnapshotCertificate & {
  snapshotPayload: Record<string, unknown>;
  canonicalizationVersion: string;
  anchorBlockHash: string | null;
  anchorWalletAddress: string | null;
};

export type PortfolioSnapshotCertificateVerificationResult = {
  certificateId: string;
  isValid: boolean;
  verificationStatus: PortfolioSnapshotCertificateVerificationStatus;
  computedHash: string;
  anchoredHash: string;
  anchorTxHash: string | null;
  anchorExplorerUrl: string | null;
  verifiedAt: string;
};
