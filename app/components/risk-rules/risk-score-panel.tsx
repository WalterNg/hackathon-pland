"use client";

import { useMemo, useState } from "react";
import type { RiskEventRecord } from "@/app/lib/risk-types";

// ─── Event metadata ───────────────────────────────────────────────────────────

type EventMeta = {
  badge: string;
  direction: "bearish" | "bullish" | "neutral";
  action: string;
  icon: string;
};

const EVENT_META: Record<string, EventMeta> = {
  drawdown_limit_breached: {
    badge: "Max Drawdown",
    direction: "bearish",
    action: "Reduce Exposure",
    icon: "trending_down",
  },
  position_size_limit_breached: {
    badge: "Concentration",
    direction: "bearish",
    action: "Rebalance",
    icon: "pie_chart",
  },
  daily_loss_limit_breached: {
    badge: "Daily Loss",
    direction: "bearish",
    action: "Pause Trading",
    icon: "remove_circle_outline",
  },
};

function getEventMeta(eventType: string): EventMeta {
  return (
    EVENT_META[eventType] ?? {
      badge: eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      direction: "neutral",
      action: "Review",
      icon: "info",
    }
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: RiskEventRecord }) {
  const meta = getEventMeta(event.eventType);
  const details = event.details as Record<string, unknown>;
  const description = (details?.message as string) || meta.badge;
  const symbol = details?.symbol as string | undefined;

  const isBearish = meta.direction === "bearish";
  const accentColor = isBearish ? "text-red-400" : meta.direction === "bullish" ? "text-green-400" : "text-yellow-400";
  const accentBg = isBearish ? "bg-red-500/10" : meta.direction === "bullish" ? "bg-green-500/10" : "bg-yellow-500/10";
  const borderAccent = isBearish ? "border-red-500/20" : meta.direction === "bullish" ? "border-green-500/20" : "border-yellow-500/20";

  return (
    <div className={`group flex items-center gap-4 rounded-xl border ${borderAccent} bg-surface-low/60 px-4 py-3.5 transition-colors hover:bg-surface-low`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentBg}`}>
        <span className={`material-icons-outlined text-[18px] ${accentColor}`}>{meta.icon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          {symbol && (
            <span className="text-sm font-bold text-strong">
              {symbol.replace("USDT", "")}
            </span>
          )}
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${accentBg} ${accentColor}`}>
            {meta.badge}
          </span>
          <span className="text-[11px] text-muted/60 ml-auto">{timeAgo(event.occurredAt)}</span>
        </div>
        <p className="text-xs text-muted leading-relaxed line-clamp-1">{description}</p>
      </div>

      <button
        type="button"
        className="hidden md:flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[11px] font-semibold text-muted transition-all hover:border-border hover:text-strong"
      >
        <span className="material-icons-outlined text-[14px]">
          {meta.direction === "bullish" ? "trending_up" : "shield"}
        </span>
        {meta.action}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Filter = "all" | "bearish" | "bullish";

type Props = {
  events: RiskEventRecord[];
  isLoading: boolean;
  error: string | null;
  onConfigureRules: () => void;
  activeViolationCount: number;
};

export function RiskScorePanel({
  events,
  isLoading,
  error,
  onConfigureRules,
  activeViolationCount,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => ({
    all: events.length,
    bearish: events.filter((e) => getEventMeta(e.eventType).direction === "bearish").length,
    bullish: events.filter((e) => getEventMeta(e.eventType).direction === "bullish").length,
  }), [events]);

  const filtered = useMemo(
    () => filter === "all" ? events : events.filter((e) => getEventMeta(e.eventType).direction === filter),
    [events, filter]
  );

  return (
    <div className="panel rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-strong">Risk Events</p>
          <p className="text-xs text-muted mt-0.5">Live feed of rule breaches</p>
        </div>
        <button
          type="button"
          onClick={onConfigureRules}
          className="relative flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-all"
        >
          <span className="material-icons-outlined text-[18px]">tune</span>
          Configure Rules
          {activeViolationCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
              {activeViolationCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-xl bg-surface-low p-1">
          {(["all", "bearish", "bullish"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                filter === f
                  ? "bg-surface shadow-sm text-strong"
                  : "text-muted hover:text-body"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {" "}
              <span className={filter === f ? "opacity-80" : "opacity-50"}>({counts[f]})</span>
            </button>
          ))}
        </div>
        <span className="text-xs text-muted/60">Live events</span>
      </div>

      {/* List */}
      {error ? (
        <div className="flex items-center gap-2 rounded-xl bg-danger/5 border border-danger/20 p-4">
          <span className="material-icons-outlined text-danger text-sm">error</span>
          <p className="text-xs text-danger">{error}</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[58px] animate-pulse rounded-xl bg-surface-low" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <span className="material-icons-outlined text-success text-2xl">verified_user</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-strong">All clear</p>
            <p className="text-xs text-muted mt-0.5">
              {filter === "all"
                ? "No risk events recorded yet. Configure rules to start monitoring."
                : `No ${filter} signals detected.`}
            </p>
          </div>
          {filter === "all" && (
            <button
              type="button"
              onClick={onConfigureRules}
              className="mt-1 text-xs font-semibold text-primary hover:underline"
            >
              Set up risk rules →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
