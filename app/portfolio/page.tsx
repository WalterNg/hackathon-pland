"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MaterialIcon } from "../components/dashboard/material-icon";
import { AppTopNavigation } from "../components/ui/app-top-navigation";
import { AddTransactionDialog } from "../components/portfolio/add-transaction-dialog";
import { CreatePortfolioDialog } from "../components/portfolio/create-portfolio-dialog";
import { SyncBinanceDialog } from "../components/portfolio/sync-binance-dialog";
import { PortfolioAssetsTable } from "../components/portfolio/portfolio-assets-table";
import { PortfolioTransactionsList } from "../components/portfolio/portfolio-transactions-list";
import { PortfolioCharts } from "@/app/components/portfolio/portfolio-charts";
import { PortfolioHeader } from "../components/portfolio/portfolio-header";
import { PortfolioMetrics } from "../components/portfolio/portfolio-metrics";
import { PortfolioSummary } from "../components/portfolio/portfolio-summary";
import { SelectCoinModal } from "../components/portfolio/select-coin-modal";
import { Sidebar } from "../components/ui/sidebar";
import { AuthGuard } from "../components/auth/auth-guard";
import { useTradingAgentAnalysis } from "../hooks/use-trading-agent-analysis";
import { usePortfolios } from "../hooks/use-portfolios";
import { usePortfolioSnapshot } from "../hooks/use-portfolio-snapshot";
import { RefreshIntervals } from "@/app/lib/refresh-intervals";
import type { PortfolioMode, PortfolioSnapshot } from "@/app/lib/portfolio-types";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";
const SUMMARY_RENDER_INTERVAL_MS = RefreshIntervals.PORTFOLIO_SUMMARY_RENDER_MS;
const ASSETS_RENDER_INTERVAL_MS = RefreshIntervals.PORTFOLIO_ASSETS_RENDER_MS;
const CHART_RENDER_INTERVAL_MS = RefreshIntervals.PORTFOLIO_CHART_RENDER_MS;

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

function useThrottledValue<T>(value: T, intervalMs: number, resetKey?: string | number | null): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastFlushAtRef = useRef(0);

  useEffect(() => {
    lastFlushAtRef.current = 0;
    setThrottledValue(value);
  }, [resetKey]);

  useEffect(() => {
    const now = Date.now();
    const shouldFlushImmediately =
      lastFlushAtRef.current === 0 ||
      now - lastFlushAtRef.current >= intervalMs;

    if (shouldFlushImmediately) {
      lastFlushAtRef.current = now;
      setThrottledValue(value);
      return () => undefined;
    }

    const timeoutId = window.setTimeout(() => {
      lastFlushAtRef.current = Date.now();
      setThrottledValue(value);
    }, intervalMs - (now - lastFlushAtRef.current));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [value, intervalMs, resetKey]);

  return throttledValue;
}

function PortfolioContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const shouldOpenCreatePortfolio = searchParams.get("createPortfolio") === "1";
  const { createPortfolio, removePortfolio, syncPortfolio, portfolios } = usePortfolios();
  const [isSelectCoinOpen, setSelectCoinOpen] = useState(false);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isCreatePortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [isSyncDialogOpen, setSyncDialogOpen] = useState(false);
  const [isRemovingPortfolio, setRemovingPortfolio] = useState(false);
  const [isSyncingPortfolio, setSyncingPortfolio] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [holdingsTab, setHoldingsTab] = useState<"assets" | "transactions">("assets");
  const [snapshotCacheByPortfolio, setSnapshotCacheByPortfolio] = useState<Record<string, PortfolioSnapshot>>({});
  const [selectedCoin, setSelectedCoin] = useState<{ symbol: string; name: string | null; baseAsset: string; quoteAsset: string } | null>(null);
  const [transactionIntent, setTransactionIntent] = useState<{ action: "buy" | "sell" | "transfer"; note: string }>({
    action: "buy",
    note: "",
  });
  const isMainPortfolio = useMemo(() => portfolioName === DEFAULT_PORTFOLIO_NAME, [portfolioName]);
  const tradingAgentScopeKey = isMainPortfolio ? null : portfolioName;
  const {
    recommendation: tradingAgentRecommendation,
    latestResult: tradingAgentResult,
    preparedContext: tradingAgentPreparedContext,
    trace: tradingAgentTrace,
    warnings: tradingAgentWarnings,
    isAnalyzing: isTradingAgentAnalyzing,
    error: tradingAgentError,
    activeNodes: tradingAgentActiveNodes,
    progressLabel: tradingAgentProgressLabel,
    analyze: analyzeTradingAgent,
  } = useTradingAgentAnalysis(tradingAgentScopeKey);

  const currentPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.name === portfolioName) ?? null,
    [portfolios, portfolioName]
  );
  const portfolioId = currentPortfolio?.id ?? null;
  const {
    snapshot,
    isLoading,
    isRefreshing,
    error,
    snapshotSource,
    lastServerSyncAt,
    lastRealtimeTickAt,
    isServerSnapshotStale,
    reload
  } = usePortfolioSnapshot(portfolioId, portfolioName);
  const scopedSnapshot = snapshot?.summary.name === portfolioName ? snapshot : null;

  useEffect(() => {
    if (!scopedSnapshot) {
      return;
    }

    setSnapshotCacheByPortfolio((current) => {
      const existing = current[portfolioName];
      if (
        existing &&
        existing.summary.timestamp === scopedSnapshot.summary.timestamp &&
        existing.summary.totalValueUsd === scopedSnapshot.summary.totalValueUsd
      ) {
        return current;
      }

      return {
        ...current,
        [portfolioName]: scopedSnapshot,
      };
    });
  }, [portfolioName, scopedSnapshot]);

  const effectiveSnapshot = scopedSnapshot ?? snapshotCacheByPortfolio[portfolioName] ?? null;

  const isConnectedPortfolio = currentPortfolio?.mode === "binance_connected";
  const primaryActionLabel = isMainPortfolio ? "Create portfolio" : isConnectedPortfolio ? "Read-only" : "Add transaction";
  const riskManagementHref = `/risk?name=${encodeURIComponent(portfolioName)}`;
  const connectedPortfolioTimestamp = lastServerSyncAt ?? effectiveSnapshot?.summary.timestamp ?? null;
  const connectedStatusDescription =
    isConnectedPortfolio && connectedPortfolioTimestamp
      ? `This portfolio syncs automatically from Binance and manual edits are disabled. Last synced at ${formatSyncTimestamp(connectedPortfolioTimestamp)}.`
      : isConnectedPortfolio
        ? "This portfolio syncs automatically from Binance and manual edits are disabled."
        : undefined;
  const defaultPortfolioName = useMemo(() => `Portfolio ${portfolios.length + 1}`, [portfolios.length]);
  const scopedSummary = effectiveSnapshot?.summary ?? null;
  const scopedMetrics = effectiveSnapshot?.metrics ?? null;
  const scopedAssets = effectiveSnapshot?.assets ?? [];
  const scopedChart = effectiveSnapshot?.chart ?? [];
  const throttledSummary = useThrottledValue(scopedSummary, SUMMARY_RENDER_INTERVAL_MS, portfolioName);
  const throttledMetrics = useThrottledValue(scopedMetrics, SUMMARY_RENDER_INTERVAL_MS, portfolioName);
  const throttledAssets = useThrottledValue(scopedAssets, ASSETS_RENDER_INTERVAL_MS, portfolioName);
  const throttledChart = useThrottledValue(scopedChart, CHART_RENDER_INTERVAL_MS, portfolioName);
  const livePortfolioValuesByName = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(snapshotCacheByPortfolio).map(([name, snapshotItem]) => [
          name,
          snapshotItem.summary.totalValueUsd,
        ])
      ),
    [snapshotCacheByPortfolio]
  );

  useEffect(() => {
    if (shouldOpenCreatePortfolio) {
      setCreatePortfolioOpen(true);
    }
  }, [shouldOpenCreatePortfolio]);

  const closeAddDialog = () => {
    setAddDialogOpen(false);
    setTransactionIntent({ action: "buy", note: "" });
  };

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

  const handleSyncPortfolio = async (assets: Array<{ asset: string; quantity: number; price_usd: number }>) => {
    setSyncingPortfolio(true);
    try {
      const result = await syncPortfolio(portfolioName, assets);
      if (!result.ok) {
        window.alert(result.message ?? "Unable to sync portfolio.");
        return;
      }
      await reload();
    } finally {
      setSyncingPortfolio(false);
    }
  };

  const handleCreatePortfolio = async (name: string, mode: PortfolioMode, idempotencyKey?: string, assets?: Array<{ asset: string; quantity: number; price_usd: number }>) => {
    const result = await createPortfolio(name, mode, { idempotencyKey, assets });
    if (!result.ok) {
      throw new Error(result.message ?? "Unable to create portfolio.");
    }

    const newName = result.portfolioName ?? name;
    closeCreatePortfolioDialog();
    window.location.assign(`/portfolio?name=${encodeURIComponent(newName)}`);
  };

  const openTransactionFlow = () => {
    setTransactionIntent({ action: "buy", note: "" });

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

  const handleCoinSelected = (coin: { symbol: string; name: string | null; baseAsset: string; quoteAsset: string }) => {
    setSelectedCoin(coin);
    setSelectCoinOpen(false);
    setAddDialogOpen(true);
  };

  const handleTransactionCreated = async () => {
    await reload();
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

  const handleAnalyzeTradingAgent = () => {
    if (isMainPortfolio) {
      return;
    }

    void analyzeTradingAgent({ portfolioName });
  };

  return (
    <>
      <header className="page-header shrink-0 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          <AppTopNavigation
            portfolioHref={`/portfolio?name=${encodeURIComponent(portfolioName)}`}
            riskHref={riskManagementHref}
          />
        </div>
      </header>

      <div className="app-shell flex overflow-hidden">
        <Sidebar
          portfolios={portfolios}
          livePortfolioValuesByName={livePortfolioValuesByName}
        />

        <main className="app-main overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-8 lg:px-8">
          <div className="content-shell max-w-7xl pb-6">
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
              isConnectedPortfolio={isConnectedPortfolio}
              onSync={() => setSyncDialogOpen(true)}
              isSyncing={isSyncingPortfolio}
            />

            {isLoading && !effectiveSnapshot && (
              <div className="panel-low mb-6 p-5 text-sm text-muted">Loading portfolio snapshot…</div>
            )}

            {error && (
              <div className="panel-low mb-6 p-5 text-sm text-danger">
                Unable to load live data: {error}
              </div>
            )}

            {effectiveSnapshot && (
              <>
                {throttledSummary && throttledMetrics ? (
                  <PortfolioSummary
                    portfolioName={portfolioName}
                    summary={throttledSummary}
                    metrics={throttledMetrics}
                    tradingAgentRecommendation={tradingAgentRecommendation}
                    tradingAgentResult={tradingAgentResult}
                    tradingAgentPreparedContext={tradingAgentPreparedContext}
                    tradingAgentTrace={tradingAgentTrace}
                    tradingAgentWarnings={tradingAgentWarnings}
                    tradingAgentIsAnalyzing={isTradingAgentAnalyzing}
                    tradingAgentProgressLabel={tradingAgentProgressLabel}
                    tradingAgentActiveNodes={tradingAgentActiveNodes}
                    tradingAgentError={tradingAgentError}
                    showTradingAgentControls={!isMainPortfolio}
                    onAnalyzeTradingAgent={handleAnalyzeTradingAgent}
                    isAnalyzeDisabled={isMainPortfolio || !effectiveSnapshot || isLoading}
                  />
                ) : null}
                <PortfolioMetrics metrics={throttledMetrics ?? scopedMetrics} />
                {showCharts && (
                  <PortfolioCharts
                    chart={throttledChart}
                    assets={throttledAssets}
                    isLoading={isLoading || isRefreshing || throttledChart.length === 0}
                  />
                )}
                {/* Assets / Transactions tab switcher */}
                <div className="mb-4 flex items-center gap-1 rounded-xl bg-(--surface-container-highest) p-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setHoldingsTab("assets")}
                    className={holdingsTab === "assets"
                      ? "rounded-lg bg-(--surface-bright) px-4 py-1.5 text-xs font-semibold text-strong"
                      : "px-4 py-1.5 text-xs font-medium text-muted hover:text-strong transition-colors"}
                  >
                    Assets
                  </button>
                  <button
                    type="button"
                    onClick={() => setHoldingsTab("transactions")}
                    className={holdingsTab === "transactions"
                      ? "rounded-lg bg-(--surface-bright) px-4 py-1.5 text-xs font-semibold text-strong"
                      : "px-4 py-1.5 text-xs font-medium text-muted hover:text-strong transition-colors"}
                  >
                    Transactions
                  </button>
                </div>

                {holdingsTab === "assets" ? (
                  <PortfolioAssetsTable assets={throttledAssets} />
                ) : (
                  <PortfolioTransactionsList
                    portfolioName={portfolioName}
                    isConnected={isConnectedPortfolio}
                    onTransactionChanged={handleTransactionCreated}
                  />
                )}
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
        onClose={closeAddDialog}
        portfolioName={portfolioName}
        coin={selectedCoin}
        portfolioAssets={scopedAssets.map((asset) => ({
          symbol: asset.symbol,
          priceUsd: asset.priceUsd
        }))}
        initialAction={transactionIntent.action}
        initialNote={transactionIntent.note}
        onChangeCoin={() => {
          setAddDialogOpen(false);
          setTransactionIntent({ action: "buy", note: "" });
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

      <SyncBinanceDialog
        open={isSyncDialogOpen}
        portfolioName={portfolioName}
        onClose={() => setSyncDialogOpen(false)}
        onSync={handleSyncPortfolio}
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
              <div className="content-shell max-w-7xl">
                <div className="panel-low p-5 text-sm text-muted">
                  Loading portfolio...
                </div>
              </div>
            </main>
          </div>
        </>
      }
    >
      <AuthGuard>
        <PortfolioContent />
      </AuthGuard>
    </Suspense>
  );
}
