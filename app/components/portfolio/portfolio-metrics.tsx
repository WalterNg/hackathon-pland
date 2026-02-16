import { MaterialIcon } from "../dashboard/material-icon";

const cards = [
  { title: "All-time Profit", value: "-66.00 BTC", badge: "53.66%", negative: true },
  { title: "Cost Basis", value: "123.00 BTC", badge: "Total invested", negative: false },
  { title: "Best Performer", value: "Bitcoin (BTC)", badge: "-66.00 BTC • -53.66%", negative: true, coin: true },
  { title: "Worst Performer", value: "Bitcoin (BTC)", badge: "-66.00 BTC • -53.66%", negative: true, coin: true }
];

export function PortfolioMetrics() {
  return (
    <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className="rounded-2xl border border-gray-100 bg-card-light p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-4 flex items-start justify-between">
            <h3 className="typo-body-sm font-medium text-muted">{card.title}</h3>
            {card.coin ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100">
                <span className="text-xs font-bold text-orange-500">B</span>
              </div>
            ) : (
              <MaterialIcon name="info" outlined={false} className="text-sm text-gray-300" />
            )}
          </div>

          <p className={`mb-1 text-2xl font-bold ${card.negative ? "text-red-500" : "text-strong"}`}>{card.value}</p>

          {card.negative ? (
            <div className="w-max rounded-md bg-red-50 px-2 py-1 text-xs text-red-500">
              {card.coin ? (
                <span className="font-semibold">{card.badge}</span>
              ) : (
                <span className="flex items-center">
                  <MaterialIcon name="arrow_downward" outlined={false} className="mr-1 text-xs" />
                  {card.badge}
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-subtle">{card.badge}</div>
          )}
        </article>
      ))}
    </section>
  );
}
