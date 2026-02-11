import React, { createContext, useContext, useMemo, useState } from "react";
import { CheckCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const makeId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return Math.random().toString(36).slice(2);
  };

  const toast = (input: Omit<ToastItem, "id">) => {
    const id = makeId();
    setItems((prev) => [...prev, { ...input, id }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  };

  const value = useMemo(() => ({ toast }), []);

  const iconFor = (variant: ToastVariant) => {
    switch (variant) {
      case "success": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case "error": return <AlertTriangle className="h-4 w-4 text-rose-400" />;
      default: return <Info className="h-4 w-4 text-sky-300" />;
    }
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-3">
        {items.map((t) => (
          <div key={t.id} className={cn(
            "rounded-xl border p-3 shadow-lg shadow-black/40 backdrop-blur",
            t.variant === "success" && "border-emerald-500/40 bg-emerald-500/10",
            t.variant === "error" && "border-rose-500/50 bg-rose-500/10",
            t.variant === "info" && "border-sky-500/40 bg-sky-500/10",
          )}>
            <div className="flex items-start gap-2 text-sm">
              {iconFor(t.variant)}
              <div className="space-y-1">
                <p className="font-semibold leading-tight">{t.title}</p>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}



