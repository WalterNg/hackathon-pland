import { MaterialIcon } from "../dashboard/material-icon";

export function PortfolioAssetsTable() {
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-gray-100 bg-card-light shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 p-6">
        <h3 className="text-lg font-bold text-strong">Assets</h3>
        <button className="rounded-full bg-gray-100 p-2 transition-colors hover:bg-gray-200">
          <MaterialIcon name="expand_less" outlined={false} className="block text-sm text-muted" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4 text-right">Price</th>
              <th className="px-6 py-4 text-right">1h%</th>
              <th className="px-6 py-4 text-right">24h%</th>
              <th className="px-6 py-4 text-right">7d%</th>
              <th className="px-6 py-4 text-right">Holdings</th>
              <th className="px-6 py-4 text-right">Avg. Buy Price</th>
              <th className="px-6 py-4 text-right">Profit/Loss</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            <tr className="group transition-colors hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                    <MaterialIcon name="currency_bitcoin" outlined={false} className="text-sm" />
                  </div>
                  <div>
                    <div className="font-bold text-strong">Bitcoin</div>
                    <div className="text-xs text-muted">BTC</div>
                  </div>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">100</span>
                </div>
              </td>

              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-body">1.0000 BTC</td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-primary">
                <span className="flex items-center justify-end gap-1">
                  <MaterialIcon name="arrow_drop_up" outlined={false} className="text-[10px]" />
                  0.00%
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-primary">
                <span className="flex items-center justify-end gap-1">
                  <MaterialIcon name="arrow_drop_up" outlined={false} className="text-[10px]" />
                  +0.00%
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-primary">
                <span className="flex items-center justify-end gap-1">
                  <MaterialIcon name="arrow_drop_up" outlined={false} className="text-[10px]" />
                  0.00%
                </span>
              </td>

              <td className="whitespace-nowrap px-6 py-4 text-right">
                <div className="text-sm font-bold text-strong">57.00 BTC</div>
                <div className="text-xs text-muted">57 BTC</div>
              </td>

              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-body">2.1579 BTC</td>
              <td className="whitespace-nowrap px-6 py-4 text-right">
                <div className="text-sm font-bold text-red-500">-66.00 BTC</div>
                <div className="flex items-center justify-end gap-1 text-xs text-red-500">
                  <MaterialIcon name="arrow_drop_down" outlined={false} className="text-[10px]" />
                  53.66%
                </div>
              </td>

              <td className="whitespace-nowrap px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button className="text-subtle transition-colors hover:text-primary">
                    <MaterialIcon name="add_circle_outline" outlined={false} className="text-lg" />
                  </button>
                  <button className="text-subtle transition-colors hover:text-body">
                    <MaterialIcon name="more_horiz" outlined={false} className="text-lg" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
