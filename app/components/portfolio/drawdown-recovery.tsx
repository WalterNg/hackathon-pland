import type { MaxDrawdownDetail } from "@/app/lib/portfolio-types";
import { MaterialIcon } from "../dashboard/material-icon";

type DrawdownRecoveryProps = {
  detail: MaxDrawdownDetail;
};

export function DrawdownRecovery({ detail }: DrawdownRecoveryProps) {
  if (detail.recovered) {
    return (
      <span className="flex items-center gap-0.5 text-success">
        <MaterialIcon name="check_circle" outlined={false} className="text-xs" />
        Recovered in {detail.recoveryDays}d
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-warning">
      <MaterialIcon name="schedule" outlined className="text-xs" />
      Not recovered
    </span>
  );
}
