import { NextResponse } from "next/server";
import type { JournalSummaryPayload } from "@/app/lib/journal-types";
import {
  type RealizedSellEvent,
  listRealizedSellEventsSince
} from "@/app/lib/repositories/portfolio-transactions-repo";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const BINANCE_BASE_URL = "https://api.binance.com";
const BTC_USDT_SYMBOL = "BTCUSDT";

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const safeNumber = (value: string | number | undefined, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function computeWinRate(events: RealizedSellEvent[]): number | null {
  if (events.length === 0) {
    return null;
  }

  const wins = events.filter((event) => event.realizedPnlUsd > 0).length;
  return round((wins / events.length) * 100, 2);
}

function sumPnl(events: RealizedSellEvent[]): number {
  return round(events.reduce((sum, event) => sum + event.realizedPnlUsd, 0), 2);
}

function sumPnlBtc(events: RealizedSellEvent[], btcPriceByDay: Map<string, number>): number {
  return round(
    events.reduce((sum, event) => {
      const day = dayKey(new Date(event.executedAt));
      const btcPriceUsd = btcPriceByDay.get(day);

      if (!btcPriceUsd || btcPriceUsd <= 0) {
        return sum;
      }

      return sum + event.realizedPnlUsd / btcPriceUsd;
    }, 0),
    8
  );
}

function dayKey(date: Date): string {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
}

async function fetchBtcPriceByDay(from: Date, to: Date): Promise<Map<string, number>> {
  const maxDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS) + 2);
  const limit = Math.min(1000, maxDays);

  try {
    const response = await fetch(
      `${BINANCE_BASE_URL}/api/v3/klines?symbol=${BTC_USDT_SYMBOL}&interval=1d&limit=${limit}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return new Map();
    }

    const rows = (await response.json()) as Array<[
      number,
      string,
      string,
      string,
      string,
      string,
      number,
      string,
      number,
      string,
      string,
      string
    ]>;

    const map = new Map<string, number>();
    for (const row of rows) {
      const openTime = row[0];
      const closePrice = safeNumber(row[4], 0);
      if (closePrice <= 0) {
        continue;
      }

      map.set(dayKey(new Date(openTime)), closePrice);
    }

    return map;
  } catch {
    return new Map();
  }
}

function buildDailyPerformance(
  events: RealizedSellEvent[],
  btcPriceByDay: Map<string, number>
): JournalSummaryPayload["dailyPerformance"] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const points: JournalSummaryPayload["dailyPerformance"] = [];
  const map = new Map<string, number>();

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today.getTime() - i * DAY_MS);
    const key = dayKey(date);
    map.set(key, 0);
    points.push({ date: key, pnlUsd: 0, pnlBtc: 0 });
  }

  for (const event of events) {
    const parsed = new Date(event.executedAt);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    const key = dayKey(parsed);
    if (!map.has(key)) {
      continue;
    }

    map.set(key, round((map.get(key) ?? 0) + event.realizedPnlUsd, 2));
  }

  return points.map((point) => {
    const pnlUsd = map.get(point.date) ?? 0;
    const btcPriceUsd = btcPriceByDay.get(point.date);

    return {
      date: point.date,
      pnlUsd,
      pnlBtc: btcPriceUsd && btcPriceUsd > 0 ? round(pnlUsd / btcPriceUsd, 8) : 0
    };
  });
}

function buildDistribution(events: RealizedSellEvent[]): JournalSummaryPayload["distribution"] {
  if (events.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const event of events) {
    const label = event.pair.trim() || "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const total = events.length;

  if (sorted.length <= 3) {
    return sorted.map(([label, count]) => ({
      label,
      count,
      percent: round((count / total) * 100, 2)
    }));
  }

  const topTwo = sorted.slice(0, 2);
  const othersCount = sorted.slice(2).reduce((sum, [, count]) => sum + count, 0);

  return [
    ...topTwo.map(([label, count]) => ({
      label,
      count,
      percent: round((count / total) * 100, 2)
    })),
    {
      label: "Others",
      count: othersCount,
      percent: round((othersCount / total) * 100, 2)
    }
  ];
}

function filterByWindow<T extends { executedAt: string }>(
  rows: T[],
  fromMs: number,
  toMs: number,
  inclusiveTo = true
): T[] {
  return rows.filter((row) => {
    const executed = new Date(row.executedAt).getTime();
    if (!Number.isFinite(executed)) {
      return false;
    }

    if (inclusiveTo) {
      return executed >= fromMs && executed <= toMs;
    }

    return executed >= fromMs && executed < toMs;
  });
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get("days") ?? 30);
  const days = Number.isFinite(daysParam) ? Math.min(180, Math.max(7, Math.trunc(daysParam))) : 30;

  const now = new Date();
  const nowMs = now.getTime();
  const currentStart = new Date(nowMs - days * DAY_MS);
  const previousStart = new Date(nowMs - days * 2 * DAY_MS);

  const btcPriceByDay = await fetchBtcPriceByDay(previousStart, now);

  const events = await listRealizedSellEventsSince(supabase, user.id, previousStart.toISOString(), 1500);
  if (!events) {
    return NextResponse.json({ error: "Unable to load journal data." }, { status: 500 });
  }

  const currentEvents = filterByWindow(events, currentStart.getTime(), nowMs, true);
  const previousEvents = filterByWindow(events, previousStart.getTime(), currentStart.getTime(), false);

  const netPnlUsd = sumPnl(currentEvents);
  const netPnlBtc = sumPnlBtc(currentEvents, btcPriceByDay);
  const previousNetPnlUsd = sumPnl(previousEvents);
  const netPnlChangePercent =
    previousNetPnlUsd !== 0
      ? round(((netPnlUsd - previousNetPnlUsd) / Math.abs(previousNetPnlUsd)) * 100, 2)
      : null;

  const payload: JournalSummaryPayload = {
    kpis: {
      winRate: computeWinRate(currentEvents),
      netPnlUsd,
      netPnlBtc,
      netPnlChangePercent,
      averageRiskReward: null
    },
    dailyPerformance: buildDailyPerformance(currentEvents, btcPriceByDay),
    trades: currentEvents
      .slice()
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, 20)
      .map((event) => {
        const day = dayKey(new Date(event.executedAt));
        const btcPriceUsd = btcPriceByDay.get(day);

        return {
          id: event.id,
          executedAt: event.executedAt,
          portfolioName: event.portfolioName,
          pair: event.pair,
          side: "sell",
          entryPriceUsd: event.avgBuyPriceUsd,
          exitPriceUsd: event.sellPriceUsd,
          pnlUsd: event.realizedPnlUsd,
          entryPriceBtc: btcPriceUsd && btcPriceUsd > 0 ? round(event.avgBuyPriceUsd / btcPriceUsd, 8) : null,
          exitPriceBtc: btcPriceUsd && btcPriceUsd > 0 ? round(event.sellPriceUsd / btcPriceUsd, 8) : null,
          pnlBtc: btcPriceUsd && btcPriceUsd > 0 ? round(event.realizedPnlUsd / btcPriceUsd, 8) : null,
          notes: event.note
        };
      }),
    distribution: buildDistribution(currentEvents),
    emotions: [],
    totalTrades: currentEvents.length,
    range: {
      from: currentStart.toISOString(),
      to: now.toISOString(),
      days
    }
  };

  return NextResponse.json(payload);
}
