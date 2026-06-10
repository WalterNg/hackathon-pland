"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AiRecommendationHistoryList } from "@/app/components/portfolio/ai-recommendation-history-list";
import { AiRecommendationHistoryTraceModal } from "@/app/components/portfolio/ai-recommendation-history-trace-modal";
import { usePortfolioAIRecommendationHistory } from "@/app/hooks/use-portfolio-ai-recommendation-history";
import { usePortfolioUiSession } from "@/app/hooks/use-portfolio-ui-session";
import type { PortfolioAIRecommendationHistoryItem } from "@/app/lib/portfolio-types";

const HISTORY_PAGE_SIZE = 5;

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

type TabAiHistoryProps = {
  portfolioName: string;
  portfolioId: string | null;
};

export function TabAiHistory({ portfolioName, portfolioId }: TabAiHistoryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  const [selectedItem, setSelectedItem] = useState<PortfolioAIRecommendationHistoryItem | null>(null);

  const { isReady: isPortfolioUiSessionReady } = usePortfolioUiSession(portfolioId);

  const { pageData, items, isLoading, error } = usePortfolioAIRecommendationHistory({
    portfolioName,
    page,
    pageSize: HISTORY_PAGE_SIZE,
    portfolioResolved: portfolioId !== null,
  });

  useEffect(() => {
    if (!pageData || pageData.totalPages === 0 || page <= pageData.totalPages) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("page", String(pageData.totalPages));
    router.replace(`/portfolio?${nextParams.toString()}`);
  }, [page, pageData, router, searchParams]);

  const updatePage = (nextPage: number) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("page", String(nextPage));
    router.replace(`/portfolio?${nextParams.toString()}`);
  };

  const isInitialLoading = isLoading && pageData === null;

  return (
    <>
      <section className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-strong">AI Recommendation History</h2>
          {!isPortfolioUiSessionReady ? (
            <span className="status-pill status-pill-neutral">Preparing session</span>
          ) : null}
        </div>
      </section>

      <AiRecommendationHistoryList
        items={items}
        page={pageData?.page ?? page}
        totalPages={pageData?.totalPages ?? 0}
        isLoading={isInitialLoading}
        error={error}
        onPageChange={updatePage}
        onSelectItem={setSelectedItem}
      />

      <AiRecommendationHistoryTraceModal
        open={selectedItem !== null}
        item={selectedItem}
        portfolioName={portfolioName}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
}
