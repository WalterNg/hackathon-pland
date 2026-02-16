"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "../dashboard/material-icon";

const navItems = [
  { label: "Dashboard", icon: "dashboard", href: "/" },
  { label: "Portfolios", icon: "pie_chart", href: "/portfolio" },
  { label: "Journal", icon: "book", href: "/journal" }
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="text-inverse z-20 m-0 hidden w-52 shrink-0 flex-col justify-between bg-sidebar-dark transition-all duration-300 md:flex">
      <div>
        <div className="flex h-24 items-center px-8">
          <div className="flex items-center gap-3">
            <div className="text-on-primary flex h-8 w-8 items-center justify-center rounded bg-primary text-lg font-bold">T</div>
            <span className="text-inverse text-xl font-bold tracking-tight">TradeLogix</span>
          </div>
        </div>
        <nav className="mt-4 space-y-4 px-6">
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

    </aside>
  );
}
