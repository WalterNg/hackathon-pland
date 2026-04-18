import type { PortfolioAchievementUnlock } from "@/app/lib/achievement-types";

type Props = {
  unlocks: PortfolioAchievementUnlock[];
  isLoading: boolean;
  error: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function PortfolioAchievementsSection({ unlocks, isLoading, error }: Props) {
  return (
    <section className="mb-6 rounded-3xl border border-white/6 bg-(--surface-container-low) p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-strong">Portfolio Achievements</h2>
          <p className="mt-1 text-sm text-muted">Progress milestones unlocked by portfolio metrics and risk-adjusted performance.</p>
        </div>
        <span className="status-pill status-pill-neutral">{unlocks.length} unlocked</span>
      </div>

      {isLoading && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/6 bg-white/3" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {!isLoading && !error && unlocks.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
          <p className="text-sm text-muted">No portfolio-level achievements unlocked yet.</p>
        </div>
      )}

      {!isLoading && !error && unlocks.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {unlocks.map((unlock) => (
            <article
              key={unlock.id}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
            >
              <p className="text-sm font-bold text-white">{unlock.achievement.title}</p>
              <p className="mt-0.5 text-xs font-medium text-emerald-300">{unlock.achievement.nickname}</p>
              <p className="mt-2 text-xs text-neutral-300">{unlock.achievement.description}</p>
              <p className="mt-2 text-[0.68rem] text-neutral-500">Unlocked {formatDate(unlock.unlockedAt)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
