"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/motion";

type Color = "gray" | "green" | "red" | "yellow" | "blue" | "cyan";

interface StatCardProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
  subtext?: string;
  color?: Color;
  delay?: number;
}

const accents: Record<Color, string> = {
  gray:   "text-fgSubtle",
  green:  "text-success",
  red:    "text-danger",
  yellow: "text-warning",
  blue:   "text-accent",
  cyan:   "text-info",
};

const bars: Record<Color, string> = {
  gray:   "bg-fgSubtle",
  green:  "bg-success",
  red:    "bg-danger",
  yellow: "bg-warning",
  blue:   "bg-accent",
  cyan:   "bg-info",
};

export function StatCard({ icon: Icon, label, value, subtext, color = "blue", delay = 0 }: StatCardProps) {
  const numericValue = typeof value === "number" ? value : parseInt(String(value), 10);
  const isNumeric = !isNaN(numericValue);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-lg border border-border bg-surface px-4 py-3.5 transition-shadow duration-200 hover:shadow-lg hover:shadow-black/5"
    >
      <div className={cn("absolute inset-y-0 left-0 w-[2px]", bars[color])} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-medium uppercase tracking-wider text-fgSubtle">{label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", accents[color])}>
            {isNumeric ? <AnimatedNumber value={numericValue} /> : value}
          </p>
          {subtext && <p className="mt-0.5 text-xs text-fgMuted">{subtext}</p>}
        </div>
        {Icon && <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", accents[color])} />}
      </div>
    </motion.div>
  );
}
