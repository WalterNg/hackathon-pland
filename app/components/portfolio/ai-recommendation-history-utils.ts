import type { PortfolioAIRecommendationHistoryItem } from "@/app/lib/portfolio-types";

export function formatDateLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function shortSessionId(sessionId: string | null): string {
  if (!sessionId) {
    return "No session";
  }

  return sessionId.length > 18 ? `${sessionId.slice(0, 8)}...${sessionId.slice(-6)}` : sessionId;
}

export function confidenceTone(action: string): string {
  if (action === "Accumulate") {
    return "text-success-soft";
  }

  if (action === "Reduce Risk" || action === "Stop Loss") {
    return "text-rose-300";
  }

  if (action === "Rebalance") {
    return "text-amber-300";
  }

  return "text-strong";
}

export function groupByDate(items: PortfolioAIRecommendationHistoryItem[]) {
  return items.reduce<Array<{ dateLabel: string; items: PortfolioAIRecommendationHistoryItem[] }>>(
    (groups, item) => {
      const dateLabel = formatDateLabel(item.recommendation.analyzedAt);
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.dateLabel === dateLabel) {
        lastGroup.items.push(item);
        return groups;
      }

      groups.push({
        dateLabel,
        items: [item],
      });

      return groups;
    },
    []
  );
}
