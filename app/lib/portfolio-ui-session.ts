export type PortfolioUiSessionRecord = {
  sessionId: string;
  userId: string;
  portfolioKey: string;
  startedAt: string;
  lastSeenAt: string;
};

const STORAGE_PREFIX = "portfolio-ui-session:v1";

function createRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ui-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function normalizePortfolioUiSessionPortfolioKey(portfolioId: string | null): string | null {
  const normalizedPortfolioId = portfolioId?.trim();
  if (normalizedPortfolioId) {
    return `portfolio_id:${normalizedPortfolioId}`;
  }

  return null;
}

export function getPortfolioUiSessionStorageKey(portfolioKey: string): string {
  return `${STORAGE_PREFIX}:${portfolioKey}`;
}

export function readPortfolioUiSessionRecord(portfolioKey: string): PortfolioUiSessionRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getPortfolioUiSessionStorageKey(portfolioKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PortfolioUiSessionRecord>;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.portfolioKey !== "string" ||
      typeof parsed.startedAt !== "string" ||
      typeof parsed.lastSeenAt !== "string"
    ) {
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      userId: parsed.userId,
      portfolioKey: parsed.portfolioKey,
      startedAt: parsed.startedAt,
      lastSeenAt: parsed.lastSeenAt,
    };
  } catch {
    return null;
  }
}

export function writePortfolioUiSessionRecord(record: PortfolioUiSessionRecord): PortfolioUiSessionRecord {
  if (typeof window === "undefined") {
    return record;
  }

  window.sessionStorage.setItem(
    getPortfolioUiSessionStorageKey(record.portfolioKey),
    JSON.stringify(record)
  );

  return record;
}

export function createPortfolioUiSessionRecord(userId: string, portfolioKey: string): PortfolioUiSessionRecord {
  const nowIso = new Date().toISOString();
  return {
    sessionId: createRandomId(),
    userId,
    portfolioKey,
    startedAt: nowIso,
    lastSeenAt: nowIso,
  };
}

export function touchPortfolioUiSessionRecord(record: PortfolioUiSessionRecord): PortfolioUiSessionRecord {
  const nextRecord = {
    ...record,
    lastSeenAt: new Date().toISOString(),
  };

  return writePortfolioUiSessionRecord(nextRecord);
}

export function deletePortfolioUiSessionRecord(portfolioKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getPortfolioUiSessionStorageKey(portfolioKey));
}

export function clearAllPortfolioUiSessionRecords(): void {
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
