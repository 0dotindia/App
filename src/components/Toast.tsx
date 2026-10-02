"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; action?: ToastAction };
type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast | null>(null);

// Lightweight non-blocking feedback, complementing the existing
// revalidatePath-driven full-rerender pattern (COMPONENT_LIBRARY.md:
// "doesn't scale to lightweight confirmations" like "Link added",
// "Copied to clipboard"). Mounted once at the root (see layout.tsx) so any
// client component can call useToast() without its own provider wiring.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback<ShowToast>((message, action) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, action }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* aria-live region: screen readers announce new toasts as they
          mount, without needing focus to move (ACCESSIBILITY.md's flagged
          gap — "no live-region announcements for async updates"). */}
      <div className="toastStack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toastAction"
                onClick={() => {
                  toast.action!.onClick();
                  setToasts((current) => current.filter((t) => t.id !== toast.id));
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return showToast;
}
