"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { badgeImageUrl, getTierFromNumber, TIER_STYLES } from "@/app/lib/achievement-tier";
import type { AchievementTier } from "@/app/lib/achievement-tier";

type Achievement = {
  key: string;
  title: string;
  nickname: string;
  description: string;
  tier: number;
};

async function fetchWithAuth(path: string) {
  const supabase = await createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  return fetch(path, { headers, cache: "no-store" });
}

type Props = {
  portfolioId: string | null;
  portfolioName: string;
  onClose: () => void;
};

export function BadgeCollectionModal({ portfolioId, portfolioName, onClose }: Props) {
  const [catalog, setCatalog] = useState<Achievement[]>([]);
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [catalogRes, unlockedRes] = await Promise.all([
          fetchWithAuth("/api/achievements/catalog"),
          fetchWithAuth(
            `/api/portfolio_achievements?${portfolioId ? `portfolio_id=${portfolioId}` : `portfolio_name=${encodeURIComponent(portfolioName)}`}`
          ),
        ]);

        const catalogData = await catalogRes.json();
        const unlockedData = await unlockedRes.json();

        setCatalog(catalogData.achievements ?? []);
        const keys = new Set<string>(
          (unlockedData.unlocks ?? []).map((u: { achievementKey: string }) => u.achievementKey)
        );
        setUnlockedKeys(keys);
      } catch {
        // non-fatal
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [portfolioId, portfolioName]);

  // Sort: unlocked first, then by tier
  const sorted = [...catalog].sort((a, b) => {
    const aUnlocked = unlockedKeys.has(a.key) ? 0 : 1;
    const bUnlocked = unlockedKeys.has(b.key) ? 0 : 1;
    if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked;
    return b.tier - a.tier;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-white/10 bg-[#0e0e12] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/6">
          <div>
            <h2 className="text-lg font-bold text-white">Badge Collection</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {unlockedKeys.size} / {catalog.length} earned
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-neutral-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 sm:grid-cols-5">
              {sorted.map((achievement) => {
                const unlocked = unlockedKeys.has(achievement.key);
                const tier = getTierFromNumber(achievement.tier) as AchievementTier | null;
                const tierStyle = tier ? TIER_STYLES[tier] : null;

                return (
                  <div
                    key={achievement.key}
                    className="group flex flex-col items-center gap-2"
                    title={achievement.description}
                  >
                    {/* Badge image */}
                    <div className={`relative h-16 w-16 overflow-hidden rounded-2xl border transition-all duration-300 ${
                      unlocked
                        ? `border-white/15 ${tierStyle ? tierStyle.glow : ""}`
                        : "border-white/5 opacity-30 grayscale"
                    }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={badgeImageUrl(achievement.key)}
                        alt={achievement.nickname}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Name + tier */}
                    <div className="flex flex-col items-center gap-1 text-center">
                      <p className={`text-[0.65rem] font-bold leading-tight ${unlocked ? "text-white" : "text-neutral-600"}`}>
                        {achievement.nickname}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
