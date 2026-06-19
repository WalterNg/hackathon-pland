"use client";

import type { PortfolioSnapshotCertificate } from "@/app/lib/portfolio-certificate-types";

const IMAGE_FOLDER_CID = "bafybeih64xr5ymvnjb6c2pbvohldvit22d2snufeojizeexbch4gutxsii";

function badgeImageUrl(achievementKey: string) {
  return `https://gateway.pinata.cloud/ipfs/${IMAGE_FOLDER_CID}/${achievementKey}.png`;
}

function openSeaUrl(contractAddress: string, tokenId: number) {
  return `https://testnets.opensea.io/assets/sepolia/${contractAddress}/${tokenId}`;
}

function formatDate(ts: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

type Props = {
  certificates: PortfolioSnapshotCertificate[];
};

export function NftBadgesSection({ certificates }: Props) {
  const badges = certificates.filter((c) => c.certifyMode === "auto_achievement" && c.achievementKey);

  if (badges.length === 0) return null;

  return (
    <section className="mb-6 rounded-3xl border border-white/6 bg-(--surface-container-low) p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-strong">NFT Badges</h2>
          <p className="mt-1 text-sm text-muted">Soulbound achievement badges minted on Ethereum Sepolia.</p>
        </div>
        <span className="status-pill status-pill-neutral">{badges.length} earned</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((cert) => (
          <NftBadgeCard key={cert.id} cert={cert} />
        ))}
      </div>
    </section>
  );
}

function NftBadgeCard({ cert }: { cert: PortfolioSnapshotCertificate }) {
  const isMinted = cert.nftMintStatus === "minted";
  const isPending = cert.nftMintStatus === "pending_mint";
  const isFailed = cert.nftMintStatus === "failed";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-4">
      <div className="flex items-start gap-3">
        {/* Badge image */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {cert.achievementKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={badgeImageUrl(cert.achievementKey)}
              alt={cert.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white leading-tight">{cert.title}</p>
          <p className="mt-0.5 text-[0.68rem] text-neutral-500">{formatDate(cert.snapshotAt)}</p>

          {/* Mint status */}
          <div className="mt-2">
            {isMinted && cert.nftTokenId != null && cert.nftContractAddress && (
              <a
                href={openSeaUrl(cert.nftContractAddress, cert.nftTokenId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                #{cert.nftTokenId} · View on OpenSea
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[0.68rem] font-semibold text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Minting…
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1 text-[0.68rem] font-semibold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Mint failed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
