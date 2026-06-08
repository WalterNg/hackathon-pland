import type { ReactNode } from "react";
import { MetricTooltip } from "./metric-tooltip";

type MetricCardProps = {
  title?: ReactNode;
  tooltipText?: ReactNode;
  tooltipPosition?: "left" | "center" | "right";
  tooltipWidthClass?: string;
  value: ReactNode;
  children?: ReactNode;
  colSpan?: number;
  headerAlignClass?: string;
};

export function MetricCard({
  title,
  tooltipText,
  tooltipPosition = "center",
  tooltipWidthClass = "w-56",
  value,
  children,
  colSpan = 1,
  headerAlignClass,
}: MetricCardProps) {
  const colSpanClass = colSpan === 2 ? "col-span-2 lg:col-span-1" : "";
  const hasHeader = !!title || !!tooltipText;
  return (
    <article className={`panel-base px-4 py-3.5 relative ${colSpanClass}`}>
      {hasHeader && (
        <div className={`flex justify-between mb-1.5 ${headerAlignClass ?? "items-center"}`}>
          <div className="text-xs font-medium text-muted">{title}</div>
          {tooltipText && (
            <MetricTooltip text={tooltipText} position={tooltipPosition} widthClass={tooltipWidthClass} />
          )}
        </div>
      )}
      {value}
      {children}
    </article>
  );
}
