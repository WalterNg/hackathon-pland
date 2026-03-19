"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MaterialIcon } from "../components/dashboard/material-icon";
import { AddTransactionDialog } from "../components/portfolio/add-transaction-dialog";
import { AIRecommendationCard } from "../components/portfolio/ai-recommendation-card";
import { CreatePortfolioDialog } from "../components/portfolio/create-portfolio-dialog";
import { PortfolioAssetsTable } from "../components/portfolio/portfolio-assets-table";
import { PortfolioCharts } from "@/app/components/portfolio/portfolio-charts";
import { PortfolioHeader } from "../components/portfolio/portfolio-header";
import { PortfolioMetrics } from "../components/portfolio/portfolio-metrics";
import { RiskMonitorPanel } from "../components/portfolio/risk-monitor-panel";
import { PortfolioSummary } from "../components/portfolio/portfolio-summary";
import { SelectCoinModal } from "../components/portfolio/select-coin-modal";
import { Sidebar } from "../components/ui/sidebar";
import { usePortfolioAIAnalysis } from "../hooks/use-portfolio-ai-analysis";
import { usePortfolios } from "../hooks/use-portfolios";
import { useRiskEvents } from "../hooks/use-risk-events";
import { usePortfolioSnapshot } from "../hooks/use-portfolio-snapshot";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";

function PortfolioContent() {
  const searchParams = useSearchParams();
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const { snapshot, isLoading, error, reload } = usePortfolioSnapshot(portfolioName);
  const {
    profile: riskProfile,
    events: riskEvents,
    isLoading: isRiskLoading,
    error: riskError,
    reload: reloadRisk,
  } = useRiskEvents(portfolioName);
  const { createPortfolio, portfolios } = usePortfolios();
  const [isSelectCoinOpen, setSelectCoinOpen] = useState(false);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isCreatePortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [selectedCoin, setSelectedCoin] = useState<{ symbol: string; baseAsset: string; quoteAsset: string } | null>(null);
  const { recommendation, isAnalyzing, activeStepId, error: aiError, analyze, steps } = usePortfolioAIAnalysis();

  const isMainPortfolio = useMemo(() => portfolioName === DEFAULT_PORTFOLIO_NAME, [portfolioName]);
  const primaryActionLabel = isMainPortfolio ? "Create Portfolio" : "Add Transaction";
  const defaultPortfolioName = useMemo(() => `Portfolio ${portfolios.length + 1}`, [portfolios.length]);

  const handleCreatePortfolio = async (name: string) => {
    const result = await createPortfolio(name);
    if (!result.ok) {
      throw new Error(result.message ?? "Unable to create portfolio.");
    }

    const newName = result.portfolioName ?? name;
    setCreatePortfolioOpen(false);
    window.location.assign(`/portfolio?name=${encodeURIComponent(newName)}`);
  };

  const openTransactionFlow = () => {
    if (isMainPortfolio) {
      setCreatePortfolioOpen(true);
      return;
    }

    setSelectCoinOpen(true);
  };

  const handleCoinSelected = (coin: { symbol: string; baseAsset: string; quoteAsset: string }) => {
    setSelectedCoin(coin);
    setSelectCoinOpen(false);
    setAddDialogOpen(true);
  };

  const handleTransactionCreated = async () => {
    await reload();
    await reloadRisk();
  };

  const handleAnalyzeWithAI = () => {
    analyze({
      snapshot,
      profile: riskProfile,
      events: riskEvents,
      portfolioName,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <PortfolioHeader
          portfolioName={portfolioName}
          primaryActionLabel={primaryActionLabel}
          onPrimaryAction={openTransactionFlow}
          onAnalyzeWithAI={handleAnalyzeWithAI}
          isAnalyzeDisabled={!snapshot || isLoading}
          isAnalyzing={isAnalyzing}
          showCharts={showCharts}
          onToggleShowCharts={() => setShowCharts((prev) => !prev)}
        />

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <div className="content-shell">
            {isLoading && (
              <div className="mb-6 rounded-2xl border border-gray-100 bg-card-light p-5 text-sm text-muted">Loading portfolio snapshot…</div>
            )}

            {error && (
              <div className="mb-6 rounded-2xl border border-gray-100 bg-card-light p-5 text-sm text-danger">
                Unable to load live data: {error}
              </div>
            )}

            {snapshot && (
              <>
                <PortfolioSummary summary={snapshot.summary} metrics={snapshot.metrics} />
                <AIRecommendationCard
                  recommendation={recommendation}
                  snapshot={snapshot}
                  isAnalyzing={isAnalyzing}
                  activeStepId={activeStepId}
                  steps={steps}
                  error={aiError}
                  onAnalyze={handleAnalyzeWithAI}
                  isDisabled={!snapshot || isLoading}
                />
                <RiskMonitorPanel
                  metrics={snapshot.metrics}
                  profile={riskProfile}
                  events={riskEvents}
                  isLoading={isRiskLoading}
                  error={riskError}
                />
                <PortfolioMetrics metrics={snapshot.metrics} btcPriceUsd={snapshot.summary.btcPriceUsd} />
                {showCharts && (
                  <PortfolioCharts
                    chart={snapshot.chart}
                    assets={snapshot.assets}
                    allTimeProfitPercent={snapshot.metrics.allTimeProfitPercent}
                  />
                )}
                <PortfolioAssetsTable assets={snapshot.assets} btcPriceUsd={snapshot.summary.btcPriceUsd} />
              </>
            )}
          </div>
        </div>
      </main>

      <button
        type="button"
        onClick={openTransactionFlow}
        className="text-on-primary fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg md:hidden"
      >
        <MaterialIcon name="add" outlined={false} />
      </button>

      <SelectCoinModal
        open={isSelectCoinOpen}
        onClose={() => setSelectCoinOpen(false)}
        onSelect={handleCoinSelected}
      />

      <AddTransactionDialog
        open={isAddDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        portfolioName={portfolioName}
        coin={selectedCoin}
        onChangeCoin={() => {
          setAddDialogOpen(false);
          setSelectCoinOpen(true);
        }}
        onCreated={handleTransactionCreated}
      />

      <CreatePortfolioDialog
        open={isCreatePortfolioOpen}
        defaultName={defaultPortfolioName}
        onClose={() => setCreatePortfolioOpen(false)}
        onSubmit={handleCreatePortfolio}
      />
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen overflow-hidden bg-white">
          <Sidebar />
          <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-white p-4 sm:p-6 lg:p-8">
            <div className="content-shell">
              <div className="rounded-2xl border border-gray-100 bg-card-light p-5 text-sm text-muted">
                Loading portfolio...
              </div>
            </div>
          </main>
        </div>
      }
    >
      <PortfolioContent />
    </Suspense>
  );
}
