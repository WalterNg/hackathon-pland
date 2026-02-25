"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MaterialIcon } from "../dashboard/material-icon";
import { usePortfolios } from "@/app/hooks/use-portfolios";

const DEFAULT_PORTFOLIOS = ["Main Portfolio"];

const navItems = [
  { label: "Journal", icon: "book", href: "/journal" }
] as const;

function normalizePath(path: string): string {
  if (path === "/") {
    return path;
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function Sidebar() {
  return (
    <Suspense
      fallback={<aside className="text-inverse z-20 m-0 hidden w-52 shrink-0 bg-sidebar-dark md:flex" />}
    >
      <SidebarContent />
    </Suspense>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPortfolioOpen, setPortfolioOpen] = useState(true);
  const { portfolios } = usePortfolios();

  const currentPath = normalizePath(pathname);
  const selectedPortfolio = searchParams.get("name")?.trim() || DEFAULT_PORTFOLIOS[0];

  const isActive = (href: string) => {
    const normalizedHref = normalizePath(href);
    return currentPath === normalizedHref || currentPath.startsWith(`${normalizedHref}/`);
  };

  const portfolioActive = isActive("/portfolio");

  return (
    <aside className="text-inverse z-20 m-0 hidden w-52 shrink-0 flex-col justify-between bg-sidebar-dark transition-all duration-300 md:flex">
      <div>
        <div className="flex h-24 items-center px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Pland" className="h-8 w-8" />
            <span className="text-inverse text-xl font-bold tracking-tight">Pland</span>
          </div>
        </div>
        <nav className="mt-4 space-y-4 px-6">
          <div>
            <div
              className={
                portfolioActive
                  ? "typo-body-sm text-on-primary flex items-center gap-2 rounded-xl bg-primary px-3 py-3 shadow-sm transition-colors"
                  : "text-subtle typo-body-sm flex items-center gap-2 rounded-xl px-3 py-3 transition-colors hover:bg-gray-800 hover:text-inverse"
              }
            >
              <Link href="/portfolio" className="flex min-w-0 flex-1 items-center gap-3">
                <MaterialIcon
                  name="pie_chart"
                  outlined={false}
                  className={portfolioActive ? "text-xl" : "text-xl"}
                />
                <span>Portfolios</span>
              </Link>

              <button
                type="button"
                onClick={() => setPortfolioOpen((openState) => !openState)}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20 transition hover:bg-white/30"
                aria-label={isPortfolioOpen ? "Hide portfolios" : "Show portfolios"}
              >
                <MaterialIcon
                  name={isPortfolioOpen ? "expand_less" : "expand_more"}
                  outlined={false}
                  className="text-sm"
                />
              </button>
            </div>

            {isPortfolioOpen && (
              <div className="mt-2 space-y-1 pl-8">
                {portfolios.map((portfolio) => {
                  const portfolioName = portfolio.name;
                  const portfolioHref = `/portfolio?name=${encodeURIComponent(portfolioName)}`;
                  const isSelected = portfolioActive && selectedPortfolio === portfolioName;

                  return (
                    <Link
                      key={portfolioName}
                      href={portfolioHref}
                      className={
                        isSelected
                          ? "typo-body-xs text-sidebar-dark block rounded-lg bg-card-light px-3 py-2"
                          : "typo-body-xs text-subtle block rounded-lg px-3 py-2 transition-colors hover:bg-gray-800 hover:text-inverse"
                      }
                    >
                      {portfolioName}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={
                isActive(item.href)
                  ? "typo-body-sm text-on-primary flex items-center gap-4 rounded-xl bg-primary px-4 py-3 shadow-sm transition-colors"
                  : "text-subtle typo-body-sm group flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-gray-800 hover:text-inverse"
              }
            >
              <MaterialIcon
                name={item.icon}
                outlined={false}
                className={isActive(item.href) ? "text-xl" : "text-xl transition-colors group-hover:text-primary"}
              />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="px-6 pb-6">
        <Link
          href="/auth/logout"
          className="text-subtle typo-body-sm group flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-gray-800 hover:text-inverse"
        >
          <MaterialIcon name="logout" outlined={false} className="text-xl transition-colors group-hover:text-primary" />
          Logout
        </Link>
      </div>
    </aside>
  );
}
