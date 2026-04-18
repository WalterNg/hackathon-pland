import type { PortfolioSnapshotCertificate } from "@/app/lib/portfolio-certificate-types";
import { PortfolioCertificateCard } from "./portfolio-certificate-card";

type PortfolioCertificateListProps = {
  certificates: PortfolioSnapshotCertificate[];
  isLoading: boolean;
  error: string | null;
  onOpen: (certificateId: string) => void;
};

export function PortfolioCertificateList({
  certificates,
  isLoading,
  error,
  onOpen,
}: PortfolioCertificateListProps) {
  return (
    <section className="panel-base mb-6 p-5 lg:mb-8">
      <div className="mb-4">
        <h3 className="section-title">Blockchain-Certified Snapshots</h3>
        <p className="mt-1 text-sm text-muted">
          Snapshot hashes are anchored on Sepolia for tamper-evident auditability.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/8 bg-white/5" />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {!isLoading && !error && certificates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-strong">No certified snapshots yet</p>
          <p className="mt-1 text-sm text-muted">Create the first certificate from the current portfolio snapshot.</p>
        </div>
      ) : null}

      {!isLoading && !error && certificates.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {certificates.map((certificate) => (
            <PortfolioCertificateCard
              key={certificate.id}
              certificate={certificate}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
