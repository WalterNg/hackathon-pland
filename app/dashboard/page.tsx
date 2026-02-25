"use client";

import { Header } from "../components/dashboard/header";
import { OverviewTable } from "../components/dashboard/overview-table";
import { PortfolioSection } from "../components/dashboard/portfolio-section";
import { RightColumn } from "../components/dashboard/right-column";
import { StatBanner } from "../components/dashboard/stat-banner";
import { Sidebar } from "../components/ui/sidebar";
import { usePortfolioSnapshot } from "../hooks/use-portfolio-snapshot";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";

export default function DashboardPage() {
  const { snapshot, isLoading, error } = usePortfolioSnapshot(DEFAULT_PORTFOLIO_NAME);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />

      <div className="relative flex h-screen flex-1 flex-col overflow-hidden bg-white">
        <Header />

        <main className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8">
          <div className="content-shell space-y-6">
            {isLoading && (
              <div className="rounded-2xl border border-gray-100 bg-card-light p-5 text-sm text-muted">
                Loading dashboard snapshot…
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-gray-100 bg-card-light p-5 text-sm text-danger">
                Unable to load live data: {error}
              </div>
            )}

            {snapshot && (
              <>
                <StatBanner
                  totalValueBtc={snapshot.summary.totalValueBtc}
                  totalValueUsd={snapshot.summary.totalValueUsd}
                  btcPriceUsd={snapshot.summary.btcPriceUsd}
                  totalVolume24hUsd={snapshot.metrics.totalVolume24hUsd}
                  allTimeProfitPercent={snapshot.metrics.allTimeProfitPercent}
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="space-y-6 lg:col-span-8">
                    <PortfolioSection chart={snapshot.chart} assets={snapshot.assets} />
                    <OverviewTable summary={snapshot.summary} metrics={snapshot.metrics} assets={snapshot.assets} />
                  </div>

                  <RightColumn assets={snapshot.assets} portfolioName={DEFAULT_PORTFOLIO_NAME} />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
