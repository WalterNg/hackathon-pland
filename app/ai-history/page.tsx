"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthGuard } from "../components/auth/auth-guard";
import { AppTopNavigation } from "../components/ui/app-top-navigation";
import { Sidebar } from "../components/ui/sidebar";
import { AiRecommendationHistoryList } from "../components/portfolio/ai-recommendation-history-list";
import { AiRecommendationHistoryTraceModal } from "../components/portfolio/ai-recommendation-history-trace-modal";
import { usePortfolioAIRecommendationHistory } from "../hooks/use-portfolio-ai-recommendation-history";
import { usePortfolioUiSession } from "../hooks/use-portfolio-ui-session";
import { usePortfolios } from "../hooks/use-portfolios";
import type { PortfolioAIRecommendationHistoryItem } from "../lib/portfolio-types";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";
const HISTORY_PAGE_SIZE = 5;

function parsePage(value: string | null): number {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.floor(parsed);
}

function AiHistoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<PortfolioAIRecommendationHistoryItem | null>(null);
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const page = parsePage(searchParams.get("page"));
  const { portfolios } = usePortfolios();

  const currentPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.name === portfolioName) ?? null,
    [portfolios, portfolioName]
  );
  const portfolioId = currentPortfolio?.id ?? null;
  const isMainPortfolio = portfolioName === DEFAULT_PORTFOLIO_NAME;
  const historyPortfolioId = isMainPortfolio ? null : portfolioId;
  const aiHistoryHref = isMainPortfolio ? null : `/ai-history?name=${encodeURIComponent(portfolioName)}`;

  const {
    isReady: isPortfolioUiSessionReady,
  } = usePortfolioUiSession(historyPortfolioId);

  const {
    pageData,
    items,
    isLoading,
    error,
  } = usePortfolioAIRecommendationHistory({
    portfolioName,
    page,
    pageSize: HISTORY_PAGE_SIZE,
    portfolioResolved: historyPortfolioId !== null,
  });

  useEffect(() => {
    if (isMainPortfolio) {
      router.replace(portfolioHref);
      return;
    }

    if (!pageData || pageData.totalPages === 0 || page <= pageData.totalPages) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("page", String(pageData.totalPages));
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/ai-history?${nextQuery}` : "/ai-history");
  }, [page, pageData, router, searchParams]);

  const portfolioHref = `/portfolio?name=${encodeURIComponent(portfolioName)}`;
  const riskHref = `/risk?name=${encodeURIComponent(portfolioName)}`;
  const riskRulesHref = `/risk-rules?name=${encodeURIComponent(portfolioName)}`;
  const milestonesHref = `/milestones?name=${encodeURIComponent(portfolioName)}`;

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        nextParams.delete(key);
        return;
      }

      nextParams.set(key, value);
    });

    if (!nextParams.get("name")) {
      nextParams.set("name", portfolioName);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/ai-history?${nextQuery}` : "/ai-history");
  };

  const isInitialLoading = isLoading && pageData === null;

  if (isMainPortfolio) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted text-sm">Redirecting to Portfolio...</span>
      </div>
    );
  }

  return (
    <>
      <header className="page-header shrink-0 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          <AppTopNavigation
            portfolioHref={portfolioHref}
            aiHistoryHref={aiHistoryHref}
            riskHref={riskHref}
            riskRulesHref={riskRulesHref}
            milestonesHref={milestonesHref}
          />
        </div>
      </header>

      <div className="app-shell flex overflow-hidden">
        <Sidebar portfolios={portfolios} sectionPath="/ai-history" />

        <main className="app-main overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-8 lg:px-8">
          <div className="content-shell mx-auto max-w-6xl pb-6">
            <section className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="typo-h1 text-strong">AI Recommendation History</h1>
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
              onPageChange={(nextPage) => updateSearchParams({ page: String(nextPage) })}
              onSelectItem={setSelectedItem}
            />
          </div>
        </main>
      </div>

      <AiRecommendationHistoryTraceModal
        open={selectedItem !== null}
        item={selectedItem}
        portfolioName={portfolioName}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
}

export default function AiHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="text-muted text-sm">Loading...</span>
        </div>
      }
    >
      <AuthGuard>
        <AiHistoryPageContent />
      </AuthGuard>
    </Suspense>
  );
}
