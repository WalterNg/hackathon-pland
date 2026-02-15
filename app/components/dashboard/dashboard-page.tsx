import { Header } from "./header";
import { OverviewTable } from "./overview-table";
import { PortfolioSection } from "./portfolio-section";
import { RightColumn } from "./right-column";
import { Sidebar } from "./sidebar";
import { StatBanner } from "./stat-banner";

export function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <Sidebar />

      <div className="relative flex h-screen flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
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
