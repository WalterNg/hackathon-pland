"use client";

import type { PortfolioAIRecommendation } from "@/app/lib/portfolio-types";

export type PortfolioAIRecommendationCacheRecord = {
  recommendation: PortfolioAIRecommendation;
  cachedAt: string;
};

type PortfolioAIRecommendationCacheKeyParts = {
  userId: string;
  portfolioId: string;
  portfolioUiSessionId: string;
};

const STORAGE_PREFIX = "portfolio-ai-recommendation-cache:v1";
const memoryCache = new Map<string, PortfolioAIRecommendationCacheRecord>();

function normalizePart(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getPortfolioAIRecommendationCacheKey(
  parts: PortfolioAIRecommendationCacheKeyParts
): string | null {
  const userId = normalizePart(parts.userId);
  const portfolioId = normalizePart(parts.portfolioId);
  const portfolioUiSessionId = normalizePart(parts.portfolioUiSessionId);

  if (!userId || !portfolioId || !portfolioUiSessionId) {
    return null;
  }

  return `${STORAGE_PREFIX}:user:${userId}:portfolio:${portfolioId}:session:${portfolioUiSessionId}`;
}

function readFromSessionStorage(cacheKey: string): PortfolioAIRecommendationCacheRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PortfolioAIRecommendationCacheRecord>;
    if (!parsed || typeof parsed.cachedAt !== "string" || !parsed.recommendation) {
      return null;
    }

    return {
      recommendation: parsed.recommendation as PortfolioAIRecommendation,
      cachedAt: parsed.cachedAt,
    };
  } catch {
    return null;
  }
}

function writeToSessionStorage(cacheKey: string, record: PortfolioAIRecommendationCacheRecord): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(cacheKey, JSON.stringify(record));
}

export function readPortfolioAIRecommendationCache(
  parts: PortfolioAIRecommendationCacheKeyParts
): PortfolioAIRecommendationCacheRecord | null {
  const cacheKey = getPortfolioAIRecommendationCacheKey(parts);
  if (!cacheKey) {
    return null;
  }

  const memoryRecord = memoryCache.get(cacheKey);
  if (memoryRecord) {
    return memoryRecord;
  }

  const storageRecord = readFromSessionStorage(cacheKey);
  if (storageRecord) {
    memoryCache.set(cacheKey, storageRecord);
  }

  return storageRecord;
}

export function writePortfolioAIRecommendationCache(
  parts: PortfolioAIRecommendationCacheKeyParts,
  recommendation: PortfolioAIRecommendation
): PortfolioAIRecommendationCacheRecord | null {
  const cacheKey = getPortfolioAIRecommendationCacheKey(parts);
  if (!cacheKey) {
    return null;
  }

  const nextRecord: PortfolioAIRecommendationCacheRecord = {
    recommendation,
    cachedAt: new Date().toISOString(),
  };

  memoryCache.set(cacheKey, nextRecord);
  writeToSessionStorage(cacheKey, nextRecord);
  return nextRecord;
}

export function clearPortfolioAIRecommendationCache(
  parts: PortfolioAIRecommendationCacheKeyParts
): void {
  const cacheKey = getPortfolioAIRecommendationCacheKey(parts);
  if (!cacheKey) {
    return;
  }

  memoryCache.delete(cacheKey);

  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(cacheKey);
}

export function clearAllPortfolioAIRecommendationCache(): void {
  memoryCache.clear();

  if (typeof window === "undefined") {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(`${STORAGE_PREFIX}:`)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.sessionStorage.removeItem(key);
  }
}
