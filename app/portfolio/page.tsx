"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MaterialIcon } from "../components/dashboard/material-icon";
import { RiskAlertCenterDialog } from "../components/portfolio/risk-alert-center-dialog";
import { AppTopNavigation } from "../components/ui/app-top-navigation";
import { AddTransactionDialog } from "../components/portfolio/add-transaction-dialog";
import { AIPortfolioRecommendationDashboard } from "../components/portfolio/ai-portfolio-recommendation-dashboard";
import { CreatePortfolioDialog } from "../components/portfolio/create-portfolio-dialog";
import { PortfolioAssetsTable } from "../components/portfolio/portfolio-assets-table";
import { PortfolioCharts } from "@/app/components/portfolio/portfolio-charts";
import { PortfolioHeader } from "../components/portfolio/portfolio-header";
import { PortfolioMetrics } from "../components/portfolio/portfolio-metrics";
import { RiskRulesDialog } from "../components/portfolio/risk-rules-dialog";
import { RiskMonitorPanel } from "../components/portfolio/risk-monitor-panel";
import { PortfolioSummary } from "../components/portfolio/portfolio-summary";
import { SelectCoinModal } from "../components/portfolio/select-coin-modal";
import { Sidebar } from "../components/ui/sidebar";
import { useRiskAlerts } from "../hooks/use-risk-alerts";
import { AuthGuard } from "../components/auth/auth-guard";
import { usePortfolioAIAnalysis } from "../hooks/use-portfolio-ai-analysis";
import { usePortfolios } from "../hooks/use-portfolios";
import { useRiskEvents } from "../hooks/use-risk-events";
import { useRiskRules } from "../hooks/use-risk-rules";
import { usePortfolioSnapshot } from "../hooks/use-portfolio-snapshot";
import { buildRecommendationActionCards, toSelectedCoin, type AIRecommendationActionPayload } from "@/app/lib/portfolio-ai-actions";
import type { PortfolioMode } from "@/app/lib/portfolio-types";
import type { RiskAlertStatus, RiskRulesFormValues } from "@/app/lib/risk-types";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

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
  const [isRiskRulesOpen, setRiskRulesOpen] = useState(false);
  const [isAlertCenterOpen, setAlertCenterOpen] = useState(false);
  const [alertStatus, setAlertStatus] = useState<RiskAlertStatus | "all">("all");
  const [isRemovingPortfolio, setRemovingPortfolio] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [selectedCoin, setSelectedCoin] = useState<{ symbol: string; name: string | null; baseAsset: string; quoteAsset: string } | null>(null);
  const [transactionIntent, setTransactionIntent] = useState<{ action: "buy" | "sell" | "transfer"; note: string }>({
    action: "buy",
    note: "",
  });
  const [aiActionFeedback, setAIActionFeedback] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);
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
    alerts: riskAlerts,
    isLoading: isRiskLoading,
    error: riskError,
    reload: reloadRisk,
  } = useRiskEvents(portfolioId, portfolioName);
  const {
    profile: editableRiskProfile,
    source: riskRuleSource,
    isLoading: isRiskRulesLoading,
    isSaving: isRiskRulesSaving,
    error: riskRulesError,
    save: saveRiskRules,
    reload: reloadRiskRules,
  } = useRiskRules(portfolioName);
  const {
    alerts: alertCenterAlerts,
    isLoading: isAlertCenterLoading,
    isUpdatingId: updatingAlertId,
    error: alertCenterError,
    reload: reloadAlertCenter,
    acknowledge,
    resolve,
  } = useRiskAlerts(portfolioName, alertStatus, 15_000, isAlertCenterOpen);
  const isConnectedPortfolio = currentPortfolio?.mode === "binance_connected";
  const primaryActionLabel = isMainPortfolio ? "Create portfolio" : isConnectedPortfolio ? "Read-only" : "Add transaction";
  const connectedStatusDescription =
    isConnectedPortfolio && snapshot?.summary.timestamp
      ? `This portfolio syncs automatically from Binance and manual edits are disabled. Last synced at ${formatSyncTimestamp(snapshot.summary.timestamp)}.`
      : isConnectedPortfolio
        ? "This portfolio syncs automatically from Binance and manual edits are disabled."
        : undefined;
  const defaultPortfolioName = useMemo(() => `Portfolio ${portfolios.length + 1}`, [portfolios.length]);
  const recommendationActionCards = useMemo(
    () => (recommendation ? buildRecommendationActionCards(recommendation, riskAlerts, editableRiskProfile) : []),
    [editableRiskProfile, recommendation, riskAlerts]
  );
  const criticalActiveAlerts = useMemo(
    () => riskAlerts.filter((alert) => alert.status === "active" && alert.severity === "critical"),
    [riskAlerts]
  );
  const warningActiveAlerts = useMemo(
    () => riskAlerts.filter((alert) => alert.status === "active" && alert.severity !== "critical"),
    [riskAlerts]
  );
  const pinnedCriticalAlert = useMemo(
    () => criticalActiveAlerts.find((alert) => alert.triggerCount >= 3) ?? criticalActiveAlerts[0] ?? null,
    [criticalActiveAlerts]
  );

  useEffect(() => {
    if (shouldOpenCreatePortfolio) {
      setCreatePortfolioOpen(true);
    }
  }, [shouldOpenCreatePortfolio]);

  const openAlertCenterForActiveAlerts = () => {
    setAlertStatus("active");
    setAlertCenterOpen(true);
  };

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

  const logAIActionEvent = async (
    payload: {
      actionType: "sell_intent_opened" | "protective_rules_applied" | "alert_center_opened";
      severity: "info" | "warning" | "critical";
      title: string;
      message: string;
      symbol?: string;
      details?: Record<string, unknown>;
    }
  ) => {
    try {
      await fetchWithSupabaseAuth("/api/ai/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          portfolioName,
          ...payload,
        }),
      });
    } catch {
      return;
    }
  };

  const handleTransactionCreated = async () => {
    await reload();
    await reloadRisk();
    await reloadAlertCenter();
    setAIActionFeedback({
      tone: "success",
      message: "Portfolio activity recorded. Risk monitor and alerts have been refreshed.",
    });
  };

  const handleSaveRiskRules = async (values: RiskRulesFormValues) => {
    const saved = await saveRiskRules(values);
    if (!saved) {
      return;
    }

    await reloadRiskRules();
    await reload();
    await reloadRisk();
    setRiskRulesOpen(false);
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    const ok = await acknowledge(alertId);
    if (!ok) {
      return;
    }

    await reloadRisk();
    await reloadAlertCenter();
  };

  const handleResolveAlert = async (alertId: string) => {
    const ok = await resolve(alertId);
    if (!ok) {
      return;
    }

    await reloadRisk();
    await reloadAlertCenter();
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

  const handleOpenSellIntent = async (symbol: string, note: string) => {
    if (isMainPortfolio) {
      setAIActionFeedback({
        tone: "info",
        message: "Create a child portfolio first before applying AI trade intents.",
      });
      setCreatePortfolioOpen(true);
      return;
    }

    if (isConnectedPortfolio) {
      setAIActionFeedback({
        tone: "info",
        message: "Connected portfolios are read-only. Review the recommendation, then manage execution on Binance directly.",
      });
      return;
    }

    const nextCoin = toSelectedCoin(symbol);
    setTransactionIntent({ action: "sell", note });
    setSelectedCoin(nextCoin);
    setAddDialogOpen(true);
    setAIActionFeedback({
      tone: "info",
      message: `Sell flow opened for ${nextCoin.baseAsset}. Review quantity and price before confirming.`,
    });

    await logAIActionEvent({
      actionType: "sell_intent_opened",
      severity: riskAlerts.some((alert) => alert.severity === "critical") ? "critical" : "warning",
      title: "AI sell flow opened",
      message: note,
      symbol,
      details: {
        source: "ai_recommendation_dashboard",
      },
    });
  };

  const handleApplyProtectiveRules = async (values: RiskRulesFormValues, note: string) => {
    const saved = await saveRiskRules(values);
    if (!saved) {
      setAIActionFeedback({
        tone: "error",
        message: "Unable to apply the defensive rule set. Review the rule form and try again.",
      });
      return;
    }

    await reloadRiskRules();
    await reload();
    await reloadRisk();
    await reloadAlertCenter();
    setRiskRulesOpen(true);
    setAIActionFeedback({
      tone: "success",
      message: "Defensive rules have been applied. Review the updated guardrails and active alerts.",
    });

    await logAIActionEvent({
      actionType: "protective_rules_applied",
      severity: riskAlerts.some((alert) => alert.severity === "critical") ? "critical" : "warning",
      title: "AI defensive rules applied",
      message: note,
      details: {
        values,
        source: "ai_recommendation_dashboard",
      },
    });
  };

  const handleOpenAlertCenterFromAI = async (note: string) => {
    setAlertStatus("active");
    setAlertCenterOpen(true);
    setAIActionFeedback({
      tone: "info",
      message: "Alert Center opened so you can review the active breaches behind this recommendation.",
    });

    await logAIActionEvent({
      actionType: "alert_center_opened",
      severity: riskAlerts.some((alert) => alert.severity === "critical") ? "critical" : "info",
      title: "AI-linked alert review opened",
      message: note,
      details: {
        source: "ai_recommendation_dashboard",
      },
    });
  };

  const handleRecommendationAction = async (payload: AIRecommendationActionPayload) => {
    if (payload.type === "sell-intent") {
      await handleOpenSellIntent(payload.symbol, payload.note);
      return;
    }

    if (payload.type === "apply-protective-rules") {
      await handleApplyProtectiveRules(payload.values, payload.note);
      return;
    }

    await handleOpenAlertCenterFromAI(payload.note);
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
          <div className="content-shell max-w-7xl pb-6">
            <PortfolioHeader
              portfolioName={portfolioName}
              statusLabel={isConnectedPortfolio ? "Connected to Binance" : undefined}
              statusDescription={connectedStatusDescription}
              criticalAlertCount={criticalActiveAlerts.length}
              warningAlertCount={warningActiveAlerts.length}
              onOpenAlertCenter={openAlertCenterForActiveAlerts}
              primaryActionLabel={primaryActionLabel}
              onPrimaryAction={openTransactionFlow}
              isPrimaryActionDisabled={isConnectedPortfolio}
              onRemovePortfolio={handleRemovePortfolio}
              showRemovePortfolio={!isMainPortfolio}
              isRemovingPortfolio={isRemovingPortfolio}
              showCharts={showCharts}
              onToggleShowCharts={() => setShowCharts((prev) => !prev)}
            />

            {pinnedCriticalAlert ? (
              <section className="mb-6 overflow-hidden rounded-3xl border border-rose-500/20 bg-[linear-gradient(90deg,rgba(127,29,29,0.18),rgba(58,12,25,0.1),rgba(8,13,22,0.96))] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:px-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-rose-200/88">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-300 animate-pulse" />
                      Critical alert requires action
                      {pinnedCriticalAlert.triggerCount >= 3 ? (
                        <span className="rounded-full border border-rose-300/20 bg-rose-500/12 px-2 py-0.5 text-[0.64rem] text-rose-100/90">
                          Repeated {pinnedCriticalAlert.triggerCount} times
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base font-semibold text-white sm:text-lg">{pinnedCriticalAlert.title}</p>
                    <p className="mt-1 max-w-3xl text-sm text-rose-50/78">{pinnedCriticalAlert.message}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={openAlertCenterForActiveAlerts} className="ui-button-secondary">
                      Review alerts
                    </button>
                    <button type="button" onClick={() => setRiskRulesOpen(true)} className="ui-button-primary">
                      Tighten rules
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

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
                <AIPortfolioRecommendationDashboard
                  key={portfolioName}
                  recommendation={recommendation}
                  actionCards={recommendationActionCards}
                  alerts={riskAlerts}
                  isAnalyzing={isAnalyzing}
                  activeStepId={activeStepId}
                  steps={steps}
                  error={aiError}
                  actionFeedback={aiActionFeedback}
                  onClearActionFeedback={() => setAIActionFeedback(null)}
                  onAction={handleRecommendationAction}
                  onOpenAlertCenter={openAlertCenterForActiveAlerts}
                  onAnalyze={handleAnalyzeWithAI}
                  isDisabled={!snapshot || isLoading}
                />
                <RiskMonitorPanel
                  metrics={snapshot.metrics}
                  profile={riskProfile}
                  events={riskEvents}
                  alerts={riskAlerts}
                  isLoading={isRiskLoading}
                  error={riskError}
                  onManageRules={() => setRiskRulesOpen(true)}
                  onViewAlerts={openAlertCenterForActiveAlerts}
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
        onClose={closeAddDialog}
        portfolioName={portfolioName}
        coin={selectedCoin}
        portfolioAssets={snapshot?.assets.map((asset) => ({
          symbol: asset.symbol,
          priceUsd: asset.priceUsd
        })) ?? []}
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

      <RiskRulesDialog
        open={isRiskRulesOpen}
        portfolioName={portfolioName}
        profile={editableRiskProfile}
        source={riskRuleSource}
        isLoading={isRiskRulesLoading}
        isSaving={isRiskRulesSaving}
        error={riskRulesError}
        onClose={() => setRiskRulesOpen(false)}
        onSave={handleSaveRiskRules}
      />

      <RiskAlertCenterDialog
        open={isAlertCenterOpen}
        alerts={alertCenterAlerts}
        status={alertStatus}
        isLoading={isAlertCenterLoading}
        isUpdatingId={updatingAlertId}
        error={alertCenterError}
        onClose={() => setAlertCenterOpen(false)}
        onStatusChange={setAlertStatus}
        onAcknowledge={handleAcknowledgeAlert}
        onResolve={handleResolveAlert}
        onReviewRules={() => {
          setAlertCenterOpen(false);
          setRiskRulesOpen(true);
        }}
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
