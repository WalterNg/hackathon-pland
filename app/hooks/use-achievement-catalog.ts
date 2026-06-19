"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { AchievementTier } from "@/app/lib/achievement-tier";
import { getTierFromNumber } from "@/app/lib/achievement-tier";

type AchievementCatalogEntry = {
  key: string;
  tier: number;
  nickname: string;
};

type CatalogMaps = {
  tierMap: Map<string, AchievementTier>;
  nicknameMap: Map<string, string>;
};

async function fetchBackendWithAuth(path: string) {
  const supabase = await createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  return fetch(path, { headers, cache: "no-store" });
}

export function useAchievementCatalog(): CatalogMaps {
  const [maps, setMaps] = useState<CatalogMaps>({
    tierMap: new Map(),
    nicknameMap: new Map(),
  });

  useEffect(() => {
    fetchBackendWithAuth("/api/achievements/catalog")
      .then((r) => r.json())
      .then((data: { achievements?: AchievementCatalogEntry[] }) => {
        const tierMap = new Map<string, AchievementTier>();
        const nicknameMap = new Map<string, string>();
        for (const a of data.achievements ?? []) {
          const tier = getTierFromNumber(a.tier);
          if (tier) tierMap.set(a.key, tier);
          if (a.nickname) nicknameMap.set(a.key, a.nickname);
        }
        setMaps({ tierMap, nicknameMap });
      })
      .catch((err) => { console.warn("[useAchievementCatalog] failed:", err); });
  }, []);

  return maps;
}
