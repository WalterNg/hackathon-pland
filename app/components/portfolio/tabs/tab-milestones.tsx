"use client";

import { useMemo, useState } from "react";
import { MilestoneAchievementBadge } from "@/app/components/milestones/milestone-achievement-badge";
import { MilestoneDetailPanel } from "@/app/components/milestones/milestone-detail-panel";
import { BadgeCollectionModal } from "@/app/components/milestones/badge-collection-modal";
import { usePortfolioSnapshotCertificates } from "@/app/hooks/use-portfolio-snapshot-certificates";
import { useAchievementCatalog } from "@/app/hooks/use-achievement-catalog";

type TabMilestonesProps = {
  portfolioName: string;
  portfolioId: string | null;
};

export function TabMilestones({ portfolioName, portfolioId }: TabMilestonesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [showBadgeCollection, setShowBadgeCollection] = useState(false);

  const { certificates, selectedCertificate, isLoading, error, getCertificate } =
    usePortfolioSnapshotCertificates(portfolioId, portfolioName);

  const { tierMap, nicknameMap } = useAchievementCatalog();

  const handleSelect = async (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setIsPanelLoading(true);
    await getCertificate(id);
    setIsPanelLoading(false);
  };

  // Achievement certs are always shown even if anchor failed — the badge was still earned.
  const failed = useMemo(() => certificates.filter((c) => c.nftMintStatus === "failed" && c.certifyMode !== "auto_achievement"), [certificates]);
  const visible = showFailed
    ? certificates
    : certificates.filter((c) => c.nftMintStatus !== "failed" || c.certifyMode === "auto_achievement");
  const ordered = [...visible].sort((a, b) => new Date(b.snapshotAt).getTime() - new Date(a.snapshotAt).getTime());

  return (
    <>
      {showBadgeCollection && (
        <BadgeCollectionModal
          portfolioId={portfolioId}
          portfolioName={portfolioName}
          onClose={() => setShowBadgeCollection(false)}
        />
      )}

      <section className="mb-6 rounded-3xl border border-white/6 bg-(--surface-container-low) p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-strong">Milestones</h2>
            <p className="mt-2 text-sm text-muted">
              Certified snapshots and achievement certifications in one timeline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBadgeCollection(true)}
              className="ui-button-secondary flex items-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
              Badge Collection
            </button>
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
        </div>
      </section>

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
          <div className="w-55 shrink-0">
            <div className="relative">
              <div className="absolute left-2.25 top-4 bottom-4 w-px bg-white/8" />
              <div className="space-y-2">
                {ordered.map((cert) => {
                  const dateLabel = new Intl.DateTimeFormat("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  }).format(new Date(cert.snapshotAt));

                  const dotColor = cert.nftMintStatus === "minted"
                    ? "bg-violet-400"
                    : cert.nftMintStatus === "pending_mint"
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
                          tier={cert.achievementKey ? (tierMap.get(cert.achievementKey) ?? null) : null}
                          nickname={cert.achievementKey ? (nicknameMap.get(cert.achievementKey) ?? null) : null}
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
              tier={selectedCertificate?.achievementKey ? (tierMap.get(selectedCertificate.achievementKey) ?? null) : null}
            />
          </div>
        </div>
      )}
    </>
  );
}
