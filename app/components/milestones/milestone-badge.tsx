import type { MilestoneCertificate } from "@/app/hooks/use-all-milestone-certificates";

type MilestoneBadgeProps = {
  milestone: MilestoneCertificate;
  onOpen: (certificateId: string) => void;
};

function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function shortHash(hash: string) {
  return hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : hash;
}

type BadgeStyle = {
  wrapper: string;
  icon: string;
  iconBg: string;
  label: string;
  labelColor: string;
  statusDot: string;
  statusText: string;
};

function getBadgeStyle(
  anchorStatus: MilestoneCertificate["anchorStatus"],
  verificationStatus: MilestoneCertificate["verificationStatus"]
): BadgeStyle {
  if (verificationStatus === "verified") {
    return {
      wrapper: "border border-emerald-500/30 bg-[#042f2e] shadow-[0_0_16px_0_rgba(5,150,105,0.15)] hover:shadow-[0_0_24px_0_rgba(5,150,105,0.25)] hover:border-emerald-500/50",
      icon: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      label: "Verified",
      labelColor: "text-emerald-400",
      statusDot: "bg-emerald-400",
      statusText: "text-emerald-400",
    };
  }

  if (anchorStatus === "anchored") {
    return {
      wrapper: "border border-violet-500/30 bg-[#1e1b4b] shadow-[0_0_16px_0_rgba(124,58,237,0.15)] hover:shadow-[0_0_24px_0_rgba(124,58,237,0.25)] hover:border-violet-500/50",
      icon: "text-violet-400",
      iconBg: "bg-violet-500/10",
      label: "Anchored",
      labelColor: "text-violet-400",
      statusDot: "bg-violet-400",
      statusText: "text-violet-400",
    };
  }

  // failed or pending
  return {
    wrapper: "border border-white/6 bg-[#1a1a1a] hover:border-white/10",
    icon: "text-neutral-500",
    iconBg: "bg-white/5",
    label: anchorStatus === "failed" ? "Failed" : "Pending",
    labelColor: "text-neutral-500",
    statusDot: "bg-neutral-600",
    statusText: "text-neutral-500",
  };
}

export function MilestoneBadge({ milestone, onOpen }: MilestoneBadgeProps) {
  const style = getBadgeStyle(milestone.anchorStatus, milestone.verificationStatus);
  const isFaded = milestone.anchorStatus === "failed";

  return (
    <button
      type="button"
      onClick={() => onOpen(milestone.id)}
      className={`group w-full rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer ${style.wrapper} ${isFaded ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
          {milestone.anchorStatus === "anchored" || milestone.verificationStatus === "verified" ? (
            <svg className={`h-5 w-5 ${style.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.2-.592-4.258-1.625-6.022" />
            </svg>
          ) : (
            <svg className={`h-5 w-5 ${style.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">{milestone.portfolioName}</p>
            <span className={`flex items-center gap-1.5 shrink-0 text-[0.68rem] font-semibold ${style.labelColor}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.statusDot}`} />
              {style.label}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-neutral-400">{formatDate(milestone.snapshotAt)}</p>

          <p className="mt-2 font-mono text-[0.65rem] text-neutral-600 group-hover:text-neutral-500 transition-colors">
            {shortHash(milestone.snapshotHash)}
          </p>
        </div>
      </div>
    </button>
  );
}
