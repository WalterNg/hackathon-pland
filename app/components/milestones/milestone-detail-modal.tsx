import type {
  PortfolioSnapshotCertificateDetail,
  PortfolioSnapshotCertificateVerificationResult,
} from "@/app/lib/portfolio-certificate-types";

type MilestoneDetailModalProps = {
  open: boolean;
  certificate: PortfolioSnapshotCertificateDetail | null;
  portfolioName?: string;
  verificationResult: PortfolioSnapshotCertificateVerificationResult | null;
  isVerifying: boolean;
  onClose: () => void;
  onVerify: (certificateId: string) => void;
};

function formatDate(timestamp: string | null) {
  if (!timestamp) return "N/A";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

function shortHash(hash: string, len = 16) {
  return hash.length > len ? `${hash.slice(0, len / 2)}...${hash.slice(-(len / 2))}` : hash;
}

function formatUsd(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

type AssetRow = { symbol?: string; name?: string; quantity?: number; valueUsd?: number; priceUsd?: number };

export function MilestoneDetailModal({
  open,
  certificate,
  portfolioName,
  verificationResult,
  isVerifying,
  onClose,
  onVerify,
}: MilestoneDetailModalProps) {
  if (!open || !certificate) return null;

  const payload = certificate.snapshotPayload as {
    summary?: { totalValueUsd?: number; timestamp?: string };
    assets?: AssetRow[];
  };

  const totalValue = payload?.summary?.totalValueUsd;
  const assets: AssetRow[] = (payload?.assets ?? []).slice(0, 8);
  const isAnchored = certificate.anchorStatus === "anchored";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-[#111114] ring-1 ring-white/10 shadow-2xl overflow-hidden">

        {/* Header band */}
        <div className={`px-6 pt-6 pb-5 ${isAnchored ? "bg-gradient-to-br from-[#1e1b4b] to-[#111114]" : "bg-[#111114]"}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neutral-500">Milestone</p>
              <h3 className="mt-1 text-lg font-bold text-white">{portfolioName ?? "Portfolio Snapshot"}</h3>
              <p className="mt-0.5 text-sm text-neutral-400">{formatDate(certificate.snapshotAt)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Total value */}
          {totalValue !== undefined && (
            <div className="mt-4">
              <p className="text-xs text-neutral-500 uppercase tracking-widest">Total Portfolio Value</p>
              <p className="mt-1 text-3xl font-bold text-white">{formatUsd(totalValue)}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Assets table */}
          {assets.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">Assets at this moment</p>
              <div className="rounded-xl overflow-hidden border border-white/6">
                {assets.map((asset, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i % 2 === 0 ? "bg-white/3" : ""}`}>
                    <span className="font-semibold text-white">{asset.symbol ?? asset.name ?? "—"}</span>
                    <span className="text-neutral-400">{formatUsd(asset.valueUsd)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof section */}
          <div className="rounded-xl border border-white/6 bg-white/3 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Blockchain Proof</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Network</span>
              <span className="font-medium text-white capitalize">{certificate.anchorNetwork}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Status</span>
              <span className={`font-medium capitalize ${isAnchored ? "text-violet-400" : "text-neutral-500"}`}>
                {certificate.anchorStatus.replace("_", " ")}
              </span>
            </div>
            {certificate.anchorTxHash && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-400">Tx Hash</span>
                <span className="font-mono text-xs text-neutral-300">{shortHash(certificate.anchorTxHash, 20)}</span>
              </div>
            )}
            {certificate.anchorBlockNumber && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-400">Block</span>
                <span className="text-neutral-300">#{certificate.anchorBlockNumber.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Verification result */}
          {verificationResult && (
            <div className={`rounded-xl px-4 py-3 text-sm ${verificationResult.isValid ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
              <div className="flex items-center gap-2">
                {verificationResult.isValid ? (
                  <>
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="font-semibold text-emerald-400">Verified — snapshot has not been altered</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                    </svg>
                    <span className="font-semibold text-red-400">Warning — hash mismatch, data may be tampered</span>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-400">Verified at {formatDate(verificationResult.verifiedAt)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {certificate.anchorExplorerUrl && (
              <a
                href={certificate.anchorExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Etherscan
              </a>
            )}
            {isAnchored && (
              <button
                type="button"
                onClick={() => onVerify(certificate.id)}
                disabled={isVerifying}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors"
              >
                {isVerifying ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying on-chain...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.2-.592-4.258-1.625-6.022" />
                    </svg>
                    Verify on-chain
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
