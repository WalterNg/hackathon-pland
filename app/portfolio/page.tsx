"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MaterialIcon } from "../components/dashboard/material-icon";
import { AppTopNavigation } from "../components/ui/app-top-navigation";
import { AddTransactionDialog } from "../components/portfolio/add-transaction-dialog";
import { CreatePortfolioDialog } from "../components/portfolio/create-portfolio-dialog";
import { MilestoneBadge } from "../components/milestones/milestone-badge";
import { MilestoneDetailModal } from "../components/milestones/milestone-detail-modal";
import { SyncBinanceDialog } from "../components/portfolio/sync-binance-dialog";
import { PortfolioAssetsTable } from "../components/portfolio/portfolio-assets-table";
import { PortfolioTransactionsList } from "../components/portfolio/portfolio-transactions-list";
import { PortfolioCharts } from "@/app/components/portfolio/portfolio-charts";
import { PortfolioHeader } from "../components/portfolio/portfolio-header";
import { PortfolioSubNavigation } from "../components/portfolio/portfolio-sub-navigation";
import { PortfolioMetrics } from "../components/portfolio/portfolio-metrics";
import { PortfolioSummary } from "../components/portfolio/portfolio-summary";
import { SelectCoinModal } from "../components/portfolio/select-coin-modal";
import { CertifySnapshotDialog } from "../components/portfolio/certify-snapshot-dialog";
import { Sidebar } from "../components/ui/sidebar";
import { AuthGuard } from "../components/auth/auth-guard";
import { useTradingAgentAnalysis } from "../hooks/use-trading-agent-analysis";
import { usePortfolioForecast } from "../hooks/use-portfolio-forecast";
import { usePortfolioUiSession } from "../hooks/use-portfolio-ui-session";
import { usePortfolios } from "../hooks/use-portfolios";
import { usePortfolioSnapshotCertificates } from "../hooks/use-portfolio-snapshot-certificates";
import { usePortfolioSnapshot } from "../hooks/use-portfolio-snapshot";
import { RefreshIntervals } from "@/app/lib/refresh-intervals";
import { TabAiHistory } from "../components/portfolio/tabs/tab-ai-history";
import { TabRiskRules } from "../components/portfolio/tabs/tab-risk-rules";
import { TabMilestones } from "../components/portfolio/tabs/tab-milestones";
import { TabJournal } from "../components/portfolio/tabs/tab-journal";
import type { PortfolioMode, PortfolioSnapshot } from "@/app/lib/portfolio-types";

type PortfolioTab = "holdings" | "ai-history" | "risk-rules" | "journal" | "milestones";

