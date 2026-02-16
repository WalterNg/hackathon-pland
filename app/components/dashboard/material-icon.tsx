type MaterialIconProps = {
  name: string;
  outlined?: boolean;
  className?: string;
};

export function MaterialIcon({ name, outlined = true, className = "" }: MaterialIconProps) {
  return <span className={`${outlined ? "material-icons-outlined" : "material-icons"} ${className}`}>{name}</span>;
}
