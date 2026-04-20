"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { MonitorIcon } from "@/components/ui/monitor-icon";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { AnimatedBackground } from "@/components/ui/animated-background";

const pageTransition = {
  duration: 0.25,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [user, loading, router]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-5 w-5 rounded-full border-2 border-accent/30 border-t-accent"
        />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <AnimatedBackground />

      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-11 items-center justify-between border-b border-border bg-canvas/80 px-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-accent">
            <MonitorIcon className="h-3 w-3 text-accentFg" />
          </div>
          <span className="text-[13px] font-semibold text-fg">Monitor</span>
        </div>
        <button type="button" onClick={() => setMobileOpen((o) => !o)} className="rounded p-1 text-fgMuted hover:text-fg" aria-label="Menu">
          {mobileOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-canvas/80 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={cn(
        "relative z-20 shrink-0",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:z-20 lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* Content — full width */}
      <main className="relative z-10 min-w-0 flex-1 overflow-y-auto pt-11 lg:pt-0">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={pageTransition}
            className="w-full px-5 py-5 sm:px-8 lg:px-10 lg:py-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
