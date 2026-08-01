"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ToastTone = "default" | "success" | "error";

export interface ToastMessage {
  id: string;
  title: string;
  /** Plain text or rich content (e.g. a "View cart" link) — widened from
   * `string` so a toast can carry an inline call-to-action without a
   * separate `action` slot. */
  description?: ReactNode;
  tone: ToastTone;
}

export type ShowToastInput = Omit<ToastMessage, "id">;

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (toast: ShowToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function toneClasses(tone: ToastTone): string {
  const base = "glass-card rounded-xl p-4 shadow-lg border border-border-subtle text-on-surface";
  if (tone === "success") return `${base} border-l-4 border-l-tertiary-container`;
  if (tone === "error") return `${base} border-l-4 border-l-error`;
  return base;
}

let toastSeq = 0;
function nextId(): string {
  toastSeq += 1;
  return `toast-${Date.now()}-${toastSeq}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ShowToastInput) => {
      const id = nextId();
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ toasts, showToast, dismissToast }), [toasts, showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={toneClasses(t.tone)}>
            <p className="font-headline text-sm font-bold">{t.title}</p>
            {t.description ? <p className="mt-1 text-xs text-on-surface-variant">{t.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
