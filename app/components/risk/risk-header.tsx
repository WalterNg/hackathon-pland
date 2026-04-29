import { AppTopNavigation } from "../ui/app-top-navigation";

type RiskHeaderProps = {
  portfolioHref: string;
  aiHistoryHref?: string | null;
  riskHref: string;
};

export function RiskHeader({ portfolioHref, aiHistoryHref, riskHref }: RiskHeaderProps) {
  return (
    <header className="page-header shrink-0 px-4 sm:px-6 lg:px-8">
      <div className="w-full">
        <AppTopNavigation portfolioHref={portfolioHref} aiHistoryHref={aiHistoryHref} riskHref={riskHref} />
      </div>
    </header>
  );
}
