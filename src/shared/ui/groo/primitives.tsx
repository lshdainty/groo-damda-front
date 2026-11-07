import * as LucideIcons from "lucide-react";

type LucideIconName = keyof typeof LucideIcons;

const iconNameToPascal = (name: string): string =>
  name
    .split("-")
    .map((s) => (s[0] ?? "").toUpperCase() + s.slice(1))
    .join("");

export function Icon({
  name,
  size = 16,
  strokeWidth = 2,
  className = "",
  style = {},
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const pascal = iconNameToPascal(name) as LucideIconName;
  const Comp = LucideIcons[pascal] as
    | React.ComponentType<{
        size?: number;
        strokeWidth?: number;
        className?: string;
        style?: React.CSSProperties;
      }>
    | undefined;
  if (!Comp) {
    return (
      <span
        className={className}
        style={{ width: size, height: size, display: "inline-block", ...style }}
      />
    );
  }
  return (
    <Comp
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={{ flexShrink: 0, ...style }}
    />
  );
}
