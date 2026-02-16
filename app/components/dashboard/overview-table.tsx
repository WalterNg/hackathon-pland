import { MaterialIcon } from "./material-icon";

export function OverviewTable() {
  return (
    <div className="rounded-2xl bg-mint-card p-6 shadow-soft">
      <h3 className="typo-section text-strong mb-4">Overview</h3>
      <div className="overflow-x-auto">
        <table className="typo-body-sm w-full text-left">
          <thead className="text-muted typo-body-xs border-b border-gray-200/50 uppercase">
            <tr>
              <th className="text-subtle py-3 font-medium">Market Value</th>
              <th className="text-subtle py-3 font-medium">Net Cost</th>
              <th className="text-subtle py-3 font-medium">Holdings</th>
              <th className="text-subtle py-3 font-medium">Profit/Loss</th>
              <th className="text-subtle py-3 text-right font-medium">Change (24H)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-strong py-4 text-base font-bold">
                $16,352.12
                <div className="text-muted typo-caption mt-1 font-normal">39% of crypto market</div>
              </td>
              <td className="text-body py-4 font-medium">
                $17,547.36
                <div className="text-positive typo-caption mt-1 font-bold">+1.89%</div>
              </td>
              <td className="text-body py-4 font-medium">
                8.24668 BTC
                <div className="text-muted typo-caption mt-1 font-normal">8% of asset allocation</div>
              </td>
              <td className="text-body py-4 font-medium">
                +$426.57
                <div className="text-positive typo-caption mt-1 font-bold">+1.89% profit</div>
              </td>
              <td className="py-4 text-right">
                <span className="text-success typo-body-xs inline-flex items-center gap-1 rounded bg-mint-light px-2 py-1 font-bold">
                  <MaterialIcon name="arrow_drop_up" className="text-[10px]" />
                  9.37%
                </span>
                <div className="text-muted typo-caption mt-1">Last 24 hours</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
