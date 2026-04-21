"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const fade = { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

function Bone({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...fade, delay }}
      className={cn("animate-pulse rounded bg-surfaceRaised", className)}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full">
      <div className="flex gap-4 border-b border-border px-3 py-2.5">
        {Array.from({ length: cols }).map((_, i) => <Bone key={i} className="h-3 flex-1" delay={i * 0.03} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border/50 px-3 py-3">
          {Array.from({ length: cols }).map((_, c) => <Bone key={c} className="h-3 flex-1" delay={r * 0.04} />)}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <Bone className="h-[88px] rounded-lg" />;
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => <Bone key={i} className="h-4" delay={i * 0.05} />)}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Bone className="h-3 w-24" delay={i * 0.05} />
          <Bone className="h-8" delay={i * 0.05 + 0.02} />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-4 w-32" />
        <Bone className="h-3 w-64" delay={0.05} />
      </div>
      <CardGridSkeleton />
    </div>
  );
}

export function ContentTransition({ loading, skeleton, children }: { loading: boolean; skeleton: React.ReactNode; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
          {skeleton}
        </motion.div>
      ) : (
        <motion.div key="content" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={fade}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
