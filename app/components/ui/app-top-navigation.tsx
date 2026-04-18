"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Portfolio", href: "/portfolio" },
  { label: "Risk Management", href: "/risk" },
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
  riskHref?: string;
  milestonesHref?: string | null;
};

export function AppTopNavigation({ portfolioHref = "/portfolio", riskHref = "/risk", milestonesHref = "/milestones" }: AppTopNavigationProps) {
  const pathname = usePathname();
  const currentPath = normalizePath(pathname);

  return (
    <div className="flex w-full items-center gap-6 lg:gap-8">
      <Link href={portfolioHref} className="shrink-0">
        <img src="/logo-new.png" alt="Pland" className="w-24 h-auto object-contain" />
      </Link>

      <nav className="min-w-0 flex-1 overflow-x-auto">
        <div className="flex min-w-max items-center gap-5 pr-4 lg:pr-0">
        {navItems.map((item) => {
          const href = item.href === "/portfolio"
            ? portfolioHref
            : item.href === "/risk"
              ? riskHref
              : item.href === "/milestones"
                ? milestonesHref
                : item.href;

          // Hide nav item if href is explicitly null
          if (href === null) return null;

          const normalizedHref = normalizePath(item.href);
          const isActive = currentPath === normalizedHref || currentPath.startsWith(`${normalizedHref}/`);

          return (
            <Link
              key={item.href}
              href={href}
              className={
                isActive
                  ? "relative py-3 text-sm font-semibold text-strong after:absolute after:-bottom-px after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-primary"
                  : "relative py-3 text-sm font-semibold text-muted transition-colors hover:text-strong"
              }
            >
              {item.label}
            </Link>
          );
        })}
        </div>
      </nav>
    </div>
  );
}