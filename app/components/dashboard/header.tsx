import { AppTopNavigation } from "../ui/app-top-navigation";

export function Header() {
  return (
    <header className="page-header z-10 shrink-0 bg-transparent px-4 sm:px-6 lg:px-8">
      <div className="w-full">
        <AppTopNavigation />
      </div>
    </header>
  );
}
