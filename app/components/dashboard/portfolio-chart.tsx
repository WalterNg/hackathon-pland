import type { PortfolioChartPoint } from "@/app/lib/portfolio-types";

type PortfolioChartProps = {
  chart: PortfolioChartPoint[];
};

function chartToSvgPath(points: PortfolioChartPoint[]): string {
  if (points.length === 0) {
    return "M40 220 L580 220";
  }

  const values = points.map((point) => point.totalValueUsd);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = Math.max(maxValue - minValue, 1);

  return points
    .map((point, index) => {
      const x = 40 + (index / Math.max(points.length - 1, 1)) * 540;
      const normalized = (point.totalValueUsd - minValue) / spread;
      const y = 220 - normalized * 130;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function PortfolioChart({ chart }: PortfolioChartProps) {
  const linePath = chartToSvgPath(chart);

  return (
    <svg viewBox="0 0 700 260" className="h-full w-full" role="img" aria-label="Portfolio chart">
      <defs>
        <linearGradient id="portfolio-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mint-light)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-card-light)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={`${linePath} L580 220 L40 220 Z`} fill="url(#portfolio-gradient)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
