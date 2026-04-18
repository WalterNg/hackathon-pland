"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppTopNavigation } from "@/app/components/ui/app-top-navigation";
import { Sidebar } from "@/app/components/ui/sidebar";
import { AuthGuard } from "@/app/components/auth/auth-guard";
import { MilestoneBadge } from "@/app/components/milestones/milestone-badge";
import { MilestoneDetailModal } from "@/app/components/milestones/milestone-detail-modal";
import { usePortfolios } from "@/app/hooks/use-portfolios";
import { usePortfolioSnapshotCertificates } from "@/app/hooks/use-portfolio-snapshot-certificates";
import type { PortfolioSnapshotCertificateVerificationResult } from "@/app/lib/portfolio-certificate-types";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";

function MilestonesPageContent() {
  const searchParams = useSearchParams();
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;

  const { portfolios } = usePortfolios();
  const portfolioId = useMemo(
    () => portfolios.find((p) => p.name === portfolioName)?.id ?? null,
    [portfolios, portfolioName]
  );

  const [certificateVerificationResult, setCertificateVerificationResult] =
    useState<PortfolioSnapshotCertificateVerificationResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  const {
    certificates,
    selectedCertificate,
    isLoading,
    error,
    isVerifying,
    getCertificate,
    verifyCertificate,
  } = usePortfolioSnapshotCertificates(portfolioId, portfolioName);

  const handleOpen = async (certificateId: string) => {
    setCertificateVerificationResult(null);
    const detail = await getCertificate(certificateId);
    if (detail) setIsModalOpen(true);
  };

  const handleVerify = async (certificateId: string) => {
    const result = await verifyCertificate(certificateId);
    if (result) setCertificateVerificationResult(result);
  };

  const portfolioHref = `/portfolio?name=${encodeURIComponent(portfolioName)}`;
  const riskHref = `/risk?name=${encodeURIComponent(portfolioName)}`;
  const milestonesHref = `/milestones?name=${encodeURIComponent(portfolioName)}`;

  const anchored = certificates.filter((c) => c.anchorStatus === "anchored");
  const failed = certificates.filter((c) => c.anchorStatus === "failed");
  const visible = showFailed ? certificates : anchored;

  return (
    <>
      <header className="page-header shrink-0 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          <AppTopNavigation
            portfolioHref={portfolioHref}
            riskHref={riskHref}
            milestonesHref={milestonesHref}
          />
        </div>
      </header>

      <div className="app-shell flex overflow-hidden">
        <Sidebar portfolios={portfolios} sectionPath="/milestones" />

        <main className="app-main overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-8 lg:px-8">
          <div className="content-shell max-w-7xl pb-6">

            {/* Page header */}
            <section className="mb-6 rounded-3xl border border-white/6 bg-(--surface-container-low) p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="typo-h1 text-strong">Milestones</h1>
                    <span className="status-pill status-pill-neutral">{portfolioName}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Certified snapshots permanently anchored on Ethereum — a tamper-proof record of this portfolio's history.
                  </p>
                </div>
                {failed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFailed((v) => !v)}
                    className="ui-button-secondary"
                  >
                    {showFailed ? "Hide failed" : `Show failed (${failed.length})`}
                  </button>
                )}
              </div>
            </section>

            {/* Stats row */}
            {!isLoading && certificates.length > 0 && (
              <div className="mb-6 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-3 text-center">
                  <p className="text-xl font-bold text-strong">{certificates.length}</p>
                  <p className="mt-0.5 text-xs text-muted">Total snapshots</p>
                </div>
                <div className="rounded-2xl border border-violet-500/20 bg-[#1e1b4b]/60 px-4 py-3 text-center">
                  <p className="text-xl font-bold text-violet-300">{anchored.length}</p>
                  <p className="mt-0.5 text-xs text-muted">Anchored on-chain</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-[#042f2e]/60 px-4 py-3 text-center">
                  <p className="text-xl font-bold text-emerald-300">
                    {certificates.filter((c) => c.verificationStatus === "verified").length}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Verified</p>
                </div>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/6 bg-white/3" />
                ))}
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-danger">{error}</div>
            )}

            {/* Empty */}
            {!isLoading && !error && visible.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
                  <svg className="h-7 w-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                  </svg>
                </div>
                <p className="font-semibold text-strong">No milestones yet</p>
                <p className="mt-1 text-sm text-muted">
                  Go to the Portfolio page and certify a snapshot to create the first milestone.
                </p>
              </div>
            )}

            {/* Badge grid */}
            {!isLoading && !error && visible.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((cert) => (
                  <MilestoneBadge
                    key={cert.id}
                    milestone={{ ...cert, portfolioName }}
                    onOpen={handleOpen}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <MilestoneDetailModal
        open={isModalOpen}
        certificate={selectedCertificate}
        portfolioName={portfolioName}
        verificationResult={certificateVerificationResult}
        isVerifying={isVerifying}
        onClose={() => setIsModalOpen(false)}
        onVerify={handleVerify}
      />
    </>
  );
}

export default function MilestonesPage() {
  return (
    <AuthGuard>
      <Suspense>
        <MilestonesPageContent />
      </Suspense>
    </AuthGuard>
  );
}
