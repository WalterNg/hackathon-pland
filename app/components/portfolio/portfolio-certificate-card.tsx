import type { PortfolioSnapshotCertificate } from "@/app/lib/portfolio-certificate-types";
import { MaterialIcon } from "../dashboard/material-icon";

type PortfolioCertificateCardProps = {
  certificate: PortfolioSnapshotCertificate;
  onOpen: (certificateId: string) => void;
};

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function shortHash(hash: string) {
  return hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash;
}

function statusTone(status: PortfolioSnapshotCertificate["anchorStatus"]) {
  if (status === "anchored") {
    return "text-success bg-success-faint";
  }
  if (status === "failed") {
    return "text-danger bg-danger-soft";
  }
  return "text-warning bg-warning-soft";
}

export function PortfolioCertificateCard({ certificate, onOpen }: PortfolioCertificateCardProps) {
  return (
    <article className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
            Certified Snapshot
          </p>
          <p className="mt-1 text-sm font-semibold text-strong">{formatDate(certificate.snapshotAt)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${statusTone(certificate.anchorStatus)}`}>
          {certificate.anchorStatus === "pending_anchor"
            ? "Pending"
            : certificate.anchorStatus === "anchored"
              ? "Anchored"
              : "Failed"}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted">
        <p>Hash: <span className="font-medium text-strong">{shortHash(certificate.snapshotHash)}</span></p>
        <p>Network: <span className="font-medium text-strong">{certificate.anchorNetwork}</span></p>
        <p>Verification: <span className="font-medium text-strong">{certificate.verificationStatus}</span></p>
      </div>

      <button
        type="button"
        onClick={() => onOpen(certificate.id)}
        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <MaterialIcon name="open_in_new" outlined={false} className="text-sm" />
        View certificate
      </button>
    </article>
  );
}
