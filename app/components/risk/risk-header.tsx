import { AppTopNavigation } from "../ui/app-top-navigation";

type RiskHeaderProps = {
  portfolioHref: string;
  riskHref: string;
};

export function RiskHeader({ portfolioHref, riskHref }: RiskHeaderProps) {
  return (
    <header className="page-header shrink-0 px-4 sm:px-6 lg:px-8">
      <div className="w-full">
        <AppTopNavigation portfolioHref={portfolioHref} riskHref={riskHref} />
      </div>
    </header>
  );
}