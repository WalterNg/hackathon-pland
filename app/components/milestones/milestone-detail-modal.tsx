import type { PortfolioSnapshotCertificateDetail } from "@/app/lib/portfolio-certificate-types";

type MilestoneDetailModalProps = {
  open: boolean;
  certificate: PortfolioSnapshotCertificateDetail | null;
  portfolioName?: string;
  onClose: () => void;
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
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

type AssetRow = { symbol?: string; name?: string; valueUsd?: number };

export function MilestoneDetailModal({
  open,
  certificate,
  portfolioName,
  onClose,
}: MilestoneDetailModalProps) {
  if (!open || !certificate) return null;

  const payload = certificate.snapshotPayload as {
    summary?: { totalValueUsd?: number; timestamp?: string };
    assets?: AssetRow[];
  };

  const totalValue = payload?.summary?.totalValueUsd;
  const assets: AssetRow[] = (payload?.assets ?? []).slice(0, 8);
  const isMinted = certificate.nftMintStatus === "minted";
  const nftExplorerUrl = certificate.nftTxHash
    ? `https://sepolia.etherscan.io/tx/${certificate.nftTxHash}`
    : null;

  const mintStatusLabel = isMinted ? "minted" : certificate.nftMintStatus === "pending_mint" ? "pending" : "failed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-[#111114] ring-1 ring-white/10 shadow-2xl overflow-hidden">
        <div
          className={`px-6 pt-6 pb-5 ${
            isMinted
              ? "bg-gradient-to-br from-[#1e1b4b] to-[#111114]"
              : certificate.nftMintStatus === "pending_mint"
              ? "bg-gradient-to-br from-[#3b2502] to-[#111114]"
              : "bg-[#111114]"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neutral-500">Milestone</p>
              <h3 className="mt-1 text-lg font-bold text-white">{certificate.title || portfolioName || "Portfolio Snapshot"}</h3>
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

          {totalValue !== undefined && (
            <div className="mt-4">
              <p className="text-xs text-neutral-500 uppercase tracking-widest">Total Portfolio Value</p>
              <p className="mt-1 text-3xl font-bold text-white">{formatUsd(totalValue)}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {certificate.note && (
            <div className="rounded-xl border border-white/6 bg-white/3 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Detail</p>
              <p className="mt-1 text-sm text-neutral-200">{certificate.note}</p>
            </div>
          )}

          {assets.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">Assets at this moment</p>
              <div className="rounded-xl overflow-hidden border border-white/6">
                {assets.map((asset, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i % 2 === 0 ? "bg-white/3" : ""}`}>
                    <span className="font-semibold text-white">{asset.symbol ?? asset.name ?? "-"}</span>
                    <span className="text-neutral-400">{formatUsd(asset.valueUsd)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/6 bg-white/3 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Blockchain Proof</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Network</span>
              <span className="font-medium text-white capitalize">Ethereum Sepolia</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">NFT Status</span>
              <span className={`font-medium capitalize ${isMinted ? "text-violet-400" : certificate.nftMintStatus === "pending_mint" ? "text-amber-400" : "text-neutral-500"}`}>
                {mintStatusLabel}
              </span>
            </div>
            {certificate.nftTxHash && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-400">Mint Tx</span>
                <span className="font-mono text-xs text-neutral-300">{shortHash(certificate.nftTxHash, 20)}</span>
              </div>
            )}
            {certificate.nftTokenId != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-400">Token ID</span>
                <span className="text-neutral-300">#{certificate.nftTokenId}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {nftExplorerUrl && (
              <a
                href={nftExplorerUrl}
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
          </div>
        </div>
      </div>
    </div>
  );
}
