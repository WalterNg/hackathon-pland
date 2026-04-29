"use client";

import type { PortfolioAIRecommendationHistoryItem } from "@/app/lib/portfolio-types";

import { confidenceTone, groupByDate } from "./ai-recommendation-history-utils";

type Props = {
  items: PortfolioAIRecommendationHistoryItem[];
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onSelectItem: (item: PortfolioAIRecommendationHistoryItem) => void;
};

function RecommendationRow({
  item,
  onSelectItem,
}: {
  item: PortfolioAIRecommendationHistoryItem;
  onSelectItem: (item: PortfolioAIRecommendationHistoryItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectItem(item)}
      className={[
        "w-full rounded-2xl border border-white/5 bg-(--surface-container-low) px-4 py-4 text-left transition-colors hover:border-white/10 hover:bg-white/[0.035] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
        "min-h-36",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-base font-semibold tracking-tight ${confidenceTone(item.recommendation.action)}`}>
            {item.recommendation.action}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">{item.recommendation.summary}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">Confidence</p>
          <p className={`mt-1 text-lg font-bold ${confidenceTone(item.recommendation.action)}`}>{item.recommendation.confidence}/10</p>
        </div>
      </div>
    </button>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="mt-5 flex items-center justify-center gap-3 border-t border-white/6 pt-4 text-sm text-muted">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!canGoPrev}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/6 px-3 py-2 font-medium text-muted transition-colors hover:border-white/10 hover:bg-white/3 hover:text-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span>Prev</span>
      </button>

      <span className="px-2">
        Page {page} of {Math.max(totalPages, 1)}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!canGoNext}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/6 px-3 py-2 font-medium text-muted transition-colors hover:border-white/10 hover:bg-white/3 hover:text-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span>Next</span>
      </button>
    </div>
  );
}

export function AiRecommendationHistoryList({
  items,
  page,
  totalPages,
  isLoading,
  error,
  onPageChange,
  onSelectItem,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="animate-pulse h-32 rounded-2xl border border-white/6 bg-white/3" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
        <p className="font-semibold text-strong">No AI recommendations yet</p>
        <p className="mt-2 text-sm text-muted">
          Run Analyze with AI from the Portfolio tab to create the first history entry.
        </p>
      </div>
    );
  }

  const groupedItems = groupByDate(items);

  return (
    <div className="space-y-4">
      <div className="space-y-5">
        {groupedItems.map((group) => (
          <section key={group.dateLabel} className="relative space-y-3 pl-6">
            <div className="absolute left-2 top-7 bottom-0 w-px bg-white/6" />

            <div className="inline-flex items-center gap-2 px-1 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted">
              <span className="h-2 w-2 rounded-full bg-rose-300/70" />
              {group.dateLabel}
            </div>

            <div className="space-y-2.5">
              {group.items.map((item) => (
                <RecommendationRow key={item.id} item={item} onSelectItem={onSelectItem} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
