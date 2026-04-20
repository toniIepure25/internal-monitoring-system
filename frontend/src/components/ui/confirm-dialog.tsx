"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
}

const Ctx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const fn = useContext(Ctx);
  if (!fn) throw new Error("useConfirm requires ConfirmProvider");
  return fn;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "" });
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handle = (result: boolean) => {
    setOpen(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[300] bg-canvas/60 backdrop-blur-sm"
              onClick={() => handle(false)}
            />
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="fixed inset-0 z-[301] flex items-center justify-center p-4"
            >
              <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-[13px] font-semibold text-fg">{opts.title}</h3>
                {opts.description && <p className="mt-1.5 text-xs text-fgMuted">{opts.description}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handle(false)}>Cancel</Button>
                  <Button variant={opts.variant === "danger" ? "danger" : "primary"} size="sm" onClick={() => handle(true)}>
                    {opts.confirmLabel || "Confirm"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
