"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "./Alert";

type ToastVariant = "info" | "success" | "warning" | "error";

type Toast = {
  id: number;
  variant: ToastVariant;
  title?: string;
  message?: string;
};

type ToastContextValue = {
  show: (toast: Omit<Toast, "id">) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId++;
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, title) => show({ variant: "success", title: title ?? "Success", message }),
      error: (message, title) => show({ variant: "error", title: title ?? "Something went wrong", message }),
      info: (message, title) => show({ variant: "info", title, message }),
      warning: (message, title) => show({ variant: "warning", title: title ?? "Heads up", message }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <Alert key={toast.id} variant={toast.variant} title={toast.title} onClose={() => dismiss(toast.id)}>
            {toast.message}
          </Alert>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** Optional convenience hook to flash a toast based on a message variable. */
export function useToastEffect(message: string, variant: ToastVariant = "info") {
  const toast = useToast();
  useEffect(() => {
    if (!message) return;
    toast.show({ variant, message });
  }, [message, variant, toast]);
}
