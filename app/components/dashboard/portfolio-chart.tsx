export function PortfolioChart() {
  return (
    <svg viewBox="0 0 700 260" className="h-full w-full" role="img" aria-label="Portfolio chart">
      <defs>
        <linearGradient id="portfolio-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mint-light)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-card-light)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d="M40 200 L130 170 L220 178 L310 95 L400 152 L490 122 L580 145 L580 220 L40 220 Z" fill="url(#portfolio-gradient)" />
      <path
        d="M40 200 L130 170 L220 178 L310 95 L400 152 L490 122 L580 145"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="310" cy="95" r="7" fill="var(--color-card-light)" stroke="var(--color-primary)" strokeWidth="4" />
    </svg>
  );
}
