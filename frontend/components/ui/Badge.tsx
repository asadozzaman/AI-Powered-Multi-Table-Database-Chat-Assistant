import { ReactNode } from "react";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({
  variant = "neutral",
  icon,
  children,
}: {
  variant?: BadgeVariant;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={`badge ${variant}`}>
      {icon ?? <span className="badge-dot" />}
      {children}
    </span>
  );
}
