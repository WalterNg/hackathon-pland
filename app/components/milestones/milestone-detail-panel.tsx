import type { ReactNode } from "react";
import type { PortfolioSnapshotCertificateDetail } from "@/app/lib/portfolio-certificate-types";
import type { AchievementTier } from "@/app/lib/achievement-tier";
import { TIER_STYLES } from "@/app/lib/achievement-tier";

type Props = {
  certificate: PortfolioSnapshotCertificateDetail | null;
  isLoading: boolean;
  portfolioName?: string;
  tier?: AchievementTier | null;
};

function formatDate(ts: string | null) {
  if (!ts) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(ts)
  );
}

function shortHash(hash: string, len = 20) {
  return hash.length > len ? `${hash.slice(0, len / 2)}...${hash.slice(-(len / 2))}` : hash;
}

function formatUsd(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

type AssetRow = { symbol?: string; name?: string; valueUsd?: number };

function EmptyPanel() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/8 px-8 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/4">
        <svg className="h-7 w-7 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-neutral-400">Select an event</p>
        <p className="mt-1 text-sm text-neutral-600">Click any timeline item to view details.</p>
      </div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="rounded-3xl border border-white/6 bg-(--surface-container-low) overflow-hidden animate-pulse">
      <div className="h-40 bg-white/4" />
      <div className="p-6 space-y-3">
        <div className="h-3 w-2/3 rounded bg-white/6" />
        <div className="h-3 w-1/2 rounded bg-white/6" />
        <div className="h-3 w-3/4 rounded bg-white/6" />
      </div>
    </div>
  );
}

function CertificatePanel({
  certificate,
  portfolioName,
  tier,
}: {
  certificate: PortfolioSnapshotCertificateDetail;
  portfolioName?: string;
  tier?: AchievementTier | null;
}) {
  const payload = certificate.snapshotPayload as {
    summary?: { totalValueUsd?: number };
    assets?: AssetRow[];
  };

  const totalValue = payload?.summary?.totalValueUsd;
  const assets: AssetRow[] = (payload?.assets ?? []).slice(0, 8);
  const isMinted = certificate.nftMintStatus === "minted";
  const tierStyle = tier ? TIER_STYLES[tier] : null;

  const headerBg = tierStyle
    ? `bg-gradient-to-b ${tierStyle.gradientFrom} to-transparent`
    : isMinted
    ? "bg-gradient-to-b from-[#1e1b4b] to-transparent"
    : certificate.nftMintStatus === "pending_mint"
    ? "bg-gradient-to-b from-[#3b2502] to-transparent"
    : "bg-gradient-to-b from-[#111114] to-transparent";



  const mintStatusLabel = isMinted ? "Minted" : certificate.nftMintStatus === "pending_mint" ? "Pending" : "Failed";

  const nftExplorerUrl = certificate.nftTxHash
    ? `https://sepolia.etherscan.io/tx/${certificate.nftTxHash}`
    : null;

  return (
    <div className="rounded-3xl border border-white/8 bg-(--surface-container-low) overflow-hidden">
      <div className={`${headerBg} px-6 pt-6 pb-5`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-neutral-500">Certified Snapshot</p>
            <h3 className="mt-1 text-base font-bold text-white">{certificate.title || portfolioName || "Portfolio Snapshot"}</h3>
            <p className="mt-0.5 text-sm text-neutral-400">{formatDate(certificate.snapshotAt)}</p>
          </div>
        </div>

        {totalValue !== undefined && (
          <div className="mt-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-neutral-500">Portfolio Value</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-white">{formatUsd(totalValue)}</p>
          </div>
        )}
      </div>

      <div className="px-6 pb-6 space-y-4">
        {certificate.note && (
          <div className="rounded-xl border border-white/6 bg-white/2 px-4 py-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">Detail</p>
            <p className="mt-1 text-sm text-neutral-200">{certificate.note}</p>
          </div>
        )}

        {assets.length > 0 && (
          <div>
            <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">Assets at snapshot</p>
            <div className="rounded-xl overflow-hidden border border-white/6">
              {assets.map((asset, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 text-sm ${i % 2 === 0 ? "bg-white/2" : ""}`}>
                  <span className="font-semibold text-white">{asset.symbol ?? asset.name ?? "-"}</span>
                  <span className="text-neutral-400">{formatUsd(asset.valueUsd)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/6 bg-white/2 px-4 py-3 space-y-2.5">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">Blockchain Proof</p>
          <Row label="Network" value={<span className="capitalize">Ethereum Sepolia</span>} />
          <Row label="NFT Status" value={mintStatusLabel} />
          <Row label="Snapshot hash" value={<span className="font-mono text-[0.65rem]">{shortHash(certificate.snapshotHash, 24)}</span>} />
          {certificate.nftTxHash && <Row label="Mint tx" value={<span className="font-mono text-[0.65rem]">{shortHash(certificate.nftTxHash, 24)}</span>} />}
          {certificate.nftTokenId != null && <Row label="Token ID" value={`#${certificate.nftTokenId}`} />}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
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
          <a
            href={`/verify?hash=${encodeURIComponent(certificate.snapshotHash)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Public verify
          </a>
        </div>
      </div>
    </div>
  );
}

export function MilestoneDetailPanel({
  certificate,
  isLoading,
  portfolioName,
  tier,
}: Props) {
  if (isLoading) return <LoadingPanel />;
  if (certificate) return <CertificatePanel certificate={certificate} portfolioName={portfolioName} tier={tier} />;
  return <EmptyPanel />;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-200 text-right">{value}</span>
    </div>
  );
}
