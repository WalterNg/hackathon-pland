import type { PortfolioAchievementUnlock } from "@/app/lib/achievement-types";

type Props = {
  unlock: PortfolioAchievementUnlock;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

function formatDate(ts: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

export function AchievementTimelineBadge({ unlock, isSelected, onSelect }: Props) {
  const selectedRing = isSelected
    ? "ring-2 ring-emerald-500/60 bg-emerald-500/5"
    : "ring-1 ring-white/6 hover:ring-white/12 bg-white/2 hover:bg-white/4";

  return (
    <button
      type="button"
      onClick={() => onSelect(unlock.id)}
      className={`group w-full rounded-2xl p-3.5 text-left transition-all duration-200 cursor-pointer ${selectedRing}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 ${isSelected ? "shadow-[0_0_20px_0_rgba(16,185,129,0.35)]" : ""} transition-shadow duration-200`}>
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.2-.592-4.258-1.625-6.022" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white leading-tight">{unlock.achievement.title}</p>
          <p className="mt-0.5 truncate text-[0.68rem] text-neutral-500 leading-tight">{formatDate(unlock.unlockedAt)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-[0.65rem] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Achievement
        </div>
      </div>
    </button>
  );
}