function parseTab(value: string | null, isMainPortfolio: boolean): PortfolioTab {
  if (value === "ai-history" && !isMainPortfolio) return "ai-history";
  if (value === "risk-rules") return "risk-rules";
  if (value === "journal") return "journal";
  if (value === "milestones" && !isMainPortfolio) return "milestones";
  return "holdings";
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const portfolioName = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIO_NAME;
  const shouldOpenCreatePortfolio = searchParams.get("createPortfolio") === "1";
  const isMainPortfolio = useMemo(() => portfolioName === DEFAULT_PORTFOLIO_NAME, [portfolioName]);
  const activeTab = parseTab(searchParams.get("tab"), isMainPortfolio);
  const { createPortfolio, removePortfolio, syncPortfolio, renamePortfolio, portfolios } = usePortfolios();
  const [isSelectCoinOpen, setSelectCoinOpen] = useState(false);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isCreatePortfolioOpen, setCreatePortfolioOpen] = useState(false);
  const [isSyncDialogOpen, setSyncDialogOpen] = useState(false);
  const [isCertifyDialogOpen, setCertifyDialogOpen] = useState(false);
  const [isRemovingPortfolio, setRemovingPortfolio] = useState(false);
  const [isSyncingPortfolio, setSyncingPortfolio] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [holdingsTab, setHoldingsTab] = useState<"assets" | "transactions">("assets");
  const [isCertificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [snapshotCacheByPortfolio, setSnapshotCacheByPortfolio] = useState<Record<string, PortfolioSnapshot>>({});
  const [tradingAgentRecommendationRefreshToken, setTradingAgentRecommendationRefreshToken] = useState(0);
  const [selectedCoin, setSelectedCoin] = useState<{ symbol: string; name: string | null; baseAsset: string; quoteAsset: string } | null>(null);
  const [transactionIntent, setTransactionIntent] = useState<{ action: "buy" | "sell" | "transfer"; note: string }>({
    action: "buy",
    note: "",
  });
  const tradingAgentScopeKey = isMainPortfolio ? null : portfolioName;

  const currentPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.name === portfolioName) ?? null,
    [portfolios, portfolioName]
  );
  const portfolioId = currentPortfolio?.id ?? null;
  const {
    portfolioUiSessionId,
    portfolioUiSessionUserId,
    isReady: isPortfolioUiSessionReady,
  } = usePortfolioUiSession(portfolioId);
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
  } = useTradingAgentAnalysis({
    scopeKey: tradingAgentScopeKey,
    portfolioId,
    portfolioUiSessionId,
    portfolioUiSessionUserId,
    portfolioUiSessionReady: isPortfolioUiSessionReady,
    portfolioResolved: portfolioId !== null,
    portfolioRecommendationRefreshToken: tradingAgentRecommendationRefreshToken,
  });
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
  const {
    certificates,
    selectedCertificate,
    isLoading: isCertificatesLoading,
    isCreating: isCreatingCertificate,
    error: certificatesError,
    createCertificate,
    getCertificate,
  } = usePortfolioSnapshotCertificates(portfolioId, portfolioName);
  const scopedSnapshot = snapshot?.summary.name === portfolioName ? snapshot : null;

  const invalidateTradingAgentRecommendationCache = () => {
    setTradingAgentRecommendationRefreshToken((value) => value + 1);
  };

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
  const {
    forecast: portfolioForecast,
    isLoading: isForecastLoading,
    error: portfolioForecastError,
    ensureLoaded: ensurePortfolioForecastLoaded,
    refresh: refreshPortfolioForecast,
  } = usePortfolioForecast(effectiveSnapshot);

  const isConnectedPortfolio = currentPortfolio?.mode === "binance_connected";
  const primaryActionLabel = isMainPortfolio ? "Create portfolio" : isConnectedPortfolio ? "Read-only" : "Add transaction";
  const riskManagementHref = `/risk?name=${encodeURIComponent(portfolioName)}`;
  const riskRulesHref = `/risk-rules?name=${encodeURIComponent(portfolioName)}`;
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
    router.replace(nextQuery ? `/portfolio?${nextQuery}` : "/portfolio");
  };

  const handleSyncPortfolio = async (assets: Array<{ asset: string; quantity: number; price_usd: number }>) => {
    setSyncingPortfolio(true);
    try {
      const result = await syncPortfolio(portfolioName, assets);
      if (!result.ok) {
        window.alert(result.message ?? "Unable to sync portfolio.");
        return;
      }
      invalidateTradingAgentRecommendationCache();
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
    invalidateTradingAgentRecommendationCache();
    await reload();
  };

  const handleCreateCertificate = async () => {
    setCertifyDialogOpen(true);
  };

  const handleSubmitCertificate = async (manualTitle: string, manualNote: string) => {
    const detail = await createCertificate({
      portfolioId,
      portfolioName,
      snapshotPayload: effectiveSnapshot,
      certifyMode: "manual",
      title: manualTitle,
      note: manualNote,
    });
    if (detail) {
      setCertifyDialogOpen(false);
      setCertificateDialogOpen(true);
    }
  };

  const handleOpenCertificate = async (certificateId: string) => {
    const detail = await getCertificate(certificateId);
    if (detail) {
      setCertificateDialogOpen(true);
    }
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

      invalidateTradingAgentRecommendationCache();

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
          />
        </div>
      </header>
      {/* data-tour anchor for create portfolio — targets the primary action button rendered in PortfolioHeader */}

      <div className="app-shell flex overflow-hidden">
        <Sidebar
          portfolios={portfolios}
          livePortfolioValuesByName={livePortfolioValuesByName}
        />

        <main className="app-main overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-8 lg:px-8">
          <div className="content-shell max-w-7xl pb-6">
            {/* ── Portfolio Title and Actions Area ── */}
            <PortfolioHeader
              portfolioName={portfolioName}
              portfolioMode={currentPortfolio?.mode}
              statusLabel={undefined}
              statusDescription={undefined}
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
              onCertifySnapshot={handleCreateCertificate}
              isCertifyingSnapshot={isCreatingCertificate}
              isCertifySnapshotDisabled={!effectiveSnapshot || isLoading}
              hideActions={activeTab !== "holdings"}
              onRenamePortfolio={!isMainPortfolio ? async (newName) => {
                const result = await renamePortfolio(portfolioName, newName);
                if (result.ok) {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("name", newName);
                  router.replace(`/portfolio?${params.toString()}`);
                }
                return result;
              } : undefined}
            />

            {/* ── Tabs Navigation (always under the title/actions) ── */}
            <div data-tour="tab-ai-history">
              <PortfolioSubNavigation portfolioName={portfolioName} activeTab={activeTab} />
            </div>

            {/* ── Tab: Holdings (default) ── */}
            {activeTab === "holdings" && (
              <>
                {isLoading && !effectiveSnapshot && (
                  <div className="panel-low mb-6 p-5 text-sm text-muted">Loading portfolio snapshot...</div>
                )}

                {error && (
                  <div className="panel-low mb-6 p-5 text-sm text-danger">
                    Unable to load live data: {error}
                  </div>
                )}

                {effectiveSnapshot && (
                  <>
                    {throttledSummary && throttledMetrics ? (
                      <div data-tour="portfolio-summary">
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
                        isAnalyzeDisabled={
                          isMainPortfolio ||
                          !effectiveSnapshot ||
                          isLoading ||
                          !isPortfolioUiSessionReady
                        }
                      />
                      </div>
                    ) : null}
                    <div data-tour="portfolio-metrics">
                      <PortfolioMetrics metrics={throttledMetrics ?? scopedMetrics} />
                    </div>
                    {showCharts && (
                      <div data-tour="portfolio-charts">
                        <PortfolioCharts
                          chart={throttledChart}
                          assets={throttledAssets}
                          forecast={portfolioForecast}
                          forecastError={portfolioForecastError}
                          isForecastLoading={isForecastLoading}
                          onOpenForecast={ensurePortfolioForecastLoaded}
                          onRefreshForecast={refreshPortfolioForecast}
                          isLoading={isLoading || isRefreshing || throttledChart.length === 0}
                        />
                      </div>
                    )}
                    {/* Assets / Transactions inner tab switcher */}
                    <div data-tour="portfolio-assets">
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
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Tab: AI History ── */}
            {activeTab === "ai-history" && (
              <TabAiHistory portfolioName={portfolioName} portfolioId={portfolioId} />
            )}

            {/* ── Tab: Risk Rules ── */}
            {activeTab === "risk-rules" && (
              <TabRiskRules
                portfolioName={portfolioName}
                portfolioId={portfolioId}
                snapshot={effectiveSnapshot}
                lastServerSyncAt={lastServerSyncAt}
              />
            )}

            {/* ── Tab: Journal ── */}
            {activeTab === "journal" && (
              <TabJournal portfolioName={portfolioName} />
            )}

            {/* ── Tab: Milestones ── */}
            {activeTab === "milestones" && (
              <TabMilestones portfolioName={portfolioName} portfolioId={portfolioId} />
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

      <CertifySnapshotDialog
        open={isCertifyDialogOpen}
        isSubmitting={isCreatingCertificate}
        error={certificatesError}
        onClose={() => setCertifyDialogOpen(false)}
        onSubmit={handleSubmitCertificate}
      />

      <MilestoneDetailModal
              open={isCertificateDialogOpen}
              certificate={selectedCertificate}
              portfolioName={portfolioName}
              onClose={() => setCertificateDialogOpen(false)}
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
