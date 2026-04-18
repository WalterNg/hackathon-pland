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
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[0.72rem] font-semibold text-primary transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/18 hover:shadow-success-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      <MaterialIcon
        name={isLoading ? "hourglass_top" : "verified"}
        outlined={false}
        className="text-[0.9rem]"
      />
      {isLoading ? "Certifying..." : "Certify Snapshot"}
    </button>
  );
}
