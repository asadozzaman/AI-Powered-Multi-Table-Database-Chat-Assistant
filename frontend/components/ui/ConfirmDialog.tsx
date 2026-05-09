"use client";

import { ReactNode, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onCancel,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-header">
          <span className={`dialog-icon ${destructive ? "danger" : "info"}`}>
            <AlertTriangle size={20} />
          </span>
          <button className="alert-close" onClick={onCancel} type="button" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <h2 style={{ marginTop: 8 }}>{title}</h2>
        {description && <p style={{ marginTop: 6, fontSize: 13.5 }}>{description}</p>}
        <div className="dialog-actions">
          <button className="button secondary" onClick={onCancel} type="button" disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={destructive ? "button danger" : "button"}
            onClick={onConfirm}
            type="button"
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
      <style jsx>{`
        .dialog-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(2px);
          display: grid;
          place-items: center;
          z-index: 70;
          padding: 20px;
          animation: fade 160ms ease-out;
        }
        .dialog {
          width: 100%;
          max-width: 420px;
          background: #fff;
          border-radius: 16px;
          padding: 22px 24px;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
          animation: pop 160ms ease-out;
        }
        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .dialog-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .dialog-icon.danger {
          background: var(--danger-soft);
          color: var(--danger);
        }
        .dialog-icon.info {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .dialog-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        @keyframes fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes pop {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
