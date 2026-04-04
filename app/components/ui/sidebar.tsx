"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MaterialIcon } from "../dashboard/material-icon";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { usePortfolios } from "@/app/hooks/use-portfolios";

const DEFAULT_PORTFOLIOS = ["Main Portfolio"];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

function formatPortfolioTotal(totalValueUsd: number | null | undefined): string {
  if (totalValueUsd === null || totalValueUsd === undefined || !Number.isFinite(totalValueUsd)) {
    return "$0.00";
  }

  return usdFormatter.format(totalValueUsd);
}

function normalizePath(path: string): string {
  if (path === "/") {
    return path;
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function Sidebar() {
  return (
    <Suspense
      fallback={<aside className="sidebar-container text-inverse z-20 mb-4 hidden w-64 shrink-0 md:flex" />}
    >
      <SidebarContent />
    </Suspense>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { portfolios } = usePortfolios();
  const [isLoggingOut, setLoggingOut] = useState(false);

  const currentPath = normalizePath(pathname);
  const selectedPortfolio = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIOS[0];
  const mainPortfolio = portfolios.find((portfolio) => portfolio.isDefault) ?? portfolios[0] ?? {
    id: "main",
    name: DEFAULT_PORTFOLIOS[0],
    isDefault: true
  };
  const mainPortfolioHref = `/portfolio?name=${encodeURIComponent(mainPortfolio.name)}`;
  const createPortfolioHref = `/portfolio?name=${encodeURIComponent(mainPortfolio.name)}&createPortfolio=1`;
  const secondaryPortfolios = portfolios.filter((portfolio) => portfolio.id !== mainPortfolio.id);

  const isActive = (href: string) => {
    const normalizedHref = normalizePath(href);
    return currentPath === normalizedHref || currentPath.startsWith(`${normalizedHref}/`);
  };

  const portfolioActive = isActive("/portfolio");
  const isMainPortfolioActive = portfolioActive && selectedPortfolio === mainPortfolio.name;

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const supabase = await createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/auth/login");
    }
  };

  return (
    <aside className="sidebar-container text-inverse z-20 mb-4 hidden w-64 shrink-0 flex-col justify-between p-4 transition-all duration-300 md:flex">
      <div>
        <nav className="space-y-6 px-2">
          <Link
            href={mainPortfolioHref}
            className={
              isMainPortfolioActive
                ? "flex items-center gap-3 rounded-3xl bg-linear-to-r from-[#3f66ff] to-[#3352d9] px-4 py-4 text-white shadow-[0_18px_40px_rgba(52,87,255,0.28)] transition-transform hover:-translate-y-0.5"
                : "flex items-center gap-3 rounded-3xl bg-(--surface-container-low) px-4 py-4 text-inverse transition-colors hover:bg-(--surface-container)"
            }
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/16">
              <MaterialIcon name="grid_view" outlined={false} className="text-[1.35rem]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="typo-body-sm font-semibold leading-tight">{mainPortfolio.name}</div>
              <div className={isMainPortfolioActive ? "typo-body-sm text-white/72" : "typo-body-sm text-muted"}>Overview</div>
            </div>
          </Link>

          <div className="space-y-2">
            <div className="px-1 typo-body font-semibold text-strong">My portfolios ({secondaryPortfolios.length})</div>

            <div className="space-y-1.5">
              {secondaryPortfolios.map((portfolio) => {
                const portfolioName = portfolio.name;
                const portfolioHref = `/portfolio?name=${encodeURIComponent(portfolioName)}`;
                const isSelected = portfolioActive && selectedPortfolio === portfolioName;

                return (
                  <Link
                    key={portfolioName}
                    href={portfolioHref}
                    className={
                      isSelected
                        ? "flex items-center gap-3 rounded-2xl bg-(--surface-container-highest) px-3 py-3 text-inverse"
                        : "flex items-center gap-3 rounded-2xl px-3 py-3 text-subtle transition-colors hover:bg-(--surface-container) hover:text-inverse"
                    }
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary">
                      <span className="text-sm font-semibold uppercase">{portfolioName.slice(0, 2)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="typo-body truncate font-semibold text-current">{portfolioName}</div>
                      <div className="typo-body-sm text-muted">{formatPortfolioTotal(portfolio.totalValueUsd)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <Link
              href={createPortfolioHref}
              className="flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-(--surface-container-low)"
            >
              <MaterialIcon name="add" outlined={false} className="text-xl" />
              Create portfolio
            </Link>
          </div>
        </nav>
      </div>

      <div className="px-6 pb-6">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-subtle typo-body-sm group flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-(--surface-container-highest) hover:text-inverse disabled:opacity-60"
        >
          <MaterialIcon name="logout" outlined={false} className="text-xl transition-colors group-hover:text-primary" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}
