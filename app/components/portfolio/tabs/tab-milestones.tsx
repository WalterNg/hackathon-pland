"use client";

import { useMemo, useState } from "react";
import { MilestoneAchievementBadge } from "@/app/components/milestones/milestone-achievement-badge";
import { MilestoneDetailPanel } from "@/app/components/milestones/milestone-detail-panel";
import { usePortfolioSnapshotCertificates } from "@/app/hooks/use-portfolio-snapshot-certificates";

type TabMilestonesProps = {
  portfolioName: string;
  portfolioId: string | null;
};

export function TabMilestones({ portfolioName, portfolioId }: TabMilestonesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  const { certificates, selectedCertificate, isLoading, error, getCertificate } =
    usePortfolioSnapshotCertificates(portfolioId, portfolioName);

  const handleSelect = async (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setIsPanelLoading(true);
    await getCertificate(id);
    setIsPanelLoading(false);
  };

  const anchored = useMemo(() => certificates.filter((c) => c.anchorStatus === "anchored"), [certificates]);
  const pending = useMemo(() => certificates.filter((c) => c.anchorStatus === "pending_anchor"), [certificates]);
  const failed = useMemo(() => certificates.filter((c) => c.anchorStatus === "failed"), [certificates]);
  const achievements = useMemo(() => certificates.filter((c) => c.certifyMode === "auto_achievement"), [certificates]);
  const visible = showFailed ? certificates : certificates.filter((c) => c.anchorStatus !== "failed");
  const ordered = [...visible].sort((a, b) => new Date(b.snapshotAt).getTime() - new Date(a.snapshotAt).getTime());

  return (
    <>
      <section className="mb-6 rounded-3xl border border-white/6 bg-(--surface-container-low) p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-strong">Milestones</h2>
            <p className="mt-2 text-sm text-muted">
              Certified snapshots and achievement certifications in one timeline.
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

      {!isLoading && certificates.length > 0 && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/6 bg-(--surface-container-low) px-4 py-3 text-center">
            <p className="text-xl font-bold text-strong">{certificates.length}</p>
            <p className="mt-0.5 text-xs text-muted">Total snapshots</p>
          </div>
          <div className="rounded-2xl border border-violet-500/20 bg-[#1e1b4b]/60 px-4 py-3 text-center">
            <p className="text-xl font-bold text-violet-300">{anchored.length}</p>
            <p className="mt-0.5 text-xs text-muted">Anchored on-chain</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-[#3b2502]/40 px-4 py-3 text-center">
            <p className="text-xl font-bold text-amber-300">{pending.length}</p>
            <p className="mt-0.5 text-xs text-muted">Pending anchor</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-[#042f2e]/40 px-4 py-3 text-center">
            <p className="text-xl font-bold text-emerald-300">{achievements.length}</p>
            <p className="mt-0.5 text-xs text-muted">Achievements</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/6 bg-white/3" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!isLoading && !error && ordered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="font-semibold text-strong">No milestones yet</p>
          <p className="mt-1 text-sm text-muted">
            Create a checkpoint from the Portfolio Overview tab to record your first on-chain milestone.
          </p>
        </div>
      )}

      {!isLoading && !error && ordered.length > 0 && (
        <div className="flex gap-6 items-start">
          <div className="w-85 shrink-0">
            <div className="relative">
              <div className="absolute left-2.25 top-4 bottom-4 w-px bg-white/8" />
              <div className="space-y-2">
                {ordered.map((cert) => {
                  const dateLabel = new Intl.DateTimeFormat("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  }).format(new Date(cert.snapshotAt));

                  const dotColor = cert.anchorStatus === "anchored"
                    ? "bg-violet-400"
                    : cert.anchorStatus === "pending_anchor"
                    ? "bg-amber-400"
                    : "bg-neutral-700";

                  return (
                    <div key={cert.id} className="flex gap-4 items-start">
                      <div className="shrink-0 pt-[18px]">
                        <div className={`h-[10px] w-[10px] rounded-full border border-black/30 z-10 ${dotColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[0.65rem] font-medium text-neutral-600">{dateLabel}</p>
                        <MilestoneAchievementBadge
                          cert={cert}
                          isSelected={selectedId === cert.id}
                          onSelect={handleSelect}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 sticky top-5">
            <MilestoneDetailPanel
              certificate={selectedCertificate}
              isLoading={isPanelLoading}
              portfolioName={portfolioName}
            />
          </div>
        </div>
      )}
    </>
  );
}
