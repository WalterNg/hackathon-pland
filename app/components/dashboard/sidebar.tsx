import { MaterialIcon } from "./material-icon";

const navItems = [
  { label: "Dashboard", icon: "dashboard", active: true },
  { label: "Wallet", icon: "account_balance_wallet" },
  { label: "Prices", icon: "paid" },
  { label: "Portfolios", icon: "pie_chart" },
  { label: "Accounts", icon: "manage_accounts" },
  { label: "Cards", icon: "credit_card" }
];

export function Sidebar() {
  return (
    <aside className="sidebar-container z-20 m-0 hidden w-64 shrink-0 flex-col justify-between bg-sidebar-dark transition-all duration-300 md:flex text-white">
      <div>
        <div className="flex h-24 items-center px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-lg font-bold text-sidebar-dark">T</div>
            <span className="text-xl font-bold tracking-tight text-white">TradeLogix</span>
          </div>
        </div>
        <nav className="mt-4 space-y-4 px-6">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className={
                item.active
                  ? "flex items-center gap-4 rounded-xl bg-primary px-4 py-3 font-semibold text-gray-900 shadow-sm transition-colors"
                  : "group flex items-center gap-4 rounded-xl px-4 py-3 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              }
            >
              <MaterialIcon
                name={item.icon}
                className={item.active ? "" : "transition-colors group-hover:text-primary"}
              />
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mb-4 p-6">
        <a href="#" className="group flex items-center gap-4 rounded-xl px-4 py-3 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white">
          <MaterialIcon name="settings" className="transition-colors group-hover:text-primary" />
          Settings
        </a>
      </div>
    </aside>
  );
}
