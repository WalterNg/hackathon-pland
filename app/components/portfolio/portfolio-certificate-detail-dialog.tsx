import type {
  PortfolioSnapshotCertificateDetail,
  PortfolioSnapshotCertificateVerificationResult,
} from "@/app/lib/portfolio-certificate-types";
import { MaterialIcon } from "../dashboard/material-icon";

type PortfolioCertificateDetailDialogProps = {
  certificate: PortfolioSnapshotCertificateDetail | null;
  verificationResult: PortfolioSnapshotCertificateVerificationResult | null;
  isVerifying: boolean;
  open: boolean;
  onClose: () => void;
  onVerify: (certificateId: string) => void;
};

function formatDate(timestamp: string | null) {
  if (!timestamp) {
    return "N/A";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatHash(hash: string) {
  return hash.length > 36 ? `${hash.slice(0, 18)}...${hash.slice(-14)}` : hash;
}

export function PortfolioCertificateDetailDialog({
  certificate,
  verificationResult,
  isVerifying,
  open,
  onClose,
  onVerify,
}: PortfolioCertificateDetailDialogProps) {
  if (!open || !certificate) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-3xl bg-(--surface-container-high) p-6 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">Certificate Detail</p>
            <h3 className="mt-2 text-xl font-bold text-strong">Blockchain-Certified Snapshot</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/8 hover:text-strong"
          >
            <MaterialIcon name="close" outlined={false} className="text-base" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Snapshot</p>
            <p className="mt-2 text-strong">Captured at {formatDate(certificate.snapshotAt)}</p>
            <p className="mt-2 text-muted">Hash: {formatHash(certificate.snapshotHash)}</p>
            <p className="mt-2 text-muted">Canonicalizer: {certificate.canonicalizationVersion}</p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">NFT Badge</p>
            <p className="mt-2 text-strong">Ethereum Sepolia</p>
            <p className="mt-2 text-muted">Mint status: {certificate.nftMintStatus}</p>
            <p className="mt-2 text-muted">Mint Tx: {certificate.nftTxHash ? formatHash(certificate.nftTxHash) : "N/A"}</p>
            <p className="mt-2 text-muted">Token ID: {certificate.nftTokenId != null ? `#${certificate.nftTokenId}` : "N/A"}</p>
          </div>
        </div>

        {verificationResult ? (
          <div className="mt-4 rounded-2xl border border-white/8 bg-(--surface-container-low) p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Verification</p>
            <p className="mt-2 text-strong">
              {verificationResult.isValid ? "Verified successfully" : "Hash mismatch detected"}
            </p>
            <p className="mt-2 text-muted">Computed Hash: {formatHash(verificationResult.computedHash)}</p>
            <p className="mt-2 text-muted">Stored Hash: {formatHash(verificationResult.storedHash)}</p>
            <p className="mt-2 text-muted">Verified At: {formatDate(verificationResult.verifiedAt)}</p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {certificate.nftTxHash ? (
            <a
              href={`https://sepolia.etherscan.io/tx/${certificate.nftTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="ui-button-secondary px-4 py-2 text-sm"
            >
              Open Explorer
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => onVerify(certificate.id)}
            disabled={isVerifying}
            className="ui-button-primary px-4 py-2 text-sm disabled:opacity-60"
          >
            {isVerifying ? "Verifying..." : "Verify Integrity"}
          </button>
        </div>
      </div>
    </div>
  );
}
