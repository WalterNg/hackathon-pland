import type { PortfolioSnapshotCertificate } from "@/app/lib/portfolio-certificate-types";
import type { AchievementTier } from "@/app/lib/achievement-tier";
import { badgeImageUrl, TIER_STYLES } from "@/app/lib/achievement-tier";

type Props = {
  cert: PortfolioSnapshotCertificate;
  tier: AchievementTier | null;
  nickname: string | null;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

export function MilestoneAchievementBadge({ cert, tier, nickname, isSelected, onSelect }: Props) {
  const isFailed = cert.nftMintStatus === "failed";
  const isAchievement = cert.certifyMode === "auto_achievement" && !!cert.achievementKey;
  const tierStyle = tier ? TIER_STYLES[tier] : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(cert.id)}
      className={`group w-full rounded-2xl p-2 text-left transition-all duration-200 cursor-pointer hover:bg-white/4 ${isSelected ? "bg-white/5" : ""} ${isFailed ? "opacity-40" : ""}`}
    >
      {isAchievement && cert.achievementKey ? (
        /* Achievement — badge image prominent, title below */
        <div className="flex flex-col items-center gap-2.5 py-1">
          <div className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-shadow duration-200 ${isSelected && tierStyle ? tierStyle.glow : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeImageUrl(cert.achievementKey)}
              alt={cert.title}
              className="h-full w-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="flex flex-col items-center gap-1 min-w-0 w-full">
            <p className="truncate text-sm font-bold text-white leading-tight text-center w-full">{nickname || cert.title || "Certified Snapshot"}</p>
            {tier && tierStyle && (
              <span className={`rounded-full px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${tierStyle.pill}`}>
                {tier}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Manual cert — same vertical layout */
        <div className="flex flex-col items-center gap-2.5 py-1">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${
            cert.nftMintStatus === "minted" ? "from-violet-600 to-indigo-700"
            : cert.nftMintStatus === "pending_mint" ? "from-amber-500 to-orange-600"
            : "from-neutral-600 to-neutral-800"
          } ${isSelected ? "shadow-[0_0_20px_0_rgba(124,58,237,0.35)]" : ""} transition-shadow duration-200`}>
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={
                cert.nftMintStatus === "minted"
                  ? "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.2-.592-4.258-1.625-6.022"
                  : cert.nftMintStatus === "pending_mint"
                  ? "M12 8.25v4.5l3 3M12 3a9 9 0 100 18 9 9 0 000-18z"
                  : "M12 9v3.75m0 3.75h.008v.008H12v-.008zM12 3a9 9 0 100 18 9 9 0 000-18z"
              } />
            </svg>
          </div>
          <p className="truncate text-sm font-bold text-white leading-tight text-center w-full">{cert.title || "Certified Snapshot"}</p>
        </div>
      )}
    </button>
  );
}
