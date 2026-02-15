import { MaterialIcon } from "./material-icon";

export function OverviewTable() {
  return (
    <div className="rounded-2xl bg-mint-card p-6 shadow-soft dark:bg-gray-800">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">Overview</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200/50 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <tr>
              <th className="py-3 font-medium text-gray-400">Market Value</th>
              <th className="py-3 font-medium text-gray-400">Net Cost</th>
              <th className="py-3 font-medium text-gray-400">Holdings</th>
              <th className="py-3 font-medium text-gray-400">Profit/Loss</th>
              <th className="py-3 text-right font-medium text-gray-400">Change (24H)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-4 text-base font-bold text-gray-900 dark:text-white">
                $16,352.12
                <div className="mt-1 text-[10px] font-normal text-gray-500">39% of crypto market</div>
              </td>
              <td className="py-4 font-medium text-gray-700 dark:text-gray-300">
                $17,547.36
                <div className="mt-1 text-[10px] font-bold text-green-600">+1.89%</div>
              </td>
              <td className="py-4 font-medium text-gray-700 dark:text-gray-300">
                8.24668 BTC
                <div className="mt-1 text-[10px] font-normal text-gray-500">8% of asset allocation</div>
              </td>
              <td className="py-4 font-medium text-gray-700 dark:text-gray-300">
                +$426.57
                <div className="mt-1 text-[10px] font-bold text-green-600">+1.89% profit</div>
              </td>
              <td className="py-4 text-right">
                <span className="inline-flex items-center gap-1 rounded bg-mint-light px-2 py-1 text-xs font-bold text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <MaterialIcon name="arrow_drop_up" className="text-[10px]" />
                  9.37%
                </span>
                <div className="mt-1 text-[10px] text-gray-500">Last 24 hours</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
