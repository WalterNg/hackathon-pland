"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Portfolio", href: "/portfolio" },
  { label: "AI History", href: "/ai-history" },
  { label: "Risk Rules", href: "/risk-rules" },
  { label: "Journal", href: "/journal" },
  { label: "Milestones", href: "/milestones" },
] as const;

function normalizePath(path: string): string {
  if (path === "/") {
    return path;
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

type AppTopNavigationProps = {
  portfolioHref?: string;
  aiHistoryHref?: string | null;
  riskHref?: string;
  riskRulesHref?: string;
  milestonesHref?: string | null;
};

export function AppTopNavigation({
  portfolioHref = "/portfolio",
  ..._unused
}: AppTopNavigationProps) {
  return (
    <div className="flex w-full items-center gap-6 lg:gap-8 py-1">
      <Link href={portfolioHref} className="shrink-0">
        <img src="/logo-new.png" alt="Pland" className="w-24 h-auto object-contain" />
      </Link>
    </div>
  );
}
