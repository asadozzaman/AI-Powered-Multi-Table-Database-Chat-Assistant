"use client";

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { ReactNode } from "react";

type AlertVariant = "info" | "success" | "warning" | "error";

const ICONS: Record<AlertVariant, ReactNode> = {
  info: <Info size={18} />,
  success: <CheckCircle2 size={18} />,
  warning: <TriangleAlert size={18} />,
  error: <AlertCircle size={18} />,
};

export function Alert({
  variant = "info",
  title,
  children,
  onClose,
}: {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className={`alert ${variant}`} role={variant === "error" ? "alert" : "status"}>
      <span className="alert-icon">{ICONS[variant]}</span>
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
      {onClose && (
        <button className="alert-close" onClick={onClose} type="button" aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
