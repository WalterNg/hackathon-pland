"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MaterialIcon } from "../components/dashboard/material-icon";
import { AppTopNavigation } from "../components/ui/app-top-navigation";
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
import type { PortfolioMode } from "@/app/lib/portfolio-types";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";

function formatSyncTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function PortfolioContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const shouldOpenCreatePortfolio = searchParams.get("createPortfolio") === "1";
  const { createPortfolio, removePortfolio, portfolios } = usePortfolios();
  const [isSelectCoinOpen, setSelectCoinOpen] = useState(false);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isCreatePortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [isRemovingPortfolio, setRemovingPortfolio] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [selectedCoin, setSelectedCoin] = useState<{ symbol: string; baseAsset: string; quoteAsset: string } | null>(null);
  const { recommendation, isAnalyzing, activeStepId, error: aiError, analyze, steps } = usePortfolioAIAnalysis(portfolioName);

  const isMainPortfolio = useMemo(() => portfolioName === DEFAULT_PORTFOLIO_NAME, [portfolioName]);
  const currentPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.name === portfolioName) ?? null,
    [portfolios, portfolioName]
  );
  const portfolioId = currentPortfolio?.id ?? null;
  const { snapshot, isLoading, error, reload } = usePortfolioSnapshot(portfolioId, portfolioName);
  const {
    profile: riskProfile,
    events: riskEvents,
    isLoading: isRiskLoading,
    error: riskError,
    reload: reloadRisk,
  } = useRiskEvents(portfolioId, portfolioName);
  const isConnectedPortfolio = currentPortfolio?.mode === "binance_connected";
  const primaryActionLabel = isMainPortfolio ? "Create portfolio" : isConnectedPortfolio ? "Read-only" : "Add transaction";
  const connectedStatusDescription =
    isConnectedPortfolio && snapshot?.summary.timestamp
      ? `This portfolio syncs automatically from Binance and manual edits are disabled. Last synced at ${formatSyncTimestamp(snapshot.summary.timestamp)}.`
      : isConnectedPortfolio
        ? "This portfolio syncs automatically from Binance and manual edits are disabled."
        : undefined;
  const defaultPortfolioName = useMemo(() => `Portfolio ${portfolios.length + 1}`, [portfolios.length]);

  useEffect(() => {
    if (shouldOpenCreatePortfolio) {
      setCreatePortfolioOpen(true);
    }
  }, [shouldOpenCreatePortfolio]);

  const closeCreatePortfolioDialog = () => {
    setCreatePortfolioOpen(false);

    if (!shouldOpenCreatePortfolio) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("createPortfolio");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  const handleCreatePortfolio = async (name: string, mode: PortfolioMode, idempotencyKey?: string) => {
    const result = await createPortfolio(name, mode, { idempotencyKey });
    if (!result.ok) {
      throw new Error(result.message ?? "Unable to create portfolio.");
    }

    const newName = result.portfolioName ?? name;
    closeCreatePortfolioDialog();
    window.location.assign(`/portfolio?name=${encodeURIComponent(newName)}`);
  };

  const openTransactionFlow = () => {
    if (isMainPortfolio) {
      setCreatePortfolioOpen(true);
      return;
    }

    if (isConnectedPortfolio) {
      window.alert("Connected portfolios are read-only. Manual transactions are disabled.");
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

  const handleRemovePortfolio = async () => {
    if (isMainPortfolio || isRemovingPortfolio) {
      return;
    }

    const confirmed = window.confirm(`Remove portfolio \"${portfolioName}\"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setRemovingPortfolio(true);

    try {
      const result = await removePortfolio(portfolioName);
      if (!result.ok) {
        window.alert(result.message ?? "Unable to remove portfolio.");
        return;
      }

      window.location.assign(`/portfolio?name=${encodeURIComponent(DEFAULT_PORTFOLIO_NAME)}`);
    } finally {
      setRemovingPortfolio(false);
    }
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
    <>
      <header className="page-header shrink-0 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          <AppTopNavigation portfolioHref={`/portfolio?name=${encodeURIComponent(portfolioName)}`} />
        </div>
      </header>

      <div className="app-shell flex overflow-hidden">
        <Sidebar />

        <main className="app-main overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-8 lg:px-8">
          <div className="content-shell pb-6">
            <PortfolioHeader
              portfolioName={portfolioName}
              statusLabel={isConnectedPortfolio ? "Connected to Binance" : undefined}
              statusDescription={connectedStatusDescription}
              primaryActionLabel={primaryActionLabel}
              onPrimaryAction={openTransactionFlow}
              isPrimaryActionDisabled={isConnectedPortfolio}
              onRemovePortfolio={handleRemovePortfolio}
              showRemovePortfolio={!isMainPortfolio}
              isRemovingPortfolio={isRemovingPortfolio}
              showCharts={showCharts}
              onToggleShowCharts={() => setShowCharts((prev) => !prev)}
            />

            {isLoading && (
              <div className="panel-low mb-6 p-5 text-sm text-muted">Loading portfolio snapshot…</div>
            )}

            {error && (
              <div className="panel-low mb-6 p-5 text-sm text-danger">
                Unable to load live data: {error}
              </div>
            )}

            {snapshot && (
              <>
                <PortfolioSummary summary={snapshot.summary} metrics={snapshot.metrics} />
                <AIRecommendationCard
                  recommendation={recommendation}
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
        </main>
      </div>

      <button
        type="button"
        onClick={openTransactionFlow}
        disabled={isConnectedPortfolio}
        className="ui-button-primary fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full p-0 md:hidden disabled:cursor-not-allowed disabled:opacity-60"
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
        onClose={closeCreatePortfolioDialog}
        onSubmit={handleCreatePortfolio}
      />
    </>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <>
          <header className="page-header shrink-0 px-4 sm:px-6 lg:px-8">
            <div className="content-shell">
              <div className="panel-low p-5 text-sm text-muted">Loading portfolio header...</div>
            </div>
          </header>
          <div className="app-shell flex overflow-hidden">
            <Sidebar />
            <main className="app-main overflow-hidden p-4 pt-7 sm:p-6 lg:p-8">
              <div className="content-shell">
                <div className="panel-low p-5 text-sm text-muted">
                  Loading portfolio...
                </div>
              </div>
            </main>
          </div>
        </>
      }
    >
      <PortfolioContent />
    </Suspense>
  );
}

