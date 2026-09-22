"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

import { alertToneClass, toneIcon, type Tone } from "./tone";

interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ show: (toast: ToastInput) => void } | null>(null);

const AUTO_DISMISS_MILLISECONDS = 8000;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("ToastProvider is missing.");
  return context;
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const translate = useTranslations("common");
  const tone = toast.tone ?? "neutral";
  const Icon = toneIcon[tone];
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.id]);
  return (
    <li
      className={cn(
        "shadow-raised pointer-events-auto flex items-start gap-2.5 rounded-sm border p-3",
        alertToneClass[tone],
      )}
    >
      <Icon aria-hidden="true" className="mt-px size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{toast.title}</p>
        {toast.description ? (
          <p className="text-muted-foreground text-xs">{toast.description}</p>
        ) : null}
      </div>
      <button
        aria-label={translate("close")}
        className="size-touch text-foreground -my-2 -me-2 grid shrink-0 place-items-center rounded-sm hover:bg-black/5"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const translate = useTranslations("common");
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const show = useCallback((toast: ToastInput) => {
    setToasts((current) => [...current, { ...toast, id: Date.now() + current.length }]);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label={translate("notifications")}
        className="pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm lg:start-auto lg:end-4 lg:bottom-4 lg:mx-0"
        role="region"
      >
        <ul aria-live="polite" className="space-y-2">
          {toasts.map((toast) => (
            <ToastView key={toast.id} onDismiss={dismiss} toast={toast} />
          ))}
        </ul>
      </div>
    </ToastContext.Provider>
  );
}
