"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastCtx {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast requires ToastProvider");
  return c;
}

const icons: Record<ToastVariant, React.ElementType> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  info: InformationCircleIcon,
};

const styles: Record<ToastVariant, string> = {
  success: "border-success/20 bg-canvas text-success",
  error: "border-danger/20 bg-canvas text-danger",
  info: "border-accent/20 bg-canvas text-accent",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((p) => [...p, { id, variant, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismiss = (id: string) => setToasts((p) => p.filter((t) => t.id !== id));

  const ctx: ToastCtx = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-end gap-2 p-4">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const Icon = icons[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className={cn("pointer-events-auto flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-lg", styles[t.variant])}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-[13px] font-medium text-fg">{t.message}</span>
                <button type="button" onClick={() => dismiss(t.id)} className="ml-1 rounded p-0.5 text-fgSubtle transition-colors hover:text-fg">
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
