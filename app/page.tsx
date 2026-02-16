"use client";

import { Header } from "./components/dashboard/header";
import { OverviewTable } from "./components/dashboard/overview-table";
import { PortfolioSection } from "./components/dashboard/portfolio-section";
import { RightColumn } from "./components/dashboard/right-column";
import { StatBanner } from "./components/dashboard/stat-banner";
import { Sidebar } from "./components/ui/sidebar";

export default function HomePage() {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />

      <div className="relative flex h-screen flex-1 flex-col overflow-hidden bg-white">
        <Header />

        <main className="flex-1 overflow-y-auto px-8 pb-8">
          <div className="mx-auto max-w-400 space-y-6">
            <StatBanner />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <PortfolioSection />
                <OverviewTable />
              </div>

              <RightColumn />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
