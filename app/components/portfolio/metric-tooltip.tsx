import type { ReactNode } from "react";
import { MaterialIcon } from "../dashboard/material-icon";

type MetricTooltipProps = {
  text: ReactNode;
  position?: "left" | "center" | "right";
  widthClass?: string;
};

export function MetricTooltip({ text, position = "center", widthClass = "w-56" }: MetricTooltipProps) {
  const alignClass =
    position === "left"
      ? "left-0 translate-x-0"
      : position === "right"
        ? "right-0 left-auto translate-x-0"
        : "left-1/2 -translate-x-1/2";

  const arrowAlignClass =
    position === "left"
      ? "left-4 translate-x-0"
      : position === "right"
        ? "right-4 left-auto translate-x-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className="group/tooltip relative inline-flex items-center ml-1">
      <MaterialIcon
        name="info"
        outlined
        className="text-[14px] text-muted opacity-[0.35] hover:opacity-75 transition-opacity cursor-help"
      />
      <div
        className={`pointer-events-none group-hover/tooltip:pointer-events-auto absolute bottom-full z-50 mb-2 rounded-lg border border-white/10 bg-(--surface-bright) p-3 text-[11px] font-normal leading-normal text-muted opacity-0 shadow-xl transition-all duration-200 group-hover/tooltip:opacity-100 after:absolute after:top-full after:left-0 after:right-0 after:h-2.5 after:content-[''] ${widthClass} ${alignClass}`}
      >
        {text}
        <div
          className={`absolute top-full h-1.5 w-1.5 -translate-y-0.75 rotate-45 border-b border-r border-white/10 bg-(--surface-bright) ${arrowAlignClass}`}
        />
      </div>
    </div>
  );
}
