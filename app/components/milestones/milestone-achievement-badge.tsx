import type { PortfolioSnapshotCertificate } from "@/app/lib/portfolio-certificate-types";

type Props = {
  cert: PortfolioSnapshotCertificate;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

function formatDate(ts: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

export function MilestoneAchievementBadge({ cert, isSelected, onSelect }: Props) {
  const isFailed = cert.anchorStatus === "failed";
  const showStatus = cert.anchorStatus !== "anchored";

  const statusLabel = cert.anchorStatus === "failed" ? "Failed" : "Pending";

  const statusColor =
    cert.anchorStatus === "pending_anchor" ? "text-amber-400" : "text-neutral-500";

  const dotColor = cert.anchorStatus === "pending_anchor" ? "bg-amber-400" : "bg-neutral-600";

  const selectedRing = isSelected
    ? cert.anchorStatus === "anchored"
      ? "ring-2 ring-violet-500/60 bg-violet-500/5"
      : "ring-2 ring-white/20"
    : "ring-1 ring-white/6 hover:ring-white/12 bg-white/2 hover:bg-white/4";

  return (
    <button
      type="button"
      onClick={() => onSelect(cert.id)}
      className={`group w-full rounded-2xl p-3.5 text-left transition-all duration-200 cursor-pointer ${selectedRing} ${isFailed ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-3">
        {/* Achievement icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cert.anchorStatus === "anchored" ? "from-violet-600 to-indigo-700" : cert.anchorStatus === "pending_anchor" ? "from-amber-500 to-orange-600" : "from-neutral-600 to-neutral-800"} ${isSelected ? "shadow-[0_0_20px_0_rgba(124,58,237,0.35)]" : ""} transition-shadow duration-200`}
        >
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                cert.anchorStatus === "anchored"
                  ? "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.2-.592-4.258-1.625-6.022"
                  : cert.anchorStatus === "pending_anchor"
                  ? "M12 8.25v4.5l3 3M12 3a9 9 0 100 18 9 9 0 000-18z"
                  : "M12 9v3.75m0 3.75h.008v.008H12v-.008zM12 3a9 9 0 100 18 9 9 0 000-18z"
              }
            />
          </svg>
        </div>

        {/* Title + subtitle */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white leading-tight">{cert.title || "Certified Snapshot"}</p>
          <p className="mt-0.5 truncate text-[0.68rem] text-neutral-500 leading-tight">{formatDate(cert.snapshotAt)}</p>
        </div>

        {/* Status */}
        {showStatus && (
          <div className={`flex shrink-0 items-center gap-1.5 text-[0.65rem] font-semibold ${statusColor}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
            {statusLabel}
          </div>
        )}
      </div>
    </button>
  );
}
