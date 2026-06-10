"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type TabKey = "holdings" | "ai-history" | "risk-rules" | "journal" | "milestones";

type TabItem = {
  key: TabKey;
  label: string;
  hideForMainPortfolio?: boolean;
};

const TABS: TabItem[] = [
  { key: "holdings", label: "Portfolio Overview" },
  { key: "ai-history", label: "AI History", hideForMainPortfolio: true },
  { key: "risk-rules", label: "Risk Rules" },
  // { key: "journal", label: "Journal" }, // hidden from UI, code preserved in tab-journal.tsx
  { key: "milestones", label: "Milestones", hideForMainPortfolio: true },
];

type PortfolioSubNavigationProps = {
  portfolioName: string;
  activeTab?: TabKey;
};

export function PortfolioSubNavigation({ portfolioName, activeTab = "holdings" }: PortfolioSubNavigationProps) {
  const searchParams = useSearchParams();
  const isMainPortfolio = portfolioName === "Main Portfolio";

  const buildHref = (tabKey: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("name", portfolioName);
    if (tabKey === "holdings") {
      params.delete("tab");
    } else {
      params.set("tab", tabKey);
    }
    // Clear pagination when switching tabs
    params.delete("page");
    return `/portfolio?${params.toString()}`;
  };

  return (
    <nav className="mb-6 flex border-b border-white/8">
      {TABS.map((tab) => {
        if (tab.hideForMainPortfolio && isMainPortfolio) return null;

        const isActive = activeTab === tab.key;

        return (
          <Link
            key={tab.key}
            href={buildHref(tab.key)}
            className={`flex items-center gap-2 border-b-2 px-1 pb-3 pr-5 text-sm font-semibold transition-colors ${
              isActive
                ? "border-white text-strong"
                : "border-transparent text-muted hover:text-strong"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
