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
    <div className={`group w-full rounded-2xl p-2 text-left transition-all duration-200 ${isSelected ? "bg-white/5" : ""} ${isFailed ? "opacity-40" : ""}`}>
      <button
        type="button"
        onClick={() => onSelect(cert.id)}
        className="w-full rounded-xl text-left transition-colors hover:bg-white/4"
      >
        {isAchievement && cert.achievementKey ? (
          <div className="flex flex-col items-center gap-2.5 py-1">
            <div className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-shadow duration-200 ${isSelected && tierStyle ? tierStyle.glow : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={badgeImageUrl(cert.achievementKey)}
                alt={cert.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex w-full min-w-0 flex-col items-center gap-1">
              <p className="w-full truncate text-center text-sm font-bold leading-tight text-white">
                {nickname || cert.title || "Certified Snapshot"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 py-1">
            <div
              className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 to-indigo-700 transition-shadow duration-200 ${
                isSelected ? "shadow-[0_0_20px_0_rgba(124,58,237,0.35)]" : ""
              }`}
            >
              <svg className="h-7 w-7 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.2-.592-4.258-1.625-6.022"
                />
              </svg>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={badgeImageUrl(null)}
                alt={cert.title}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <p className="w-full truncate text-center text-sm font-bold leading-tight text-white">{cert.title || "Certified Snapshot"}</p>
          </div>
        )}
      </button>
    </div>
  );
}
