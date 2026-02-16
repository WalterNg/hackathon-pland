"use client";

import { MaterialIcon } from "../components/dashboard/material-icon";
import { PortfolioAssetsTable } from "../components/portfolio/portfolio-assets-table";
import { PortfolioCharts } from "../components/portfolio/portfolio-charts";
import { PortfolioHeader } from "../components/portfolio/portfolio-header";
import { PortfolioMetrics } from "../components/portfolio/portfolio-metrics";
import { PortfolioSummary } from "../components/portfolio/portfolio-summary";
import { Sidebar } from "../components/ui/sidebar";

export default function PortfolioPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <PortfolioHeader />

        <div className="flex-1 overflow-y-auto p-8 pt-0">
          <PortfolioSummary />
          <PortfolioMetrics />
          <PortfolioCharts />
          <PortfolioAssetsTable />
        </div>
      </main>

      <button className="text-on-primary fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg md:hidden">
        <MaterialIcon name="add" outlined={false} />
      </button>
    </div>
  );
}
