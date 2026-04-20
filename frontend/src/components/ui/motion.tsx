"use client";

import { motion, type Variants, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export { AnimatePresence };

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCard({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease }}
      whileHover={{ y: -1, transition: { duration: 0.2 } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease } },
};

export function StaggerList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerParent} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={staggerChild} className={className}>{children}</motion.div>;
}

const sectionStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const sectionChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
};

export function SectionStagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={sectionStagger} className={className}>
      {children}
    </motion.div>
  );
}

export function SectionItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={sectionChild} className={className}>{children}</motion.div>;
}

export function AnimatedNumber({ value, duration = 500 }: { value: number; duration?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef(0);
  const raf = useRef<number>();

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const start = ref.current;
    const t0 = performance.now();
    function step(now: number) {
      const t = Math.min((now - t0) / duration, 1);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - t, 3)));
      ref.current = v;
      setDisplayed(v);
      if (t < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);

  return <>{displayed}</>;
}

export function PulseIndicator({ active = true, color }: { active?: boolean; color: string }) {
  if (!active) return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", color)} />;
  return (
    <span className="relative inline-flex h-1.5 w-1.5">
      <span className={cn("absolute inset-0 animate-ping rounded-full opacity-50", color)} />
      <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", color)} />
    </span>
  );
}

export function RotateOnHover({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.span whileHover={{ rotate: 180 }} transition={{ duration: 0.25 }} className={cn("inline-flex", className)}>
      {children}
    </motion.span>
  );
}

export function ScaleIn({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HoverLift({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2, ease: "easeOut" } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
