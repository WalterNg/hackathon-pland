import { MaterialIcon } from "../dashboard/material-icon";

type CertifySnapshotButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
};

export function CertifySnapshotButton({
  onClick,
  disabled = false,
  isLoading = false,
}: CertifySnapshotButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      data-tour="certify-snapshot-btn"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-(--color-primary-border) bg-transparent px-3.5 text-[0.75rem] font-semibold tracking-wide text-(--color-primary) transition-all duration-200 ease-out hover:-translate-y-px hover:border-(--color-primary-border-strong) hover:bg-(--color-primary-soft) disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      title="Anchor the current portfolio state on-chain as a checkpoint"
    >
      <MaterialIcon
        name={isLoading ? "hourglass_top" : "link"}
        outlined={false}
        className="text-[1rem]"
      />
      {isLoading ? "Anchoring..." : "Checkpoint"}
    </button>
  );
}
