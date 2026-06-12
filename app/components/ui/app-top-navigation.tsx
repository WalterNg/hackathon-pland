"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useUserJourney } from "../user-journey/user-journey-context";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { startJourney } = useUserJourney();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleStartJourney = () => {
    setMenuOpen(false);
    startJourney();
  };

  return (
    <div className="flex w-full items-center justify-between py-1">
      <Link href={portfolioHref} className="shrink-0">
        <img src="/logo-new.png" alt="Pland" className="w-24 h-auto object-contain" />
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <rect y="0" width="18" height="2" rx="1" fill="currentColor" className="text-muted" />
            <rect y="6" width="18" height="2" rx="1" fill="currentColor" className="text-muted" />
            <rect y="12" width="18" height="2" rx="1" fill="currentColor" className="text-muted" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[260px] overflow-hidden rounded-xl border border-white/10 bg-[#12151f] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <button
              type="button"
              onClick={handleStartJourney}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-muted hover:bg-white/6 hover:text-strong transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0 text-primary"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16.5 7.5l-3.5 7-3.5-3.5 7-3.5z" fill="currentColor" />
              </svg>
              <span>User Journey</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
